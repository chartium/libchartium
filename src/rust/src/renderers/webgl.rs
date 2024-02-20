use js_sys::{try_iter, Float32Array};
use num_traits::Pow;
use serde::{Deserialize, Serialize};
use wasm_bindgen::{prelude::*, JsCast, JsValue};
use web_sys::{
    OffscreenCanvas, WebGl2RenderingContext, WebGlBuffer, WebGlProgram, WebGlUniformLocation,
};

use crate::{
    data::TraceHandle,
    trace::{extensions::PointIteratorExtension, BoxedBundle},
};

use super::RenderJobResult;

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
    pub length_along: WebGlBuffer,
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

            traces: Vec::new(),
        }
    }

    pub fn add_traces(
        &mut self,
        bundle: &BoxedBundle,
        trace_count: usize,
        trace_buffers: JsValue,
        trace_styles: JsValue,
        length_alongs: JsValue,
    ) {
        let from = bundle.from();
        let to = bundle.to();
        let points = bundle.point_count();
        self.traces.reserve(trace_count);
        for ((buffer, style), length_along) in try_iter(&trace_buffers)
            .unwrap()
            .unwrap()
            .zip(try_iter(&trace_styles).unwrap().unwrap())
            .zip(try_iter(&length_alongs).unwrap().unwrap())
        {
            let buffer: WebGlBuffer = buffer.unwrap().into();
            let length_along: WebGlBuffer = length_along.unwrap().into();
            let style: TraceStyle = serde_wasm_bindgen::from_value(style.unwrap()).unwrap();

            self.traces.push(WebGlTrace {
                from,
                to,
                points,
                buffer,
                style,
                length_along,
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

#[derive(Clone)]
#[wasm_bindgen]
pub struct WebGlPrograms {
    trace_program: WebGlProgram,
    trace_transform: WebGlUniformLocation,
    trace_origin: WebGlUniformLocation,
    trace_size: WebGlUniformLocation,
    trace_csoffset: WebGlUniformLocation,
    trace_color: WebGlUniformLocation,
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
    ) -> WebGlPrograms {
        WebGlPrograms {
            trace_program,
            trace_transform,
            trace_origin,
            trace_size,
            trace_csoffset,
            trace_color,
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
    // trace_buffer: WebGlBuffer,
    programs: WebGlPrograms,
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

            programs: programs.clone(),

            // trace_buffer: context.create_buffer().unwrap(),
            context,
        })
    }

    pub fn render(&mut self, job: WebGlRenderJob) -> Result<JsValue, JsValue> {
        let gl = &self.context;

        let y_from = job.y_from as f32;

        if job.clear {
            self.clear();
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

            let a_length_along =
                gl.get_attrib_location(&self.programs.trace_program, "aLengthAlong") as u32;
            gl.bind_buffer(
                WebGl2RenderingContext::ARRAY_BUFFER,
                Some(&trace.length_along),
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
            gl.bind_buffer(WebGl2RenderingContext::ARRAY_BUFFER, Some(&trace.buffer));
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

            if trace.style.points_mode {
                gl.draw_arrays(WebGl2RenderingContext::POINTS, 0, points);
            }
        }

        gl.uniform2f(Some(&self.programs.trace_origin), 0.0, y_from);

        // copy into the resulting bitmap present canvas
        render_between(&self.canvas, &self.present_canvas);

        Ok(serde_wasm_bindgen::to_value(&RenderJobResult {}).unwrap())
    }

    pub fn set_size(&mut self, width: u32, height: u32) -> Result<(), JsValue> {
        self.width = width;
        self.height = height;

        self.present_canvas.set_width(width);
        self.present_canvas.set_height(height);

        Ok(())
    }

    pub fn create_lengths_along_buffer(
        &self,
        context: &WebGl2RenderingContext,
        bundle: &BoxedBundle,
        trace: TraceHandle,
        x_from: f64,
        x_to: f64,
        y_from: f64,
        y_to: f64,
    ) -> WebGlBuffer {
        let from = bundle.from();
        let to = bundle.to();
        // FIXME data already gets calculated in `create_trace_buffer`; if performance is an issue maybe try getting rid of this redundancy
        let data: Vec<(f64, f64)> = bundle
            .unwrap()
            .iter_in_range_f64(trace, from, to)
            .with_origin_at(from, 0.0)
            .collect();

        #[derive(Clone, Debug)]
        struct State {
            length_so_far: f64,
            last_x: f64,
            last_y: f64,
        }

        let (last_x, last_y) = (
            ((self.width as f64) * (data[0].0 - x_from) / (x_to - x_from)),
            ((self.height as f64) * (data[0].1 - y_from) / (y_to - y_from)),
        );

        let initial_state = State {
            length_so_far: 0.0,
            last_y,
            last_x,
        };

        let lengths: Vec<f32> = data
            .into_iter()
            .map(|(x, y)| {
                (
                    (self.width as f64) * (x - x_from) / (x_to - x_from),
                    (self.height as f64) * (y - y_from) / (y_to - y_from),
                )
            })
            .scan(initial_state, |state: &mut State, curr: (f64, f64)| {
                let (x, y) = curr;
                let curr_length_square: f64 = (state.last_x - x).pow(2) + (state.last_y - y).pow(2);
                return Some(State {
                    last_x: x,
                    last_y: y,
                    length_so_far: state.length_so_far + (curr_length_square).sqrt(),
                });
            })
            .map(|state| state.length_so_far as f32)
            .collect();
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

        buffer // and then give it to webgl which it will nom up like nomnomnom
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
}
