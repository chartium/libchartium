mod webgl;
use crate::prelude::*;
use serde::{Deserialize, Serialize};
pub use webgl::WebGlRenderer;

#[derive(Serialize, Deserialize)]
pub struct AxisTick {
    val: RangePrec,
    pos: RangePrec,
}

#[derive(Serialize, Deserialize)]
pub struct RenderJobResult {
    x_ticks: Box<[AxisTick]>,
    y_ticks: Box<[AxisTick]>,
}
