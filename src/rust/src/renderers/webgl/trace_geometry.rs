use js_sys::wasm_bindgen::prelude::*;
use web_sys::{WebGl2RenderingContext, WebGlBuffer};

use crate::{trace_styles::TraceStyle, types::NumericRange};

#[derive(Clone)]
pub enum TraceGeometry {
    Line {
        x_range: NumericRange,
        y_range: NumericRange,
        points: usize,
        line_buffer: WebGlBuffer,
        arc_length_buffer: WebGlBuffer,
    },
    #[allow(dead_code)]
    Area { area_buffer: WebGlBuffer },
}

impl TraceGeometry {
    pub fn destroy(self, ctx: &WebGl2RenderingContext) {
        match self {
            TraceGeometry::Line {
                line_buffer,
                arc_length_buffer,
                ..
            } => {
                ctx.delete_buffer(Some(&line_buffer));
                ctx.delete_buffer(Some(&arc_length_buffer));
            }
            TraceGeometry::Area { area_buffer } => {
                ctx.delete_buffer(Some(&area_buffer));
            }
        }
    }

    pub fn is_stale(
        &self,
        style: &TraceStyle,
        x_range: NumericRange,
        y_range: NumericRange,
    ) -> bool {
        match self {
            TraceGeometry::Line {
                x_range: prev_x_range,
                y_range: prev_y_range,
                ..
            } => {
                !style.get_line().is_solid()
                    && (x_range != *prev_x_range || y_range != *prev_y_range)
            }
            _ => false,
        }
    }
}

#[wasm_bindgen]
pub struct TraceGeometryHandle(pub(crate) TraceGeometry);
