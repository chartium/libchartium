use js_sys::wasm_bindgen::prelude::*;
use web_sys::{WebGl2RenderingContext, WebGlBuffer};

use crate::{
    renderers::TraceData,
    trace_styles::{OrUnset, TraceFillStyle, TraceStyle},
    types::NumericRange,
};

use super::WebGlRenderer;

/// A function-less handle to allow passing geometry around in JS-land.
#[wasm_bindgen]
pub struct TraceGeometryHandle(pub(crate) TraceGeometry);

#[derive(Clone)]
pub enum TraceGeometry {
    Line {
        x_range: NumericRange,
        y_range: NumericRange,
        points: usize,
        line_buffer: WebGlBuffer,
        arc_length_buffer: WebGlBuffer,
        fill_buffer: Option<WebGlBuffer>,
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
                fill_buffer,
                ..
            } => {
                ctx.delete_buffer(Some(&line_buffer));
                ctx.delete_buffer(Some(&arc_length_buffer));

                if let Some(buffer) = fill_buffer {
                    ctx.delete_buffer(Some(&buffer));
                }
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
                fill_buffer,
                ..
            } => {
                (!style.get_line().is_solid()
                    && (x_range != *prev_x_range || y_range != *prev_y_range))
                    || (matches!(style.fill, OrUnset::Set(TraceFillStyle::ToZeroY))
                        && fill_buffer.is_none())
            }
            _ => false,
        }
    }

    pub fn new_line(
        renderer: &WebGlRenderer,
        data: TraceData,
        style: &TraceStyle,
        x_range: NumericRange,
        y_range: NumericRange,
    ) -> Self {
        TraceGeometry::Line {
            points: data.data.len(),
            x_range,
            y_range,
            line_buffer: create_trace_buffer(renderer, &data),
            arc_length_buffer: create_arc_length_buffer(renderer, &data, x_range, y_range),
            fill_buffer: match style.fill {
                OrUnset::Set(TraceFillStyle::ToZeroY) => {
                    Some(create_trace_fill_buffer(renderer, &data))
                }
                _ => None,
            },
        }
    }
}

fn create_trace_buffer(renderer: &WebGlRenderer, trace: &TraceData) -> WebGlBuffer {
    let context = &renderer.context;
    let buffer = context.create_buffer().unwrap();

    context.bind_buffer(WebGl2RenderingContext::ARRAY_BUFFER, Some(&buffer));
    context.buffer_data_with_array_buffer_view(
        WebGl2RenderingContext::ARRAY_BUFFER,
        unsafe {
            &js_sys::Float32Array::view(core::slice::from_raw_parts(
                std::mem::transmute(trace.data.as_ptr()),
                trace.data.len() * 2,
            ))
        },
        WebGl2RenderingContext::STATIC_DRAW,
    );

    buffer
}

fn create_trace_fill_buffer(renderer: &WebGlRenderer, trace: &TraceData) -> WebGlBuffer {
    let context = &renderer.context;
    let buffer = context.create_buffer().unwrap();

    let mut data = Vec::<f32>::with_capacity((trace.data.len() - 1).max(0) * 6 * 2);

    for window in trace.data.windows(2) {
        let (left, right) = (window[0], window[1]);

        data.extend([
            left.0, left.1, // Top left
            right.0, right.1, // Top right
            left.0, 0., // Bottom left
            left.0, 0., // Bottom left
            right.0, 0., // Bottom right
            right.0, right.1, // Top right
        ]);
    }

    context.bind_buffer(WebGl2RenderingContext::ARRAY_BUFFER, Some(&buffer));
    context.buffer_data_with_array_buffer_view(
        WebGl2RenderingContext::ARRAY_BUFFER,
        unsafe { &js_sys::Float32Array::view(&data) },
        WebGl2RenderingContext::STATIC_DRAW,
    );

    buffer
}
fn create_arc_length_buffer(
    renderer: &WebGlRenderer,
    trace: &TraceData,
    display_x_range: NumericRange,
    display_y_range: NumericRange,
) -> WebGlBuffer {
    let context = &renderer.context;

    let lengths: Vec<f32> = if trace.data.is_empty() {
        Vec::with_capacity(0)
    } else {
        let (x_pixel_ratio, y_pixel_ratio) = (
            (renderer.width as f64) / display_x_range.len(),
            (renderer.height as f64) / display_y_range.len(),
        );

        let (first_x, first_y) = (
            x_pixel_ratio * (trace.data[0].0 as f64 - display_x_range.from),
            y_pixel_ratio * (trace.data[0].1 as f64 - display_y_range.from),
        );

        #[derive(Clone, Debug)]
        struct State {
            length_so_far: f64,
            last_x: f64,
            last_y: f64,
        }

        let initial_state = State {
            length_so_far: 0.0,
            last_x: first_x,
            last_y: first_y,
        };

        trace
            .data
            .iter()
            .map(|(x, y)| {
                (
                    x_pixel_ratio * (*x as f64 - display_x_range.from),
                    y_pixel_ratio * (*y as f64 - display_y_range.from),
                )
            })
            .scan(initial_state, |state: &mut State, (x, y): (f64, f64)| {
                let len_sqr: f64 = (state.last_x - x).powi(2) + (state.last_y - y).powi(2);
                if !len_sqr.is_nan() {
                    *state = State {
                        last_x: x,
                        last_y: y,
                        length_so_far: state.length_so_far + len_sqr.sqrt(),
                    };
                };

                Some(state.length_so_far as f32)
            })
            .collect()
    };

    let buffer = context.create_buffer().unwrap();
    context.bind_buffer(WebGl2RenderingContext::ARRAY_BUFFER, Some(&buffer));
    context.buffer_data_with_array_buffer_view(
        WebGl2RenderingContext::ARRAY_BUFFER,
        unsafe {
            &js_sys::Float32Array::view(core::slice::from_raw_parts(
                lengths.as_ptr(),
                lengths.len(),
            ))
        },
        WebGl2RenderingContext::STATIC_DRAW,
    );

    buffer
}
