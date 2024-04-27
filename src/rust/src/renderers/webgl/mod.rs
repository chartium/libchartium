mod render_job;
mod trace_geometry;

use std::collections::HashMap;

use js_sys::Float32Array;
use wasm_bindgen::{prelude::*, JsCast, JsValue};
use web_sys::{OffscreenCanvas, WebGl2RenderingContext, WebGlProgram, WebGlUniformLocation};

use crate::{
    data::{BundleHandle, TraceHandle},
    renderers::webgl::trace_geometry::TraceGeometryHandle,
    trace::BoxedBundle,
    trace_styles::{TraceFillStyle, TraceLineStyle, TracePointsStyle, TraceStyle},
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

        context.enable(WebGl2RenderingContext::BLEND);
        context.blend_func(
            WebGl2RenderingContext::SRC_ALPHA,
            WebGl2RenderingContext::ONE_MINUS_SRC_ALPHA,
        );

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

        let a_position_name =
            gl.get_attrib_location(&self.programs.trace_program, "aVertexPosition") as u32;
        let a_length_along =
            gl.get_attrib_location(&self.programs.trace_program, "aLengthAlong") as u32;

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
                fill_buffer,
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

            // Set the arc length buffer
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

            match (fill_buffer, style.get_fill()) {
                (Some(buffer), TraceFillStyle::ToZeroY) => {
                    gl.uniform4f(Some(&self.programs.dash_gap_length), 1.0, 0.0, 0.0, 0.0);
                    gl.uniform4f(
                        Some(&self.programs.trace_color),
                        color[0],
                        color[1],
                        color[2],
                        0.1 * color[3],
                    );

                    // Set the fill buffer
                    gl.bind_buffer(WebGl2RenderingContext::ARRAY_BUFFER, Some(buffer));
                    gl.vertex_attrib_pointer_with_i32(
                        a_position_name,
                        2,
                        WebGl2RenderingContext::FLOAT,
                        false,
                        0,
                        0,
                    );
                    gl.enable_vertex_attrib_array(a_position_name);
                    gl.draw_arrays(WebGl2RenderingContext::TRIANGLE_STRIP, 0, 2 * points);
                }
                _ => {
                    // noop
                }
            }

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
            // Set the line buffer
            gl.bind_buffer(WebGl2RenderingContext::ARRAY_BUFFER, Some(line_buffer));
            gl.vertex_attrib_pointer_with_i32(
                a_position_name,
                2,
                WebGl2RenderingContext::FLOAT,
                false,
                0,
                0,
            );
            gl.enable_vertex_attrib_array(a_position_name);

            // // REMOVE
            // gl.vertex_attrib_pointer_with_i32(0, 2, WebGl2RenderingContext::FLOAT, false, 0, 0);
            // gl.enable_vertex_attrib_array(0);
            // // END REMOVE

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

        let geometry = TraceGeometry::new_line(self, data, &style, x_range, y_range);

        if let Some(prev) = self
            .geometry_cache
            .insert((bundle_handle, trace_handle), geometry.clone())
        {
            prev.destroy(&self.context);
        }

        TraceGeometryHandle(geometry)
    }
}

impl WebGlRenderer {
    pub fn clear(&self) {
        self.context.clear_color(0.0, 0.0, 0.0, 0.0);
        self.context.clear(WebGl2RenderingContext::COLOR_BUFFER_BIT);
    }
}
