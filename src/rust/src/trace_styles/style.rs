// https://github.com/madonoharu/tsify/issues/42
#![allow(non_snake_case)]

use std::{
    hash::{Hash, Hasher},
    rc::Rc,
};

use optfield::optfield;
use serde::{Deserialize, Serialize};
use tsify::Tsify;
use wasm_bindgen::prelude::wasm_bindgen;

use super::{
    field_types::{TraceColor, TraceLineStyle, TracePaletteIndex, TracePointsStyle},
    utils::OrUnset,
};

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
    pub fn unset() -> Self {
        Default::default()
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
pub struct SharedTraceStyle(Rc<TraceStyle>);

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