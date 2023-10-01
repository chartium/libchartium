use crate::data::TraceHandle;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
#[derive(Clone, Serialize, Deserialize)]
pub struct TraceMetas {
    pub handle: TraceHandle,
    pub avg: f64,
    pub avg_nz: f64,
    pub min: f64,
    pub max: f64,
}

#[wasm_bindgen]
#[derive(Clone, Serialize, Deserialize)]
pub struct TracePoint {
    pub handle: TraceHandle,
    pub x: f64,
    pub y: f64,
}
