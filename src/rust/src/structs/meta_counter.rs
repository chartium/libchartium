use wasm_bindgen::prelude::wasm_bindgen;

use crate::{
    data::TraceHandle,
    trace::BundleRc,
    types::{NumericRange, TraceMetas},
};

#[wasm_bindgen]
pub struct MetaCounter {
    sums: Vec<f64>,
    lens: Vec<usize>,
    nz_lens: Vec<usize>,
    mins: Vec<f64>,
    maxs: Vec<f64>,
}

impl MetaCounter {
    pub fn add(&mut self, col: usize, val: f64) {
        if val.is_nan() {
            return;
        };
        self.sums[col] += val;
        self.lens[col] += 1;
        self.maxs[col] = val.max(self.maxs[col]);
        self.mins[col] = val.min(self.mins[col]);
        if val > 0. {
            self.nz_lens[col] += 1;
        }
    }

    pub fn iter_metas(&self) -> impl Iterator<Item = TraceMetas> + '_ {
        (0..self.sums.len()).map(|i| TraceMetas {
            handle: 0,
            avg: self.sums[i] / self.lens[i] as f64,
            avg_nz: self.sums[i] / self.nz_lens[i] as f64,
            min: self.mins[i],
            max: self.maxs[i],
        })
    }
}

#[wasm_bindgen]
impl MetaCounter {
    #[wasm_bindgen(constructor)]
    pub fn new(len: usize) -> Self {
        Self {
            sums: vec![0.0; len],
            lens: vec![0; len],
            nz_lens: vec![0; len],
            mins: vec![std::f64::INFINITY; len],
            maxs: vec![std::f64::NEG_INFINITY; len],
        }
    }

    pub fn add_from_counter(&mut self, col: usize, other: &MetaCounter, other_col: usize) {
        self.sums[col] += other.sums[other_col];
        self.lens[col] += other.lens[other_col];
        self.nz_lens[col] += other.nz_lens[other_col];
        self.mins[col] = self.mins[col].min(other.mins[other_col]);
        self.maxs[col] = self.maxs[col].max(other.maxs[other_col]);
    }

    // ! TODO Ensure correct behavior for trace handles
    // ! that are not present in the bundle
    pub fn add_bundle(
        &mut self,
        bundle: &BundleRc,
        traces: &[TraceHandle],
        x_range: NumericRange,
        y_factor: f64,
    ) {
        for (i, trace_data) in traces
            .iter()
            .map(|&t| bundle.unwrap().iter_in_range_f64(t, x_range))
            .enumerate()
        {
            for (_, y) in trace_data {
                self.add(i, y * y_factor);
            }
        }
    }

    pub fn to_array(&self) -> js_sys::Array {
        js_sys::Array::from_iter(
            self.iter_metas()
                .map(|m| serde_wasm_bindgen::to_value(&m).unwrap()),
        )
    }
}
