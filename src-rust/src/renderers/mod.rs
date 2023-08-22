mod webgl;
use serde::{Deserialize, Serialize};
pub use webgl::WebGlRenderer;

#[derive(Serialize, Deserialize)]
pub struct AxisTick {
    val: f64,
    pos: f64,
}

#[derive(Serialize, Deserialize)]
pub struct RenderJobResult {
    x_ticks: Box<[AxisTick]>,
    y_ticks: Box<[AxisTick]>,
}
