// https://github.com/madonoharu/tsify/issues/42
#![allow(non_snake_case)]

use std::collections::HashMap;

use optfield::optfield;
use serde::{Deserialize, Serialize};
use tsify::Tsify;
use wasm_bindgen::prelude::wasm_bindgen;

use crate::data::TraceHandle;

pub trait StaticDefault {
    fn default() -> &'static Self;
}
macro_rules! derive_static_default {
    ($t:ty, $v:expr) => {
        const _: () = {
            const STATIC_DEFAULT: $t = $v;
            impl StaticDefault for $t {
                #[inline(always)]
                fn default() -> &'static Self {
                    &STATIC_DEFAULT
                }
            }
        };
    };
}

#[wasm_bindgen(typescript_custom_section)]
const TS_ORUNSET: &'static str = r#"
export type OrUnset<T> = T | "unset";"#;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum OrUnset<T> {
    Unset,
    #[serde(untagged)]
    Set(T),
}
impl<T> OrUnset<T>
where
    T: Clone,
{
    pub fn set_or(&self, value: T) -> T {
        match self {
            OrUnset::Set(v) => v.clone(),
            OrUnset::Unset => value,
        }
    }
}
impl<T> OrUnset<T>
where
    T: StaticDefault + Clone + 'static,
{
    #[inline(always)]
    pub fn or_default(&self) -> &T {
        match self {
            OrUnset::Set(v) => v,
            OrUnset::Unset => StaticDefault::default(),
        }
    }
}
impl<T> Clone for OrUnset<T>
where
    T: Clone,
{
    fn clone(&self) -> Self {
        match self {
            OrUnset::Unset => OrUnset::Unset,
            OrUnset::Set(x) => OrUnset::Set(x.clone()),
        }
    }
}
impl<T> Copy for OrUnset<T> where T: Copy {}
impl<T> PartialEq for OrUnset<T>
where
    T: PartialEq,
{
    fn eq(&self, other: &Self) -> bool {
        use OrUnset::*;
        match (self, other) {
            (Set(x), Set(y)) => x.eq(y),
            (Unset, Unset) => true,
            _ => false,
        }
    }
}

#[derive(Clone, PartialEq, Tsify, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TraceColor {
    Exact([f32; 4]),
    Random(TraceRandomColorSpace),
    PaletteAuto(String),
}
derive_static_default!(
    TraceColor,
    TraceColor::Random(TraceRandomColorSpace::ContrastWithBoth)
);

#[derive(Clone, Copy, PartialEq, Tsify, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TraceRandomColorSpace {
    ContrastWithBoth,
    ContrastWithLight,
    ContrastWithDark,
}

#[derive(Clone, Copy, PartialEq, Tsify, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TraceLineStyle {
    None,
    Solid,
    Dashed([f32; 2]),
    DoubleDashed([f32; 4]),
}
derive_static_default!(TraceLineStyle, TraceLineStyle::Solid);

#[derive(Clone, Copy, PartialEq, Tsify, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TracePointsStyle {
    None,
    Show,
}
derive_static_default!(TracePointsStyle, TracePointsStyle::None);

#[wasm_bindgen(typescript_custom_section)]
const TS_PALETTE_INDEX: &'static str = r#"export type TracePaletteIndex = number | "auto";"#;
#[derive(Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TracePaletteIndex {
    Auto,
    #[serde(untagged)]
    Some(usize),
}
derive_static_default!(TracePaletteIndex, TracePaletteIndex::Auto);

#[optfield(
    pub TraceStylePatch,
    attrs,
    field_attrs = add(tsify(optional)),
    merge_fn = patch_mut
)]
#[derive(Clone, Tsify, PartialEq, Serialize, Deserialize)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[serde(rename_all = "kebab-case")]
pub struct TraceStyle {
    pub color: OrUnset<TraceColor>,
    pub points: OrUnset<TracePointsStyle>,
    pub line: OrUnset<TraceLineStyle>,
    pub line_width: OrUnset<u32>,
    pub palette_index: OrUnset<TracePaletteIndex>,
    pub z_index: OrUnset<f64>,
    pub legend_priority: OrUnset<f64>,
}

impl TraceStyle {
    #[inline(always)]
    pub fn get_color(&self) -> &TraceColor {
        self.color.or_default()
    }
    #[inline(always)]
    pub fn get_points(&self) -> &TracePointsStyle {
        self.points.or_default()
    }
    #[inline(always)]
    pub fn get_line(&self) -> &TraceLineStyle {
        self.line.or_default()
    }
    #[inline(always)]
    pub fn get_palette_index(&self) -> &TracePaletteIndex {
        self.palette_index.or_default()
    }
    #[inline(always)]
    pub fn get_line_width(&self) -> u32 {
        self.line_width.set_or(2)
    }
    #[inline(always)]
    pub fn get_z_index(&self) -> f64 {
        self.z_index.set_or(0.)
    }
    #[inline(always)]
    pub fn get_legend_priority(&self) -> f64 {
        self.legend_priority.set_or(0.)
    }

    pub fn patch(&self, patch: TraceStylePatch) -> TraceStyle {
        let mut patched = self.clone();
        patched.patch_mut(patch);
        patched
    }
}

#[wasm_bindgen]
#[derive(Clone)]
pub struct TraceStyleSheet {
    pub(self) base: TraceStyle,
    pub(self) traces: HashMap<TraceHandle, TraceStyle>,
}
#[wasm_bindgen]
#[derive(Clone)]
pub struct TraceStyleSheetPatch {
    pub(self) base: TraceStylePatch,
    pub(self) traces: HashMap<TraceHandle, TraceStylePatch>,
}

impl TraceStyleSheet {
    pub fn get(&self, t: TraceHandle) -> &TraceStyle {
        self.traces.get(&t).unwrap_or(&self.base)
    }
}
#[wasm_bindgen]
impl TraceStyleSheet {
    pub fn get_cloned(&self, t: TraceHandle) -> TraceStyle {
        self.get(t).clone()
    }

    pub fn patch(&self, style_sheet_patch: TraceStyleSheetPatch) -> TraceStyleSheet {
        let mut traces = self.traces.clone();
        for (t, style_patch) in style_sheet_patch.traces {
            let patched = traces.get(&t).unwrap_or(&self.base).patch(style_patch);
            traces.insert(t, patched);
        }

        TraceStyleSheet {
            base: self.base.patch(style_sheet_patch.base),
            traces,
        }
    }
}
