use web_sys::{WebGl2RenderingContext, WebGlBuffer};

use crate::{
    renderers::TraceData,
    trace_styles::{OrUnset, TraceFillStyle, TraceStyle},
    types::NumericRange,
};

use super::WebGlRenderer;

#[derive(Clone)]
pub struct TraceGeometry {
    pub x_range: NumericRange,
    pub y_range: NumericRange,
    pub points: usize,
    pub line_buffer: WebGlBuffer,
    pub arc_length_buffer: WebGlBuffer,
    pub fill_buffer: Option<WebGlBuffer>,
}

impl TraceGeometry {
    pub fn destroy(self, ctx: &WebGl2RenderingContext) {
        ctx.delete_buffer(Some(&self.line_buffer));
        ctx.delete_buffer(Some(&self.arc_length_buffer));

        if let Some(buffer) = self.fill_buffer {
            ctx.delete_buffer(Some(&buffer));
        }
    }

    pub fn is_stale(
        &self,
        style: &TraceStyle,
        x_range: NumericRange,
        y_range: NumericRange,
    ) -> bool {
        let prev_x_range = self.x_range;
        let prev_y_range = self.y_range;

        (!style.get_line().is_solid() && (x_range != prev_x_range || y_range != prev_y_range))
            || (!matches!(style.fill, OrUnset::Set(TraceFillStyle::None))
                && self.fill_buffer.is_none())
    }

    pub fn new_line(
        renderer: &WebGlRenderer,
        data: TraceData,
        style: &TraceStyle,
        x_range: NumericRange,
        y_range: NumericRange,
    ) -> Self {
        Self {
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

    pub fn new_area(
        renderer: &WebGlRenderer,
        data: impl Iterator<Item = (f64, f64, f64)>,
        _style: &TraceStyle,
        x_range: NumericRange,
        y_range: NumericRange,
    ) -> Self {
        let mut trace = Vec::<(f32, f32)>::new();
        let mut area = Vec::<f32>::new();

        for (x, y1, y2) in data {
            area.extend([x, y1, x, y2].map(|v| v as f32));
            trace.push((x as f32, y2 as f32));
        }

        let data = TraceData { data: trace };

        Self {
            points: data.data.len(),
            x_range,
            y_range,
            line_buffer: create_trace_buffer(renderer, &data),
            arc_length_buffer: create_arc_length_buffer(renderer, &data, x_range, y_range),
            fill_buffer: Some(renderer.create_buffer(&area)),
        }
    }
}

fn create_trace_buffer(renderer: &WebGlRenderer, trace: &TraceData) -> WebGlBuffer {
    renderer.create_buffer(unsafe {
        core::slice::from_raw_parts(
            std::mem::transmute(trace.data.as_ptr()),
            trace.data.len() * 2,
        )
    })
}

fn create_trace_fill_buffer(renderer: &WebGlRenderer, trace: &TraceData) -> WebGlBuffer {
    let mut data = Vec::<f32>::with_capacity(trace.data.len() * 4);

    for &(x, y) in trace.data.iter() {
        data.extend([x, 0., x, y]);
    }

    renderer.create_buffer(&data)
}

fn create_arc_length_buffer(
    renderer: &WebGlRenderer,
    trace: &TraceData,
    display_x_range: NumericRange,
    display_y_range: NumericRange,
) -> WebGlBuffer {
    if trace.data.is_empty() {
        return renderer.create_buffer(&Vec::with_capacity(0));
    }

    let lengths: Vec<f32> = {
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

    renderer.create_buffer(&lengths)
}
