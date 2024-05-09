use once_cell::sync::Lazy;
use web_sys::{WebGl2RenderingContext, WebGlBuffer};

use crate::{
    data::TraceHandle,
    renderers::{RenderJobCommon, TraceData},
    trace::{BundleRange, BundleRc},
    trace_styles::{OrUnset, TraceFillStyle, TraceStyle},
    types::NumericRange,
};

use super::WebGlRenderer;

#[derive(Clone)]
pub struct TraceGeometry {
    pub x_range: NumericRange,

    // Points and line tuff
    pub line_vertex_count: usize,
    pub line_buffer: WebGlBuffer,

    // Arc length stuff
    pub arc_pixel_ratio: (f64, f64),
    pub arc_length_buffer: WebGlBuffer,

    // Fill stuff
    pub fill_buffer: Option<(usize, WebGlBuffer)>,
}

impl TraceGeometry {
    pub fn destroy(self, ctx: &WebGl2RenderingContext) {
        ctx.delete_buffer(Some(&self.line_buffer));
        ctx.delete_buffer(Some(&self.arc_length_buffer));

        if let Some((_, buffer)) = self.fill_buffer {
            ctx.delete_buffer(Some(&buffer));
        }
    }

    pub fn is_stale(
        &self,
        bundle: &BundleRc,
        style: &TraceStyle,
        job: &RenderJobCommon,
        renderer_extents: (u32, u32),
    ) -> bool {
        let x_range = match bundle.range() {
            BundleRange::Bounded { from, to } => NumericRange::new(from, to),
            BundleRange::Everywhere => job.x_range,
        };

        if x_range != self.x_range {
            return true;
        }

        if !style.get_line().is_solid() {
            let pr_x = renderer_extents.0 as f64 / job.x_range.len();
            let pr_y = renderer_extents.1 as f64 / job.y_range.len();

            if (pr_x, pr_y) != self.arc_pixel_ratio {
                return true;
            }
        }

        match (style.fill, &self.fill_buffer) {
            (OrUnset::Set(TraceFillStyle::ToZeroY), None) => return true,
            _ => {
                // noop
            }
        }

        false
    }

    pub fn update_line(
        &mut self,
        renderer: &WebGlRenderer,
        bundle: &BundleRc,
        trace: TraceHandle,
        style: &TraceStyle,
        job: &RenderJobCommon,
    ) -> bool {
        let x_range = match bundle.range() {
            BundleRange::Bounded { from, to } => NumericRange::new(from, to),
            BundleRange::Everywhere => job.x_range,
        };

        if x_range != self.x_range {
            return false;
        }

        let data = Lazy::new(|| TraceData::compute(bundle, trace, x_range));

        if !style.get_line().is_solid() {
            let pr_x = renderer.width as f64 / job.x_range.len();
            let pr_y = renderer.height as f64 / job.y_range.len();

            if (pr_x, pr_y) != self.arc_pixel_ratio {
                renderer
                    .context
                    .delete_buffer(Some(&self.arc_length_buffer));

                let (pixel_ratio, data) = create_arc_length_buffer(renderer, &data, job);

                self.arc_pixel_ratio = pixel_ratio;
                self.arc_length_buffer = data;
            }
        }

        if let (OrUnset::Set(TraceFillStyle::ToZeroY), None) = (style.fill, &self.fill_buffer) {
            self.fill_buffer = Some(create_trace_fill_buffer(renderer, &data));
        }

        true
    }

    pub fn new_line(
        renderer: &WebGlRenderer,
        bundle: &BundleRc,
        trace: TraceHandle,
        style: &TraceStyle,
        job: &RenderJobCommon,
    ) -> Self {
        let x_range = match bundle.range() {
            BundleRange::Bounded { from, to } => NumericRange::new(from, to),
            BundleRange::Everywhere => job.x_range,
        };

        let data = TraceData::compute(bundle, trace, x_range);
        let (pixel_ratio, length_buffer) = create_arc_length_buffer(renderer, &data, job);

        Self {
            x_range,
            line_vertex_count: data.data.len(),
            line_buffer: create_trace_buffer(renderer, &data),
            arc_pixel_ratio: pixel_ratio,
            arc_length_buffer: length_buffer,
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
        bundle: &BundleRc,
        data: impl Iterator<Item = (f64, f64, f64)>,
        _style: &TraceStyle,
        job: &RenderJobCommon,
    ) -> Self {
        let x_range = match bundle.range() {
            BundleRange::Bounded { from, to } => NumericRange::new(from, to),
            BundleRange::Everywhere => job.x_range,
        };

        let mut trace = Vec::<(f32, f32)>::new();
        let mut area = Vec::<f32>::new();

        for (x, y1, y2) in data {
            area.extend([x, y1, x, y2].map(|v| v as f32));
            trace.push((x as f32, y2 as f32));
        }

        let data = TraceData { data: trace };
        let (pixel_ratio, arc_buffer) = create_arc_length_buffer(renderer, &data, job);

        Self {
            x_range,
            line_vertex_count: data.data.len(),
            line_buffer: create_trace_buffer(renderer, &data),
            arc_pixel_ratio: pixel_ratio,
            arc_length_buffer: arc_buffer,
            fill_buffer: Some((data.data.len() * 2, renderer.create_buffer(&area))),
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

fn create_trace_fill_buffer(renderer: &WebGlRenderer, trace: &TraceData) -> (usize, WebGlBuffer) {
    let mut data = Vec::<f32>::with_capacity(trace.data.len() * 4);

    for &(x, y) in trace.data.iter() {
        data.extend([x, 0., x, y]);
    }

    (trace.data.len() * 2, renderer.create_buffer(&data))
}

fn create_arc_length_buffer(
    renderer: &WebGlRenderer,
    trace: &TraceData,
    job: &RenderJobCommon,
) -> ((f64, f64), WebGlBuffer) {
    let (x_pixel_ratio, y_pixel_ratio) = (
        (renderer.width as f64) / job.x_range.len(),
        (renderer.height as f64) / job.y_range.len(),
    );

    if trace.data.is_empty() {
        return (
            (x_pixel_ratio, y_pixel_ratio),
            renderer.create_buffer(&Vec::with_capacity(0)),
        );
    }

    let lengths: Vec<f32> = {
        let (first_x, first_y) = (
            x_pixel_ratio * (trace.data[0].0 as f64 - job.x_range.from),
            y_pixel_ratio * (trace.data[0].1 as f64 - job.y_range.from),
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
                    x_pixel_ratio * (*x as f64 - job.x_range.from),
                    y_pixel_ratio * (*y as f64 - job.y_range.from),
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

    (
        (x_pixel_ratio, y_pixel_ratio),
        renderer.create_buffer(&lengths),
    )
}
