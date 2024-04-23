// https://github.com/madonoharu/tsify/issues/42
#![allow(non_snake_case)]

use std::sync::atomic::{AtomicU32, Ordering};

use crate::{
    data::{BundleHandle, TraceHandle},
    types::NumericRange,
};
use serde::{Deserialize, Serialize};
use tsify::Tsify;
use wasm_bindgen::prelude::wasm_bindgen;

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

static BUNDLE_COUNTER: AtomicU32 = AtomicU32::new(0);

#[wasm_bindgen]
pub struct BoxedBundle {
    handle: BundleHandle,
    bundle: Box<dyn Bundle>,
}

impl BoxedBundle {
    pub fn new(bundle: impl Bundle + 'static) -> BoxedBundle {
        BoxedBundle {
            handle: BUNDLE_COUNTER.fetch_add(1, Ordering::AcqRel),
            bundle: Box::new(bundle),
        }
    }

    #[allow(clippy::borrowed_box)]
    pub fn unwrap(&self) -> &Box<dyn Bundle> {
        &self.bundle
    }
}

impl std::ops::Deref for BoxedBundle {
    type Target = dyn Bundle;

    fn deref(&self) -> &Self::Target {
        &*self.bundle
    }
}

#[wasm_bindgen]
impl BoxedBundle {
    pub fn handle(&self) -> BundleHandle {
        self.handle
    }

    pub fn traces(&self) -> Box<[TraceHandle]> {
        self.bundle.traces().into_boxed_slice()
    }
    pub fn contains_trace(&self, trace: TraceHandle) -> bool {
        self.bundle.contains_trace(trace)
    }
    pub fn range(&self) -> BundleRange {
        self.bundle.range()
    }
    pub fn range_in_view(&self, view_x_range: NumericRange) -> NumericRange {
        match self.bundle.range() {
            BundleRange::Everywhere => view_x_range,
            BundleRange::Bounded { from, to } => {
                let from = from.max(view_x_range.from);
                let to = to.min(view_x_range.to);
                let to = to.max(from);
                NumericRange { from, to }
            }
        }
    }

    pub fn point_count(&self) -> usize {
        self.bundle.point_count()
    }
    pub fn contains_point(&self, point: f64) -> bool {
        self.bundle.contains_point(point)
    }
    pub fn intersects(&self, from: f64, to: f64) -> bool {
        self.bundle.intersects(from, to)
    }
    /// ### Fills input buffer with trace data from input range (including both endpoints) and handle array, returns number of valid elements
    /// * Buffer format is always \[x, y₁, y₂,… yₙ, x', y'₁, …], i.e. each datapoint takes up n+1 elements of the buffer (given n trace handles on input)
    ///   * Therefore returned number is always a multiple of `trace_handles.length()+1`
    ///   * Only whole datapoints are recorded. If there isn't space for n+1 more elements left the remaining space will remain unchanged
    ///   * The same applies for the end of the range
    // FIXME not used for batches? idk lol
    // /// * If any trace doesn't have data for an x, the y datapoint get's interpolated via interpolation_strategy
    // ///   * if interpolation_strategy == InterpolationStrategy::None, the y will be NaN
    pub fn export_to_buffer(
        &self,
        buffer: &mut [f64],
        trace_handles: &[u32],
        x_range: NumericRange,
        //interpolation_strategy: InterpolationStrategy,
    ) -> usize {
        let datapoint_length = trace_handles.len() + 1;
        let space_in_buffer = buffer.len() / datapoint_length;
        if space_in_buffer == 0 {
            return 0;
        }
        let mut iterator = self
            .bundle
            .iter_many_in_range_f64(trace_handles.to_vec(), x_range);
        for i in 0..space_in_buffer {
            if let Some(datapoint) = iterator.next() {
                buffer[i * datapoint_length..(i + 1) * datapoint_length]
                    .copy_from_slice(datapoint.as_slice());
            } else {
                return i * datapoint_length;
            }
        }

        space_in_buffer * datapoint_length
    }
}
