// https://github.com/madonoharu/tsify/issues/42
#![allow(non_snake_case)]

use std::{
    collections::{HashMap, HashSet},
    hash::{Hash, Hasher},
    rc::Rc,
};

use optfield::optfield;
use serde::{Deserialize, Serialize};
use tsify::Tsify;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

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

#[derive(Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum OrUnset<T> {
    #[default]
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

#[derive(Clone, Copy, PartialEq, Eq, Tsify, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TraceRandomColorSpace {
    ContrastWithBoth,
    ContrastWithLight,
    ContrastWithDark,
}
#[wasm_bindgen(typescript_custom_section)]
const TS_COLOR_SPACE_GUARD: &'static str =
    r#"export function is_trace_random_color_space(s: unknown): s is TraceRandomColorSpace;"#;
#[wasm_bindgen(skip_typescript)]
pub fn is_trace_random_color_space(s: JsValue) -> bool {
    TraceRandomColorSpace::from_js(s).is_ok()
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
#[derive(Clone, Default, PartialEq, Tsify, Serialize, Deserialize)]
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
    pub fn unset() -> Self {
        Default::default()
    }
}

impl TraceStylePatch {
    pub fn is_empty(&self) -> bool {
        self.color.is_none()
            && self.points.is_none()
            && self.line.is_none()
            && self.line_width.is_none()
            && self.palette_index.is_none()
            && self.z_index.is_none()
            && self.legend_priority.is_none()
    }
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

#[derive(Clone)]
struct SharedTraceStyle(Rc<TraceStyle>);

impl SharedTraceStyle {
    pub fn from(s: TraceStyle) -> SharedTraceStyle {
        SharedTraceStyle(Rc::new(s))
    }
}

impl AsRef<Rc<TraceStyle>> for SharedTraceStyle {
    fn as_ref(&self) -> &Rc<TraceStyle> {
        &self.0
    }
}

impl PartialEq for SharedTraceStyle {
    fn eq(&self, other: &SharedTraceStyle) -> bool {
        Rc::ptr_eq(&self.0, &other.0)
    }
}

impl Eq for SharedTraceStyle {}

impl Hash for SharedTraceStyle {
    fn hash<H>(&self, hasher: &mut H)
    where
        H: Hasher,
    {
        hasher.write_usize(Rc::as_ptr(&self.0) as usize);
    }
}

#[wasm_bindgen]
#[derive(Clone)]
pub struct TraceStyleSheet {
    pub(self) base: TraceStyle,
    pub(self) traces: HashMap<TraceHandle, SharedTraceStyle>,
}

#[wasm_bindgen]
#[derive(Clone)]
pub struct TraceStyleSheetPatch {
    pub(self) base: TraceStylePatch,
    pub(self) traces: HashMap<TraceHandle, TraceStylePatch>,
}

impl TraceStyleSheet {
    pub fn get(&self, t: TraceHandle) -> &TraceStyle {
        self.traces.get(&t).map_or(&self.base, |s| s.as_ref())
    }
}

#[wasm_bindgen]
impl TraceStyleSheet {
    pub fn unset() -> Self {
        Self {
            base: TraceStyle::unset(),
            traces: HashMap::new(),
        }
    }

    pub fn get_cloned(&self, t: TraceHandle) -> TraceStyle {
        self.get(t).clone()
    }

    pub fn patch(&self, style_sheet_patch: TraceStyleSheetPatch) -> TraceStyleSheet {
        let mut traces = apply_base_patch_to_trace_styles(&self.traces, &style_sheet_patch.base);
        for (t, style_patch) in style_sheet_patch.traces {
            let patched = traces
                .get(&t)
                .map_or(&self.base, |s| s.as_ref())
                .patch(style_patch);
            traces.insert(t, SharedTraceStyle::from(patched));
        }

        TraceStyleSheet {
            base: self.base.patch(style_sheet_patch.base),
            traces,
        }
    }
}

fn apply_base_patch_to_trace_styles(
    traces: &HashMap<TraceHandle, SharedTraceStyle>,
    patch: &TraceStylePatch,
) -> HashMap<TraceHandle, SharedTraceStyle> {
    if patch.is_empty() {
        return traces.clone();
    }

    let distinct_styles: HashSet<_> = traces.values().collect();
    let style_map: HashMap<_, _> = distinct_styles
        .iter()
        .map(|&old| {
            let new = SharedTraceStyle::from(old.as_ref().patch(patch.clone()));
            (old, new)
        })
        .collect();

    traces
        .iter()
        .map(|(&handle, old_style)| {
            let new_style = style_map.get(old_style).unwrap().clone();
            (handle, new_style)
        })
        .collect()
}

#[wasm_bindgen]
pub struct TraceStyleSheetPatchBuilder {
    style_sheet: TraceStyleSheetPatch,
}

#[wasm_bindgen]
impl TraceStyleSheetPatchBuilder {
    pub fn base(base: TraceStylePatch) -> Self {
        Self {
            style_sheet: TraceStyleSheetPatch {
                base,
                traces: HashMap::new(),
            },
        }
    }

    pub fn add(&mut self, trace_handle: TraceHandle, style: TraceStylePatch) {
        self.style_sheet.traces.insert(trace_handle, style.clone());
    }

    pub fn collect(self) -> TraceStyleSheetPatch {
        self.style_sheet
    }
}

#[wasm_bindgen]
pub struct TraceStyleSheetUnionBuilder {
    style_sheet: TraceStyleSheet,
}

#[wasm_bindgen]
impl TraceStyleSheetUnionBuilder {
    pub fn new(first_sheet: &TraceStyleSheet) -> TraceStyleSheetUnionBuilder {
        TraceStyleSheetUnionBuilder {
            style_sheet: first_sheet.clone(),
        }
    }

    pub fn add(&mut self, trace_handles: &[TraceHandle], style_sheet: &TraceStyleSheet) {
        let base = SharedTraceStyle::from(style_sheet.base.clone());
        for &handle in trace_handles {
            self.style_sheet.traces.insert(
                handle,
                style_sheet.traces.get(&handle).unwrap_or(&base).clone(),
            );
        }
    }

    pub fn collect(self) -> TraceStyleSheet {
        self.style_sheet
    }
}
