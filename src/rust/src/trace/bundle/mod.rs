// https://github.com/madonoharu/tsify/issues/42
#![allow(non_snake_case)]

mod containers;
mod vec;

use crate::{data::TraceHandle, types::NumericRange};
use serde::{Deserialize, Serialize};
use tsify::Tsify;
use wasm_bindgen::prelude::wasm_bindgen;

pub use containers::*;
pub use vec::*;

#[derive(Tsify, Clone, Copy, Serialize, Deserialize)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[serde(rename_all = "kebab-case")]
pub enum InterpolationStrategy {
    None,
    Nearest,
    Linear,
    Previous,
    Next,
}

#[derive(Debug, Clone, Tsify, Serialize, Deserialize)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[serde(tag = "type", content = "value")]
pub enum BundleRange {
    Bounded { from: f64, to: f64 },
    Everywhere,
}
impl BundleRange {
    pub fn contains(&self, v: f64) -> bool {
        use BundleRange::*;
        match self {
            Bounded { from, to } => *from <= v && v <= *to,
            Everywhere => true,
        }
    }
}

pub trait Bundle {
    fn traces(&self) -> Vec<TraceHandle>;
    fn range(&self) -> BundleRange;
    fn point_count(&self) -> usize;

    fn contains_trace(&self, trace: TraceHandle) -> bool;

    fn contains_point(&self, point: f64) -> bool {
        match self.range() {
            BundleRange::Bounded { from, to } => from <= point && to >= point,
            BundleRange::Everywhere => false,
        }
    }

    fn intersects(&self, x_from: f64, x_to: f64) -> bool {
        match self.range() {
            BundleRange::Bounded { from, to } => from <= x_to && to >= x_from,
            BundleRange::Everywhere => true,
        }
    }

    fn iter_in_range_f64<'a>(
        &'a self,
        handle: TraceHandle,
        x_range: NumericRange,
    ) -> Box<dyn Iterator<Item = (f64, f64)> + 'a>;

    fn iter_in_range_with_neighbors_f64<'a>(
        &'a self,
        handle: TraceHandle,
        x_range: NumericRange,
    ) -> Box<dyn Iterator<Item = (f64, f64)> + 'a>;

    fn iter_many_in_range_f64<'a>(
        &'a self,
        handles: Vec<TraceHandle>,
        x_range: NumericRange,
    ) -> Box<dyn Iterator<Item = Vec<f64>> + 'a>;

    fn value_at(
        &self,
        trace: TraceHandle,
        x: f64,
        interpolation_strategy: InterpolationStrategy,
    ) -> Option<(f64, f64)>;
}
