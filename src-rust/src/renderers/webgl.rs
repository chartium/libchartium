use js_sys::{try_iter, Float32Array};
use serde::{Deserialize, Serialize};
use wasm_bindgen::{prelude::*, JsCast, JsValue};
use web_sys::{
    OffscreenCanvas, WebGl2RenderingContext, WebGlBuffer, WebGlProgram, WebGlUniformLocation,
};

use crate::{
    data::TraceHandle,
    trace::{extensions::PointIteratorExtension, BoxedBundle},
};

use super::{AxisTick, RenderJobResult};

#[wasm_bindgen(module = "/src/renderers/webgl.ts")]
extern "C" {
    fn render_between(source: &OffscreenCanvas, target: &OffscreenCanvas);
}

pub struct WebGlTrace {
    pub from: f64,
    pub to: f64,
    pub points: usize,
    pub buffer: WebGlBuffer,
    pub style: TraceStyle,
}

fn color_to_webgl(color: [u8; 3]) -> [f32; 3] {
    [
        color[0] as f32 / 255.0,
        color[1] as f32 / 255.0,
        color[2] as f32 / 255.0,
    ]
}

#[wasm_bindgen]
#[derive(Clone, Serialize, Deserialize)]
pub struct TraceStyle {
    width: u32,
    color: [u8; 3],
    points_mode: bool,
}

#[wasm_bindgen]
impl TraceStyle {
    #[wasm_bindgen(constructor)]
    pub fn new(width: u32, red: u8, green: u8, blue: u8, points_mode: bool) -> TraceStyle {
        TraceStyle {
            width,
            color: [red, green, blue],
            points_mode,
        }
    }
}

#[wasm_bindgen]
pub struct WebGlRenderJob {
    pub clear: bool,

    x_type: String,

    pub x_from: f64,
    pub x_to: f64,
    pub y_from: f64,
    pub y_to: f64,

    pub dark_mode: bool,
    pub render_grid: bool,
    pub render_axes: bool,

    traces: Vec<WebGlTrace>,
}

#[wasm_bindgen]
impl WebGlRenderJob {
    #[wasm_bindgen(constructor)]
    pub fn new(x_type: String) -> Self {
        Self {
            clear: true,

            x_type,

            x_from: 0.0,
            x_to: 0.0,
            y_from: 0.0,
            y_to: 0.0,

            dark_mode: false,
            render_axes: true,
            render_grid: true,

            traces: Vec::new(),
        }
    }

    pub fn add_traces(
        &mut self,
        bundle: &BoxedBundle,
        trace_count: usize,
        trace_buffers: JsValue,
        trace_styles: JsValue,
    ) {
        let from = bundle.from();
        let to = bundle.to();
        let points = bundle.point_count();

        self.traces.reserve(trace_count);
        for (buffer, style) in try_iter(&trace_buffers)
            .unwrap()
            .unwrap()
            .zip(try_iter(&trace_styles).unwrap().unwrap())
        {
            let buffer: WebGlBuffer = buffer.unwrap().into();
            let style: TraceStyle = serde_wasm_bindgen::from_value(style.unwrap()).unwrap();

            self.traces.push(WebGlTrace {
                from,
                to,
                points,
                buffer,
                style,
            });
        }
    }
}

impl WebGlRenderJob {
    pub fn get_traces(&self) -> &Vec<WebGlTrace> {
        &self.traces
    }

    pub fn get_x_type(&self) -> &String {
        &self.x_type
    }
}

#[wasm_bindgen]
pub struct WebGlPrograms {
    trace_program: WebGlProgram,
    trace_transform: WebGlUniformLocation,
    trace_origin: WebGlUniformLocation,
    trace_size: WebGlUniformLocation,
    trace_csoffset: WebGlUniformLocation,
    trace_color: WebGlUniformLocation,

    axis_program: WebGlProgram,
    axis_resolution: WebGlUniformLocation,
    axis_color: WebGlUniformLocation,
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

        axis_program: WebGlProgram,
        axis_resolution: WebGlUniformLocation,
        axis_color: WebGlUniformLocation,
    ) -> WebGlPrograms {
        WebGlPrograms {
            trace_program,
            trace_transform,
            trace_origin,
            trace_size,
            trace_csoffset,
            trace_color,

            axis_program,
            axis_resolution,
            axis_color,
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
    trace_buffer: WebGlBuffer,

    programs: WebGlPrograms,
}

#[wasm_bindgen]
impl WebGlRenderer {
    #[wasm_bindgen(constructor)]
    pub fn new(
        shared_canvas: OffscreenCanvas,
        context: WebGl2RenderingContext,
        programs: WebGlPrograms,
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

            programs,

            trace_buffer: context.create_buffer().unwrap(),
            context,
        })
    }

    pub fn render(&mut self, job: WebGlRenderJob) -> Result<JsValue, JsValue> {
        let gl = &self.context;

        let y_from = job.y_from as f32;

        let x_ticks = webgl_utils::calc_ticks(job.x_from, job.x_to - job.x_from);
        let y_ticks = webgl_utils::calc_ticks(job.y_from, job.y_to - job.y_from);

        if job.clear {
            self.clear();
        }

        if job.render_axes {
            self.render_axes(&job, &x_ticks[..], &y_ticks[..]);
        }

        if job.render_grid {
            self.render_grid(&job, &x_ticks[..], &y_ticks[..]);
        }

        gl.viewport(0, 0, (self.width) as i32, (self.height) as i32);

        gl.use_program(Some(&self.programs.trace_program));
        gl.uniform2f(
            Some(&self.programs.trace_size),
            (job.x_to - job.x_from) as f32,
            (job.y_to - job.y_from) as f32,
        );
        gl.uniform2f(Some(&self.programs.trace_transform), 1.0, 0.0);

        for trace in job.get_traces() {
            let points = trace.points as i32;
            let width = trace.style.width as f32;
            let color = color_to_webgl(trace.style.color);

            gl.uniform2f(
                Some(&self.programs.trace_origin),
                (job.x_from - trace.from) as f32,
                y_from,
            );

            gl.uniform4f(
                Some(&self.programs.trace_color),
                color[0],
                color[1],
                color[2],
                1.0,
            );

            gl.bind_buffer(WebGl2RenderingContext::ARRAY_BUFFER, Some(&trace.buffer));
            gl.vertex_attrib_pointer_with_i32(0, 2, WebGl2RenderingContext::FLOAT, false, 0, 0);
            gl.enable_vertex_attrib_array(0);

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

            if trace.style.points_mode {
                gl.draw_arrays(WebGl2RenderingContext::POINTS, 0, points);
            }
        }

        gl.uniform2f(Some(&self.programs.trace_origin), 0.0, y_from);

        // copy into the resulting bitmap present canvas
        render_between(&self.canvas, &self.present_canvas);

        Ok(serde_wasm_bindgen::to_value(&RenderJobResult { x_ticks, y_ticks }).unwrap())
    }

    pub fn set_size(&mut self, width: u32, height: u32) -> Result<(), JsValue> {
        self.width = width;
        self.height = height;

        self.present_canvas.set_width(width);
        self.present_canvas.set_height(height);

        Ok(())
    }

    pub fn create_trace_buffer(
        context: &WebGl2RenderingContext,
        bundle: &BoxedBundle,
        trace: TraceHandle,
    ) -> WebGlBuffer {
        let buffer = context.create_buffer().unwrap();
        let from = bundle.from();
        let to = bundle.to();

        let data: Vec<(f32, f32)> = bundle
            .unwrap()
            .iter_in_range_f64(trace, from, to)
            .with_origin_at(from, 0.0)
            .map(|(x, y)| (x as f32, y as f32))
            .collect();

        context.bind_buffer(WebGl2RenderingContext::ARRAY_BUFFER, Some(&buffer));
        context.buffer_data_with_array_buffer_view(
            WebGl2RenderingContext::ARRAY_BUFFER,
            unsafe {
                &js_sys::Float32Array::view(core::slice::from_raw_parts(
                    std::mem::transmute(data.as_ptr()),
                    data.len() * 2,
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

    pub fn render_axes(&self, _job: &WebGlRenderJob, x_ticks: &[AxisTick], y_ticks: &[AxisTick]) {
        let gl = &self.context;

        gl.viewport(0, 0, self.width as i32, self.height as i32);

        gl.use_program(Some(&self.programs.axis_program));
        gl.uniform2f(
            Some(&self.programs.axis_resolution),
            self.width as f32,
            self.height as f32,
        );
        gl.uniform4f(Some(&self.programs.axis_color), 0.3, 0.3, 0.3, 1.0);
        gl.bind_buffer(
            WebGl2RenderingContext::ARRAY_BUFFER,
            Some(&self.trace_buffer),
        );
        gl.line_width(2.0);

        let graph_left = 0f32;
        let graph_bottom = 0f32;
        let graph_top = self.height as f32;
        let graph_right = self.width as f32;

        unsafe {
            let data: Vec<f32> = vec![
                graph_left - 1.0,
                graph_top,
                graph_left - 1.0,
                graph_bottom - 1.0,
                graph_right,
                graph_bottom - 1.0,
            ];

            let vert_array = js_sys::Float32Array::view(&data);

            gl.buffer_data_with_array_buffer_view(
                WebGl2RenderingContext::ARRAY_BUFFER,
                &vert_array,
                WebGl2RenderingContext::STATIC_DRAW,
            );
        }

        gl.vertex_attrib_pointer_with_i32(0, 2, WebGl2RenderingContext::FLOAT, false, 0, 0);
        gl.enable_vertex_attrib_array(0);
        gl.draw_arrays(WebGl2RenderingContext::LINE_STRIP, 0, 3);

        const TICK_LEN: f32 = 4.0;
        let points = (x_ticks.len() + y_ticks.len()) * 2;

        fn lerp(from: f32, to: f32, val: f32) -> f32 {
            from + (to - from) * val
        }

        unsafe {
            let mut data: Vec<f32> = Vec::with_capacity(2 * points);

            for tick in x_ticks {
                data.push(lerp(graph_left, graph_right, tick.pos as f32));
                data.push(graph_bottom);
                data.push(lerp(graph_left, graph_right, tick.pos as f32));
                data.push(graph_bottom - TICK_LEN);
            }

            for tick in y_ticks {
                data.push(graph_left);
                data.push(lerp(graph_bottom, graph_top, tick.pos as f32));
                data.push(graph_left - TICK_LEN);
                data.push(lerp(graph_bottom, graph_top, tick.pos as f32));
            }

            let vert_array = js_sys::Float32Array::view(&data);

            gl.buffer_data_with_array_buffer_view(
                WebGl2RenderingContext::ARRAY_BUFFER,
                &vert_array,
                WebGl2RenderingContext::STATIC_DRAW,
            );
        }

        gl.draw_arrays(WebGl2RenderingContext::LINES, 0, points as i32);
    }

    pub fn render_grid(&self, job: &WebGlRenderJob, x_ticks: &[AxisTick], y_ticks: &[AxisTick]) {
        let gl = &self.context;

        let width = self.width as i32;
        let height = self.height as i32;

        let data_width = job.x_to - job.x_from;
        let data_height = job.y_to - job.y_from;

        gl.viewport(0, 0, width, height);

        gl.use_program(Some(&self.programs.trace_program));
        gl.uniform2f(Some(&self.programs.trace_origin), 0.0, 0.0);
        gl.uniform2f(Some(&self.programs.trace_size), width as f32, height as f32);
        gl.uniform2f(Some(&self.programs.trace_transform), 1.0, 0.0);

        if job.dark_mode {
            gl.uniform4f(Some(&self.programs.trace_color), 0.3, 0.3, 0.3, 1.0);
        } else {
            gl.uniform4f(Some(&self.programs.trace_color), 0.85, 0.85, 0.85, 1.0);
        }

        gl.line_width(1.0);

        gl.bind_buffer(
            WebGl2RenderingContext::ARRAY_BUFFER,
            Some(&self.trace_buffer),
        );
        let points = (x_ticks.len() + y_ticks.len()) * 2;

        unsafe {
            let mut data: Vec<f32> = Vec::with_capacity(2 * points);

            for tick in x_ticks {
                let x = ((width as f64 * (tick.val - job.x_from) / data_width) as f32 + 0.5)
                    .round()
                    - 0.5;

                data.push(x);
                data.push(0.0);
                data.push(x);
                data.push(height as f32);
            }

            for tick in y_ticks {
                let y = ((height as f64 * (tick.val - job.y_from) / data_height) as f32 + 0.5)
                    .round()
                    - 0.5;

                data.push(0.0);
                data.push(y);
                data.push(width as f32);
                data.push(y);
            }

            let vert_array = js_sys::Float32Array::view(&data);

            gl.buffer_data_with_array_buffer_view(
                WebGl2RenderingContext::ARRAY_BUFFER,
                &vert_array,
                WebGl2RenderingContext::STATIC_DRAW,
            );
        }

        gl.vertex_attrib_pointer_with_i32(0, 2, WebGl2RenderingContext::FLOAT, false, 0, 0);
        gl.enable_vertex_attrib_array(0);
        gl.draw_arrays(WebGl2RenderingContext::LINES, 0, points as i32);
    }
}

mod webgl_utils {
    use crate::renderers::AxisTick;

    pub fn calc_ticks(start: f64, width: f64) -> Box<[AxisTick]> {
        const SIZES: [f64; 4] = [1.0, 2.0, 5.0, 10.0];

        let mut y0: f64 = 0.0;
        let mut dy: f64 = 1.0;

        {
            let order = width.log10().floor() - 1.0;

            for size in SIZES.iter() {
                dy = 10.0_f64.powf(order) * size;
                y0 = (start / dy).floor() * dy;

                if (width + start - y0) / dy < 10.0 {
                    break;
                }
            }
        }

        (1..=((width + start - y0) / dy).floor() as usize)
            .map(|i| AxisTick {
                val: y0 + dy * i as f64,
                pos: (y0 + dy * i as f64 - start) / width,
            })
            .collect()
    }
}
