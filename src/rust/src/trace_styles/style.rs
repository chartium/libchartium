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
    TraceFillStyle,
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
    pub fill: OrUnset<TraceFillStyle>,
}

#[derive(Clone, Tsify, Serialize, Deserialize)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[serde(rename_all = "kebab-case")]
pub struct ComputedTraceStyle {
    pub color: TraceColor,
    pub points: TracePointsStyle,
    pub line: TraceLineStyle,
    pub line_width: u32,
    pub palette_index: TracePaletteIndex,
    pub z_index: f64,
    pub legend_priority: f64,
    pub fill: TraceFillStyle,
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
            && self.fill.is_none()
    }
}

impl TraceStyle {
    pub fn unset() -> Self {
        Default::default()
    }

    #[inline(always)]
    pub fn get_color(&self) -> TraceColor {
        match &self.color {
            OrUnset::Set(c) => c.clone(),
            OrUnset::Unset => TraceColor::PaletteAuto("bright".to_string()),
        }
    }
    #[inline(always)]
    pub fn get_points(&self) -> TracePointsStyle {
        self.points.unwrap_or_default()
    }
    #[inline(always)]
    pub fn get_line(&self) -> &TraceLineStyle {
        self.line.ref_or_default()
    }
    #[inline(always)]
    pub fn get_palette_index(&self) -> &TracePaletteIndex {
        self.palette_index.ref_or_default()
    }
    #[inline(always)]
    pub fn get_line_width(&self) -> u32 {
        self.line_width.unwrap_or(2)
    }
    #[inline(always)]
    pub fn get_z_index(&self) -> f64 {
        self.z_index.unwrap_or(0.)
    }
    #[inline(always)]
    pub fn get_legend_priority(&self) -> f64 {
        self.legend_priority.unwrap_or(0.)
    }
    #[inline(always)]
    pub fn get_fill(&self) -> TraceFillStyle {
        self.fill.unwrap_or_default()
    }

    pub fn to_computed(&self) -> ComputedTraceStyle {
        ComputedTraceStyle {
            color: self.get_color().clone(),
            points: self.get_points(),
            line: *self.get_line(),
            palette_index: *self.get_palette_index(),
            line_width: self.get_line_width(),
            z_index: self.get_z_index(),
            legend_priority: self.get_legend_priority(),
            fill: self.get_fill(),
        }
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
