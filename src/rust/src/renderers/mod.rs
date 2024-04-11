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
    pub clear: bool,
    pub x_range: NumericRange,
    pub y_range: NumericRange,
}

#[wasm_bindgen]
pub struct TraceData {
    x_range: NumericRange,
    data: Vec<(f32, f32)>,
}
#[wasm_bindgen]
impl TraceData {
    pub fn compute(bundle: &BoxedBundle, handle: TraceHandle, x_range: NumericRange) -> TraceData {
        let data = bundle
            .unwrap()
            .iter_in_range_f64(handle, x_range)
            .with_origin_at(x_range.from, 0.0)
            .map(|(x, y)| (x as f32, y as f32))
            .collect();

        TraceData { x_range, data }
    }
}
