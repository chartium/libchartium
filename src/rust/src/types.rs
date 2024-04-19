// https://github.com/madonoharu/tsify/issues/42
#![allow(non_snake_case)]

use serde::{Deserialize, Serialize};
use tsify::Tsify;
use wasm_bindgen::prelude::wasm_bindgen;

use crate::data::TraceHandle;

#[derive(Tsify, Serialize, Deserialize, Clone, Copy, PartialEq)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[serde(rename_all = "camelCase")]
pub struct NumericRange {
    pub from: f64,
    pub to: f64,
}

impl NumericRange {
    pub fn len(&self) -> f64 {
        self.to - self.from
    }
    pub fn as_tuple(&self) -> (f64, f64) {
        (self.from, self.to)
    }
}

#[derive(Tsify, Serialize, Deserialize, Clone, Copy)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[serde(rename_all = "camelCase")]
pub struct TraceMetas {
    pub handle: TraceHandle,
    pub avg: f64,
    pub avg_nz: f64,
    pub min: f64,
    pub max: f64,
}

#[derive(Tsify, Serialize, Deserialize, Clone, Copy)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct TracePoint {
    pub handle: TraceHandle,
    pub x: f64,
    pub y: f64,
}
