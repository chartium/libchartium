mod render_job;
mod trace_geometry;

use std::collections::HashMap;

use js_sys::Float32Array;
use wasm_bindgen::{prelude::*, JsCast, JsValue};
use web_sys::{
    OffscreenCanvas, WebGl2RenderingContext, WebGlBuffer, WebGlProgram, WebGlUniformLocation,
};

use crate::{
    data::{BundleHandle, TraceHandle},
    renderers::webgl::trace_geometry::TraceGeometryHandle,
    trace::BoxedBundle,
    trace_styles::{TraceLineStyle, TracePointsStyle, TraceStyle},
};

use super::{NumericRange, TraceData};
use render_job::*;
use trace_geometry::*;

#[wasm_bindgen(module = "/src/renderers/webgl/webgl.ts")]
extern "C" {
    fn render_between(source: &OffscreenCanvas, target: &OffscreenCanvas);
}

#[derive(Clone)]
#[wasm_bindgen]
pub struct WebGlPrograms {
    trace_program: WebGlProgram,
    trace_transform: WebGlUniformLocation,
    trace_origin: WebGlUniformLocation,
    trace_size: WebGlUniformLocation,
    trace_csoffset: WebGlUniformLocation,
    trace_color: WebGlUniformLocation,
    dash_gap_length: WebGlUniformLocation,
}

#[wasm_bindgen]
impl WebGlPrograms {
    #[allow(clippy::too_many_arguments)]
    #[wasm_bindgen(constructor)]
    pub fn new(
        trace_program: WebGlProgram,
        trace_transform: WebGlUniformLocation,
        trace_origin: WebGlUniformLocation,
        trace_size: WebGlUniformLocation,
        trace_csoffset: WebGlUniformLocation,
        trace_color: WebGlUniformLocation,
        dash_gap_length: WebGlUniformLocation,
    ) -> WebGlPrograms {
        WebGlPrograms {
            trace_program,
            trace_transform,
            trace_origin,
            trace_size,
            trace_csoffset,
            trace_color,
            dash_gap_length,
        }
    }
}

#[wasm_bindgen]
pub struct WebGlRenderer {
    width: u32,
    height: u32,
    line_width_limit: f32,

    canvas: OffscreenCanvas,
    present_canvas: OffscreenCanvas,
    context: WebGl2RenderingContext,
    programs: WebGlPrograms,

    geometry_cache: HashMap<(BundleHandle, TraceHandle), TraceGeometry>,
}

#[wasm_bindgen]
impl WebGlRenderer {
    #[wasm_bindgen(constructor)]
    pub fn new(
        shared_canvas: OffscreenCanvas,
        context: WebGl2RenderingContext,
        programs: &WebGlPrograms,
        present_canvas: OffscreenCanvas,
    ) -> Result<WebGlRenderer, JsValue> {
        let width_range = context
            .get_parameter(WebGl2RenderingContext::ALIASED_LINE_WIDTH_RANGE)?
            .dyn_into::<Float32Array>()?;

        Ok(WebGlRenderer {
            width: present_canvas.width(),
            height: present_canvas.height(),
            canvas: shared_canvas,
            present_canvas,
            line_width_limit: width_range.get_index(1),

            geometry_cache: HashMap::new(),

            programs: programs.clone(),

            // trace_buffer: context.create_buffer().unwrap(),
            context,
        })
    }

    pub fn render(&mut self, job: WebGlRenderJob) {
        let gl = &self.context;

        let y_from = job.common.y_range.from as f32;

        if job.common.clear {
            self.clear();
        }

        gl.viewport(0, 0, (self.width) as i32, (self.height) as i32);

        gl.use_program(Some(&self.programs.trace_program));
        gl.uniform2f(
            Some(&self.programs.trace_size),
            job.common.x_range.len() as f32,
            job.common.y_range.len() as f32,
        );
        gl.uniform2f(Some(&self.programs.trace_transform), 1.0, 0.0);

        for trace in job.get_traces() {
            let style = &trace.style;
            let width = style.get_line_width() as f32;
            let color = trace.color.as_floats();
            let line = style.get_line();

            let TraceGeometry::Line {
                points,
                x_range,
                line_buffer,
                arc_length_buffer,
                ..
            } = &trace.geometry.0
            else {
                continue;
            };

            let points = *points as i32;

            gl.uniform2f(
                Some(&self.programs.trace_origin),
                (job.common.x_range.from - x_range.from) as f32,
                y_from,
            );

            gl.uniform4f(
                Some(&self.programs.trace_color),
                color[0],
                color[1],
                color[2],
                color[3],
            );

            match line {
                TraceLineStyle::None => {
                    gl.uniform4f(Some(&self.programs.dash_gap_length), 0.0, 1.0, 0.0, 0.0)
                }
                TraceLineStyle::Solid => {
                    gl.uniform4f(Some(&self.programs.dash_gap_length), 1.0, 0.0, 0.0, 0.0)
                }
                TraceLineStyle::Dashed([dash, gap]) => gl.uniform4f(
                    Some(&self.programs.dash_gap_length),
                    *dash,
                    *gap,
                    *dash,
                    *gap,
                ),
                TraceLineStyle::DoubleDashed([first_dash, first_gap, second_dash, second_gap]) => {
                    gl.uniform4f(
                        Some(&self.programs.dash_gap_length),
                        *first_dash,
                        *first_gap,
                        *second_dash,
                        *second_gap,
                    )
                }
            }

            let a_length_along =
                gl.get_attrib_location(&self.programs.trace_program, "aLengthAlong") as u32;
            gl.bind_buffer(
                WebGl2RenderingContext::ARRAY_BUFFER,
                Some(arc_length_buffer),
            );
            gl.vertex_attrib_pointer_with_i32(
                a_length_along,
                1,
                WebGl2RenderingContext::FLOAT,
                false,
                0,
                0,
            );
            gl.enable_vertex_attrib_array(a_length_along);
            let a_position_name =
                gl.get_attrib_location(&self.programs.trace_program, "aVertexPosition") as u32;
            gl.bind_buffer(WebGl2RenderingContext::ARRAY_BUFFER, Some(line_buffer));

            // // REMOVE
            // gl.vertex_attrib_pointer_with_i32(0, 2, WebGl2RenderingContext::FLOAT, false, 0, 0);
            // gl.enable_vertex_attrib_array(0);
            // // END REMOVE

            gl.vertex_attrib_pointer_with_i32(
                a_position_name,
                2,
                WebGl2RenderingContext::FLOAT,
                false,
                0,
                0,
            );
            gl.enable_vertex_attrib_array(a_position_name);

            if width < self.line_width_limit + 0.1 {
                gl.line_width(width);
                gl.draw_arrays(WebGl2RenderingContext::LINE_STRIP, 0, points);
            } else {
                gl.line_width(1.0);
                let start_offset = width / 2.0 - 0.5;
                let amount = width.round() as usize;

                for i in 0..amount {
                    gl.uniform2f(
                        Some(&self.programs.trace_csoffset),
                        0.0,
                        2.0 * (start_offset + i as f32) / self.height as f32,
                    );
                    gl.draw_arrays(WebGl2RenderingContext::LINE_STRIP, 0, points);
                }
            }

            if matches!(style.get_points(), TracePointsStyle::Show) {
                gl.draw_arrays(WebGl2RenderingContext::POINTS, 0, points);
            }
        }

        gl.uniform2f(Some(&self.programs.trace_origin), 0.0, y_from);

        // copy into the resulting bitmap present canvas
        render_between(&self.canvas, &self.present_canvas);
    }

    pub fn set_size(&mut self, width: u32, height: u32) -> Result<(), JsValue> {
        self.width = width;
        self.height = height;

        self.present_canvas.set_width(width);
        self.present_canvas.set_height(height);

        Ok(())
    }

    pub fn get_trace_geometry(
        &mut self,
        bundle: &BoxedBundle,
        trace_handle: TraceHandle,
        style: TraceStyle,
        x_range: NumericRange,
        y_range: NumericRange,
    ) -> TraceGeometryHandle {
        let bundle_handle = bundle.handle();

        match self.geometry_cache.get_mut(&(bundle_handle, trace_handle)) {
            Some(geometry) if !geometry.is_stale(&style, x_range, y_range) => {
                return TraceGeometryHandle(geometry.clone());
            }
            _ => {
                // continue
            }
        }

        let data = TraceData::compute(bundle, trace_handle, x_range);

        let geometry = TraceGeometry::Line {
            points: data.data.len(),
            x_range,
            y_range,
            line_buffer: self.create_trace_buffer(&data),
            arc_length_buffer: self.create_arc_length_buffer(&data, x_range, y_range),
        };

        if let Some(prev) = self
            .geometry_cache
            .insert((bundle_handle, trace_handle), geometry.clone())
        {
            prev.destroy(&self.context);
        }

        TraceGeometryHandle(geometry)
    }

    fn create_trace_buffer(&self, trace: &TraceData) -> WebGlBuffer {
        let context = &self.context;
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

    fn create_arc_length_buffer(
        &self,
        trace: &TraceData,
        display_x_range: NumericRange,
        display_y_range: NumericRange,
    ) -> WebGlBuffer {
        let context = &self.context;

        let lengths: Vec<f32> = if trace.data.is_empty() {
            Vec::with_capacity(0)
        } else {
            let (x_pixel_ratio, y_pixel_ratio) = (
                (self.width as f64) / display_x_range.len(),
                (self.height as f64) / display_y_range.len(),
            );

            let (first_x, first_y) = (
                x_pixel_ratio * (trace.data[0].0 as f64 - trace.x_range.from),
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
                        x_pixel_ratio * (*x as f64 - trace.x_range.from),
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
}

impl WebGlRenderer {
    pub fn clear(&self) {
        self.context.clear_color(0.0, 0.0, 0.0, 0.0);
        self.context.clear(WebGl2RenderingContext::COLOR_BUFFER_BIT);
    }
}