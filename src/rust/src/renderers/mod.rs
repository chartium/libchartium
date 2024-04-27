// https://github.com/madonoharu/tsify/issues/42
#![allow(non_snake_case)]

use serde::{Deserialize, Serialize};
use tsify::Tsify;
use wasm_bindgen::prelude::wasm_bindgen;

mod webgl;
pub use webgl::WebGlRenderer;

use crate::{
    data::TraceHandle,
    trace::{extensions::PointIteratorExtension, BoxedBundle},
    types::NumericRange,
};

#[derive(Tsify, Serialize, Deserialize)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[serde(rename_all = "camelCase")]
pub struct RenderJobCommon {
    pub x_range: NumericRange,
    pub y_range: NumericRange,
}

pub struct TraceData {
    data: Vec<(f32, f32)>,
}

impl TraceData {
    pub fn compute(bundle: &BoxedBundle, handle: TraceHandle, x_range: NumericRange) -> TraceData {
        let data = bundle
            .unwrap()
            .iter_in_range_with_neighbors_f64(handle, x_range)
            .with_origin_at(x_range.from, 0.0)
            .map(|(x, y)| (x as f32, y as f32))
            .collect();

        TraceData { data }
    }
}
