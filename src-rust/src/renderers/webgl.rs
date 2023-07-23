use std::{
    collections::HashMap,
    mem::size_of,
    ops::{Add, Mul, Sub},
};

use js_sys::Float32Array;
use lazy_static::__Deref;
use wasm_bindgen::{JsCast, JsValue};
use web_sys::{
    OffscreenCanvas, WebGl2RenderingContext, WebGlBuffer, WebGlProgram, WebGlUniformLocation,
};

use crate::{data::TraceHandle, data_module::DataModule, prelude::*, structs::RenderJob};

use super::{AxisTick, RenderJobResult};

const ROW_LEN: usize = std::mem::size_of::<u32>() * 2 + 4;

struct BufferEntry {
    points: usize,
    handle: TraceHandle,
    buffer: WebGlBuffer,
    area_buffer: Option<WebGlBuffer>,
    area_buffer_points: i32,

    width: f32,
    color: [f32; 3],
    points_mode: bool,
}

struct BufferBundle {
    from: RangePrec,
    to: RangePrec,
    buffers: Vec<BufferEntry>,
}

pub struct BundleEntry {
    handle: usize,
    width: u32,
    color: [u8; 3],
    points_mode: bool,
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
    is_area: bool,
    line_width_limit: f32,

    canvas: OffscreenCanvas,
    present_canvas: OffscreenCanvas,
    context: WebGl2RenderingContext,
    trace_buffer: WebGlBuffer,

    programs: WebGlPrograms,

    bundles_counter: usize,
    bundles: HashMap<usize, BufferBundle>,
}

impl Drop for WebGlRenderer {
    fn drop(&mut self) {
        let bundles: Vec<usize> = self.bundles.keys().cloned().collect();

        // FIXME use reference counting
        for handle in bundles {
            self.dispose_bundle(handle)
                .expect("Failed to dispose a bundle");
        }
    }
}

#[wasm_bindgen]
impl WebGlRenderer {
    #[wasm_bindgen(constructor)]
    pub fn new(
        shared_canvas: OffscreenCanvas,
        context: WebGl2RenderingContext,
        programs: WebGlPrograms,
        present_canvas: OffscreenCanvas,
        is_area_chart: bool,
    ) -> Result<WebGlRenderer, JsValue> {
        let width_range = context
            .get_parameter(WebGl2RenderingContext::ALIASED_LINE_WIDTH_RANGE)?
            .dyn_into::<Float32Array>()?;

        Ok(WebGlRenderer {
            width: present_canvas.width(),
            height: present_canvas.height(),
            canvas: shared_canvas,
            present_canvas,
            is_area: is_area_chart,
            line_width_limit: width_range.get_index(1),

            programs,

            trace_buffer: context.create_buffer().unwrap(),
            context,

            bundles_counter: 0,
            bundles: HashMap::new(),
        })
    }

    pub fn render(&mut self, module: &DataModule, job: RenderJob) -> Result<JsValue, JsValue> {
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

        gl.viewport(
            (job.margin + job.y_label_space) as i32,
            (job.margin + job.x_label_space) as i32,
            (self.width - job.margin * 2 - job.y_label_space) as i32,
            (self.height - job.margin * 2 - job.x_label_space) as i32,
        );

        gl.use_program(Some(&self.programs.trace_program));
        gl.uniform2f(
            Some(&self.programs.trace_size),
            (job.x_to - job.x_from) as f32,
            (job.y_to - job.y_from) as f32,
        );
        gl.uniform2f(Some(&self.programs.trace_transform), 1.0, 0.0);

        if !job.get_bundles().is_empty() {
            for bundle in self.bundles.values() {
                gl.uniform2f(
                    Some(&self.programs.trace_origin),
                    (job.x_from - bundle.from) as f32,
                    y_from,
                );

                for row in &bundle.buffers {
                    if job.is_blacklisted(row.handle) {
                        continue;
                    }

                    if self.is_area && row.area_buffer.is_some() {
                        gl.uniform4f(
                            Some(&self.programs.trace_color),
                            row.color[0] * 0.5,
                            row.color[1] * 0.5,
                            row.color[2] * 0.5,
                            0.5,
                        );

                        gl.bind_buffer(
                            WebGl2RenderingContext::ARRAY_BUFFER,
                            row.area_buffer.as_ref(),
                        );
                        gl.vertex_attrib_pointer_with_i32(
                            0,
                            2,
                            WebGl2RenderingContext::FLOAT,
                            false,
                            0,
                            0,
                        );
                        gl.enable_vertex_attrib_array(0);
                        gl.draw_arrays(
                            WebGl2RenderingContext::TRIANGLE_STRIP,
                            0,
                            row.area_buffer_points,
                        );
                    }

                    gl.uniform4f(
                        Some(&self.programs.trace_color),
                        row.color[0],
                        row.color[1],
                        row.color[2],
                        1.0,
                    );

                    gl.bind_buffer(WebGl2RenderingContext::ARRAY_BUFFER, Some(&row.buffer));
                    gl.vertex_attrib_pointer_with_i32(
                        0,
                        2,
                        WebGl2RenderingContext::FLOAT,
                        false,
                        0,
                        0,
                    );
                    gl.enable_vertex_attrib_array(0);

                    if row.width < self.line_width_limit + 0.1 {
                        gl.line_width(row.width);
                        gl.draw_arrays(WebGl2RenderingContext::LINE_STRIP, 0, row.points as i32);
                    } else {
                        gl.line_width(1.0);
                        let start_offset = row.width / 2.0 - 0.5;
                        let amount = row.width.round() as usize;

                        for i in 0..amount {
                            gl.uniform2f(
                                Some(&self.programs.trace_csoffset),
                                0.0,
                                2.0 * (start_offset + i as f32) / self.height as f32,
                            );
                            gl.draw_arrays(
                                WebGl2RenderingContext::LINE_STRIP,
                                0,
                                row.points as i32,
                            );
                        }
                    }

                    if row.points_mode {
                        gl.draw_arrays(WebGl2RenderingContext::POINTS, 0, row.points as i32);
                    }
                }
            }
        }

        gl.uniform2f(Some(&self.programs.trace_origin), 0.0, y_from);

        if !job.get_traces().is_empty() {
            gl.bind_buffer(
                WebGl2RenderingContext::ARRAY_BUFFER,
                Some(&self.trace_buffer),
            );

            for trace in job.get_traces() {
                let n;

                gl.uniform4f(
                    Some(&self.programs.trace_color),
                    trace.color[0] as f32 / 255.0,
                    trace.color[1] as f32 / 255.0,
                    trace.color[2] as f32 / 255.0,
                    1.0,
                );
                gl.line_width(trace.width as f32);

                unsafe {
                    let data = module
                        .get_trace(trace.idx)
                        .map(|t| {
                            t.get_data_with_origin(job.x_from - 1., job.x_to + 1., job.x_from, 0.0)
                                .flat_map(|(x, y)| [x, y])
                                .collect::<Vec<_>>()
                        })
                        .expect("Invalid entry handle during bundling");

                    n = data.len() / 2;
                    let vert_array = js_sys::Float32Array::view(&data);

                    gl.buffer_data_with_array_buffer_view(
                        WebGl2RenderingContext::ARRAY_BUFFER,
                        &vert_array,
                        WebGl2RenderingContext::STATIC_DRAW,
                    );
                }

                gl.vertex_attrib_pointer_with_i32(0, 2, WebGl2RenderingContext::FLOAT, false, 0, 0);
                gl.enable_vertex_attrib_array(0);
                gl.draw_arrays(WebGl2RenderingContext::LINE_STRIP, 0, n as i32);
            }
        }

        // copy into the resulting bitmap present canvas
        render_between(&self.canvas, &self.present_canvas);

        Ok(serde_wasm_bindgen::to_value(&RenderJobResult { x_ticks, y_ticks }).unwrap())
    }

    pub fn size_changed(&mut self, width: u32, height: u32) -> Result<(), JsValue> {
        self.width = width;
        self.height = height;

        self.present_canvas.set_width(width);
        self.present_canvas.set_height(height);

        Ok(())
    }

    pub fn create_bundle_from_stream(
        &mut self,
        module: &DataModule,
        from: RangePrec,
        to: RangePrec,
        stream: &[u8],
    ) -> Result<usize, JsValue> {
        let mut vec = Vec::with_capacity(stream.len() / ROW_LEN);

        for row in stream.chunks_exact(ROW_LEN) {
            vec.push(BundleEntry {
                handle: u32::from_be_bytes(row[0..4].try_into().unwrap()) as usize,
                width: u32::from_be_bytes(row[4..8].try_into().unwrap()),
                color: row[8..11].try_into().unwrap(),
                points_mode: row[11] > 0,
            });
        }

        self.create_bundle(module, from, to, &vec)
    }

    pub fn dispose_bundle(&mut self, bundle: usize) -> Result<(), JsValue> {
        if !self.bundles.contains_key(&bundle) {
            return Ok(());
        }

        let bundle = self.bundles.remove(&bundle).unwrap();

        for row in bundle.buffers {
            self.context.delete_buffer(Some(&row.buffer));
            if row.area_buffer.is_some() {
                self.context.delete_buffer(row.area_buffer.as_ref());
            }
        }

        Ok(())
    }

    pub fn rebundle(
        &mut self,
        module: &DataModule,
        bundle: usize,
        del: &[u8],
        add: &[u8],
        modif: &[u8],
    ) -> Result<(), JsValue> {
        let mut to_add = Vec::with_capacity(add.len() / ROW_LEN);
        let mut to_mod = Vec::with_capacity(modif.len() / ROW_LEN);
        let mut to_del = Vec::with_capacity(del.len() / size_of::<usize>());

        for row in del.chunks_exact(size_of::<usize>()) {
            to_del.push(usize::from_be_bytes(row.try_into().unwrap()));
        }

        for row in add.chunks_exact(ROW_LEN) {
            to_add.push(BundleEntry {
                handle: u32::from_be_bytes(row[0..4].try_into().unwrap()) as usize,
                width: u32::from_be_bytes(row[4..8].try_into().unwrap()),
                color: row[8..11].try_into().unwrap(),
                points_mode: row[11] > 0,
            });
        }

        for row in modif.chunks_exact(ROW_LEN) {
            to_mod.push(BundleEntry {
                handle: u32::from_be_bytes(row[0..4].try_into().unwrap()) as usize,
                width: u32::from_be_bytes(row[4..8].try_into().unwrap()),
                color: row[8..11].try_into().unwrap(),
                points_mode: row[11] > 0,
            });
        }

        let b = self.bundles.get_mut(&bundle).unwrap();

        for row in to_add {
            b.buffers.push(WebGlRenderer::allocate_bundle_entry(
                &self.context,
                module,
                b.from,
                b.to,
                &row,
                None,
            )?);
        }

        b.buffers.retain(|e| !to_del.iter().any(|t| *t == e.handle));

        for row in to_mod {
            if let Some(buffer) = b.buffers.iter_mut().find(|e| e.handle == row.handle) {
                buffer.width = row.width as f32;
                buffer.color = [
                    row.color[0] as f32 / 255.0,
                    row.color[1] as f32 / 255.0,
                    row.color[2] as f32 / 255.0,
                ];
                buffer.points_mode = row.points_mode;
            }
        }

        Result::Ok(())
    }
}

impl WebGlRenderer {
    pub fn clear(&self) {
        self.context.clear_color(0.0, 0.0, 0.0, 0.0);
        self.context.clear(WebGl2RenderingContext::COLOR_BUFFER_BIT);
    }

    pub fn create_bundle(
        &mut self,
        module: &DataModule,
        from: RangePrec,
        to: RangePrec,
        data: &[BundleEntry],
    ) -> Result<usize, JsValue> {
        let mut vec = Vec::with_capacity(data.len());
        let mut area_adder = if self.is_area && !data.is_empty() {
            module.get_trace(data[0].handle).map(|d| {
                d.get_data_with_origin(from, to, from, 0.0)
                    .map(|p| (p.0, 0.0))
                    .collect()
            })
        } else {
            None
        };

        for row in data {
            vec.push(WebGlRenderer::allocate_bundle_entry(
                &self.context,
                module,
                from,
                to,
                row,
                area_adder.as_mut(),
            )?);
        }

        let handle = self.bundles_counter;
        self.bundles_counter += 1;
        self.bundles.insert(
            handle,
            BufferBundle {
                from,
                to,
                buffers: vec,
            },
        );

        Ok(handle)
    }

    pub fn render_axes(&self, job: &RenderJob, x_ticks: &[AxisTick], y_ticks: &[AxisTick]) {
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

        let graph_left = (job.y_label_space + job.margin) as f32;
        let graph_bottom = (job.x_label_space + job.margin) as f32;
        let graph_top = (self.height - job.margin) as f32;
        let graph_right = (self.width - job.margin) as f32;

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

    pub fn render_grid(&self, job: &RenderJob, x_ticks: &[AxisTick], y_ticks: &[AxisTick]) {
        let gl = &self.context;

        let width = (self.width - job.margin * 2 - job.y_label_space) as i32;
        let height = (self.height - job.margin * 2 - job.x_label_space) as i32;

        let data_width = job.x_to - job.x_from;
        let data_height = job.y_to - job.y_from;

        gl.viewport(
            (job.margin + job.y_label_space) as i32,
            (job.margin + job.x_label_space) as i32,
            width,
            height,
        );

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
                let x = ((width as RangePrec * (tick.val - job.x_from) / data_width) as f32 + 0.5)
                    .round()
                    - 0.5;

                data.push(x);
                data.push(0.0);
                data.push(x);
                data.push(height as f32);
            }

            for tick in y_ticks {
                let y = ((height as RangePrec * (tick.val - job.y_from) / data_height) as f32
                    + 0.5)
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

    fn allocate_bundle_entry(
        context: &WebGl2RenderingContext,
        module: &DataModule,
        from: RangePrec,
        to: RangePrec,
        entry: &BundleEntry,
        area_add: Option<&mut Vec<(f32, f32)>>,
    ) -> Result<BufferEntry, JsValue> {
        let buffer =
            match context.create_buffer() {
                Some(b) => b,
                _ => return Result::Err(JsValue::from_str(
                    "Failed to allocate a buffer, perhaps the WebGL context has been destroyed.",
                )),
            };

        let mut data: Vec<(f32, f32)> = module
            .get_trace(entry.handle)
            .map(|t| t.get_data_with_origin(from, to, from, 0.0).collect())
            .expect("Invalid entry handle during bundling");

        if let Some(ref area) = area_add {
            for (data, area) in data.iter_mut().zip(area.deref()) {
                data.1 += area.1;
            }
        }

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

        let area_buffer = if let Some(area) = area_add {
            let a_buffer = match context.create_buffer() {
                Some(b) => b,
                _ => return Result::Err(JsValue::from_str(
                    "Failed to allocate a buffer, perhaps the WebGL context has been destroyed.",
                )),
            };

            let mut to_push: Vec<(f32, f32)> = vec![area[0]];

            for i in 0..(area.len() - 1) {
                let (x0, _) = area[i];
                let (x1, prev1) = area[i + 1];
                let (_, y0) = data[i];
                let (_, y1) = data[i + 1];

                to_push.extend([(x1, prev1), (x0, y0), (x1, y1), (x1, prev1)]);

                area[i] = (x0, y0);
            }

            {
                let last_idx = area.len() - 1;
                area[last_idx] = (area[last_idx].0, area[last_idx].1 + data[last_idx].1);
            }

            context.bind_buffer(WebGl2RenderingContext::ARRAY_BUFFER, Some(&a_buffer));
            context.buffer_data_with_array_buffer_view(
                WebGl2RenderingContext::ARRAY_BUFFER,
                unsafe {
                    &js_sys::Float32Array::view(core::slice::from_raw_parts(
                        std::mem::transmute(to_push.as_ptr()),
                        to_push.len() * 2,
                    ))
                },
                WebGl2RenderingContext::STATIC_DRAW,
            );

            Some(a_buffer)
        } else {
            None
        };

        Ok(BufferEntry {
            points: data.len(),
            handle: entry.handle,
            buffer,
            area_buffer,
            area_buffer_points: (data.len() as i32 - 1) * 4 + 1,
            width: entry.width as f32,
            color: [
                entry.color[0] as f32 / 255.0,
                entry.color[1] as f32 / 255.0,
                entry.color[2] as f32 / 255.0,
            ],
            points_mode: entry.points_mode,
        })
    }
}

mod webgl_utils {
    use crate::{prelude::*, renderers::AxisTick};

    pub fn calc_ticks(start: RangePrec, width: RangePrec) -> Box<[AxisTick]> {
        const SIZES: [RangePrec; 4] = [1.0, 2.0, 5.0, 10.0];

        let mut y0: RangePrec = 0.0;
        let mut dy: RangePrec = 1.0;

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
                val: y0 + dy * i as RangePrec,
                pos: (y0 + dy * i as RangePrec - start) / width,
            })
            .collect()
    }
}

use wasm_bindgen::prelude::*;
#[wasm_bindgen(module = "/src/renderers/webgl.ts")]
extern "C" {
    fn render_between(source: &OffscreenCanvas, target: &OffscreenCanvas);
}

#[derive(Clone, Copy)]
struct Vec2 {
    pub x: f32,
    pub y: f32,
}

#[allow(dead_code)]
impl Vec2 {
    fn new(x: f32, y: f32) -> Self {
        Vec2 { x, y }
    }

    fn rotate_90(self) -> Self {
        Self::new(-self.y, self.x)
    }

    fn len_sq(&self) -> f32 {
        self.dot(self)
    }

    fn dot(&self, b: &Self) -> f32 {
        self.x * b.x + self.y * b.y
    }

    fn normalize(self) -> Self {
        let inv_len = 1.0 / self.len_sq().sqrt();

        self * inv_len
    }
}

impl From<(f32, f32)> for Vec2 {
    fn from((x, y): (f32, f32)) -> Self {
        Self::new(x, y)
    }
}

impl Mul<f32> for Vec2 {
    type Output = Vec2;

    fn mul(self, rhs: f32) -> Self::Output {
        Vec2::new(self.x * rhs, self.y * rhs)
    }
}

impl Add<Vec2> for Vec2 {
    type Output = Vec2;

    fn add(self, rhs: Vec2) -> Self::Output {
        Vec2::new(self.x + rhs.x, self.y + rhs.y)
    }
}

impl Sub<Vec2> for Vec2 {
    type Output = Vec2;

    fn sub(self, rhs: Vec2) -> Self::Output {
        Vec2::new(self.x - rhs.x, self.y - rhs.y)
    }
}
