mod render_job;
mod trace;
mod trace_geometry;

use std::collections::HashMap;

use wasm_bindgen::{prelude::*, JsValue};
use web_sys::{
    OffscreenCanvas, WebGl2RenderingContext, WebGlBuffer, WebGlProgram, WebGlUniformLocation,
};

use crate::{
    data::{BundleHandle, TraceHandle},
    structs::AdaptiveGrid,
    trace::{extensions::PointIteratorExtension, BundleRange, BundleRc, BundleWeak},
    trace_styles::TraceStyle,
    types::NumericRange,
};

use super::RenderJobCommon;
use render_job::*;
use trace_geometry::*;

pub const MAX_LINE_WIDTH: i32 = 16;

#[wasm_bindgen(module = "/src/renderers/webgl/webgl.js")]
extern "C" {
    fn render_between(source: &OffscreenCanvas, target: &OffscreenCanvas);
}

#[derive(Clone)]
#[wasm_bindgen]
pub struct WebGlPrograms {
    trace_program: WebGlProgram,

    /// Scaling of trace data.
    trace_transform: WebGlUniformLocation,

    /// The origin point of trace data.
    trace_origin: WebGlUniformLocation,

    /// The rendered data range in numerical units.
    range: WebGlUniformLocation,

    /// Offset in pixels for brush rendering.
    trace_pixel_offset: u32,

    /// The color of the trace.
    trace_color: WebGlUniformLocation,

    /// The dash gap length in pixels array.
    dash_gap_length: WebGlUniformLocation,

    /// The viewport resolution in pixels.
    resolution: WebGlUniformLocation,
}

#[wasm_bindgen]
impl WebGlPrograms {
    #[allow(clippy::too_many_arguments)]
    #[wasm_bindgen(constructor)]
    pub fn new(
        trace_program: WebGlProgram,
        trace_transform: WebGlUniformLocation,
        trace_origin: WebGlUniformLocation,
        range: WebGlUniformLocation,
        trace_pixel_offset: u32,
        trace_color: WebGlUniformLocation,
        dash_gap_length: WebGlUniformLocation,
        resolution: WebGlUniformLocation,
    ) -> WebGlPrograms {
        WebGlPrograms {
            trace_program,
            trace_transform,
            trace_origin,
            range,
            trace_pixel_offset,
            trace_color,
            dash_gap_length,
            resolution,
        }
    }
}

#[wasm_bindgen]
pub struct WebGlRenderer {
    width: u32,
    height: u32,

    canvas: OffscreenCanvas,
    present_canvas: OffscreenCanvas,
    context: WebGl2RenderingContext,
    programs: WebGlPrograms,

    brushpoint_buffer: WebGlBuffer,
    brush_indices: Vec<(i32, i32)>,

    geometry_cache: HashMap<(BundleHandle, TraceHandle), TraceGeometry>,
    stack_cache: HashMap<isize, Vec<(BundleWeak, TraceHandle, TraceGeometry)>>,
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
        context.enable(WebGl2RenderingContext::BLEND);
        context.blend_func(
            WebGl2RenderingContext::SRC_ALPHA,
            WebGl2RenderingContext::ONE_MINUS_SRC_ALPHA,
        );

        let brushpoint_buffer = context.create_buffer().unwrap();

        context.bind_buffer(
            WebGl2RenderingContext::ARRAY_BUFFER,
            Some(&brushpoint_buffer),
        );

        // Preallocate the brushpoint buffer
        let brush_indices = {
            let (points, indices) = generate_concentric_brush_points(MAX_LINE_WIDTH);

            unsafe {
                context.buffer_data_with_array_buffer_view(
                    WebGl2RenderingContext::ARRAY_BUFFER,
                    &js_sys::Float32Array::view(&points),
                    WebGl2RenderingContext::STATIC_DRAW,
                );
            }

            indices
        };

        Ok(WebGlRenderer {
            width: present_canvas.width(),
            height: present_canvas.height(),
            canvas: shared_canvas,
            present_canvas,

            geometry_cache: HashMap::new(),
            stack_cache: HashMap::new(),

            brushpoint_buffer,
            brush_indices,

            programs: programs.clone(),

            // trace_buffer: context.create_buffer().unwrap(),
            context,
        })
    }

    pub fn render(&mut self, job: WebGlRenderJob) {
        let gl = &self.context;

        let y_from = job.common.y_range.from as f32;

        gl.viewport(0, 0, (self.width) as i32, (self.height) as i32);

        gl.use_program(Some(&self.programs.trace_program));
        gl.uniform2f(
            Some(&self.programs.range),
            job.common.x_range.len() as f32,
            job.common.y_range.len() as f32,
        );
        gl.uniform2f(Some(&self.programs.trace_transform), 1.0, 0.0);
        gl.uniform2f(
            Some(&self.programs.resolution),
            self.width as f32,
            self.height as f32,
        );

        let context = RenderContext {
            renderer: self,
            job: &job,

            vertex_position_ptr: gl
                .get_attrib_location(&self.programs.trace_program, "aVertexPosition")
                as u32,
            length_along_ptr: gl.get_attrib_location(&self.programs.trace_program, "aLengthAlong")
                as u32,
        };

        for trace in job.get_traces() {
            trace.render(&context);
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

    pub fn clear(&self) {
        self.context.clear_color(0.0, 0.0, 0.0, 0.0);
        self.context.clear(WebGl2RenderingContext::COLOR_BUFFER_BIT);
    }
}

impl WebGlRenderer {
    pub fn get_trace_geometry(
        &mut self,
        bundle: &BundleRc,
        trace_handle: TraceHandle,
        style: &TraceStyle,
        job: &RenderJobCommon,
    ) -> TraceGeometry {
        match self
            .geometry_cache
            .get_mut(&(bundle.handle(), trace_handle))
        {
            Some(geometry) => {
                if !geometry.is_stale(bundle, style, job, (self.width, self.height)) {
                    return geometry.clone();
                } else {
                    let mut geometry = geometry.clone();

                    if geometry.update_line(self, bundle, trace_handle, style, job) {
                        self.geometry_cache
                            .insert((bundle.handle(), trace_handle), geometry.clone());

                        return geometry;
                    }
                }
            }
            _ => {
                // continue
            }
        }

        let geometry = TraceGeometry::new_line(self, bundle, trace_handle, style, job);

        if let Some(prev) = self
            .geometry_cache
            .insert((bundle.handle(), trace_handle), geometry.clone())
        {
            prev.destroy(&self.context);
        }

        geometry
    }

    pub fn get_stacked_trace_geometry(
        &mut self,
        bundle: &BundleRc,
        trace: TraceHandle,
        style: &TraceStyle,
        job: &RenderJobCommon,
        (stack_id, in_stack_idx, grid): (isize, usize, &mut AdaptiveGrid),
    ) -> TraceGeometry {
        {
            let stack_cache = self.stack_cache.entry(stack_id).or_default();

            if let Some((prev_bundle, trace_handle, geometry)) = stack_cache.get(in_stack_idx) {
                if prev_bundle == bundle
                    && trace_handle == &trace
                    && !geometry.is_stale(bundle, style, job, (self.width, self.height))
                {
                    // Reuse geometry if valid
                    return geometry.clone();
                }

                // Empty the rest of the stack (must be stale)
                stack_cache
                    .drain(in_stack_idx..)
                    .for_each(|(_, _, g)| g.destroy(&self.context));
            }

            // Insert previous data into the grid
            if grid.layer_count() < in_stack_idx {
                stack_cache[0..in_stack_idx]
                    .iter()
                    .for_each(|(bundle, trace, _)| {
                        let bundle = bundle.upgrade().unwrap();

                        let x_range = match bundle.range() {
                            BundleRange::Bounded { from, to } => NumericRange::new(from, to),
                            BundleRange::Everywhere => job.x_range,
                        };

                        let data = bundle
                            .iter_in_range_with_neighbors_f64(*trace, x_range)
                            .with_origin_at(x_range.from, 0.0);

                        grid.sum_add_points(data).count();
                    });
            }
        }

        let x_range = match bundle.range() {
            BundleRange::Bounded { from, to } => NumericRange::new(from, to),
            BundleRange::Everywhere => job.x_range,
        };

        // Calculate the next curve in the stack
        let data = bundle
            .iter_in_range_with_neighbors_f64(trace, x_range)
            .with_origin_at(x_range.from, 0.0);

        let estimate = Some(bundle.point_count().max(grid.point_count()));

        let geometry = TraceGeometry::new_area(
            self,
            bundle,
            grid.sum_add_points(data),
            estimate,
            style,
            job,
        );

        self.stack_cache.get_mut(&stack_id).unwrap().push((
            bundle.downgrade(),
            trace,
            geometry.clone(),
        ));

        geometry
    }

    pub fn create_buffer(&self, data: &[f32]) -> WebGlBuffer {
        let context = &self.context;
        let buffer = context.create_buffer().unwrap();
        context.bind_buffer(WebGl2RenderingContext::ARRAY_BUFFER, Some(&buffer));
        context.buffer_data_with_array_buffer_view(
            WebGl2RenderingContext::ARRAY_BUFFER,
            unsafe { &js_sys::Float32Array::view(data) },
            WebGl2RenderingContext::STATIC_DRAW,
        );

        buffer
    }
}

pub struct RenderContext<'a> {
    pub renderer: &'a WebGlRenderer,
    pub job: &'a WebGlRenderJob,

    pub vertex_position_ptr: u32,
    pub length_along_ptr: u32,
}

fn generate_concentric_brush_points(max_width: i32) -> (Vec<f32>, Vec<(i32, i32)>) {
    let mut points = Vec::new();
    let mut ranges = vec![(0, 0); max_width as usize];

    points.extend([0., 0.]);
    ranges[0] = (0, 1);

    for i in 2..=max_width {
        let start = points.len() as i32 / 2;

        let diameter = i as f32 / 2.;
        let point_count = 2 + i;

        points.extend([0., 0.]);

        for j in 0..point_count {
            let angle = 2. * std::f32::consts::PI * j as f32 / point_count as f32;
            points.extend([diameter * angle.cos(), diameter * angle.sin()]);
        }

        ranges[i as usize - 1] = (start, points.len() as i32 / 2);
    }

    (points, ranges)
}
