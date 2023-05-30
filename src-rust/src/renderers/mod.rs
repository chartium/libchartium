mod webgl;
use std::{convert::TryInto, mem::size_of};

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use web_sys::OffscreenCanvas;

use crate::{data_module::DataModule, prelude::*, structs::RenderJob};
pub use webgl::WebGlRenderer;

pub struct BundleEntry {
    handle: usize,
    width: u32,
    color: [u8; 3],
    points_mode: bool,
}

#[derive(Serialize, Deserialize)]
pub struct AxisTick {
    val: RangePrec,
    pos: RangePrec,
}

#[derive(Serialize, Deserialize)]
pub struct RenderJobResult {
    x_ticks: Box<[AxisTick]>,
    y_ticks: Box<[AxisTick]>,
}

pub trait Renderer {
    fn render(&mut self, module: &DataModule, job: RenderJob) -> Result<RenderJobResult, JsValue>;
    fn present(&mut self) -> Result<(), JsValue>;
    fn size_changed(&mut self, width: u32, height: u32) -> Result<(), JsValue>;
    fn create_bundle(
        &mut self,
        module: &DataModule,
        from: RangePrec,
        to: RangePrec,
        data: &[BundleEntry],
    ) -> Result<usize, JsValue>;
    fn rebundle(
        &mut self,
        module: &DataModule,
        bundle: usize,
        to_add: &[BundleEntry],
        to_del: &[crate::data::DataIdx],
        to_mod: &[BundleEntry],
    ) -> Result<(), JsValue>;
    fn dispose_bundle(&mut self, bundle: usize) -> Result<(), JsValue>;
}

#[wasm_bindgen]
pub struct RendererContainer {
    renderer: Box<dyn Renderer>,
}

#[wasm_bindgen]
pub struct RendererOptions {
    pub area_chart: bool,
}

#[wasm_bindgen]
impl RendererOptions {
    #[wasm_bindgen(constructor)]
    pub fn new(area_chart: bool) -> Self {
        Self { area_chart }
    }
}

const ROW_LEN: usize = std::mem::size_of::<u32>() * 2 + 4;

#[wasm_bindgen]
impl RendererContainer {
    pub fn new_webgl(
        shared_canvas: OffscreenCanvas,
        present_canvas: OffscreenCanvas,
        opts: RendererOptions,
    ) -> Result<RendererContainer, JsValue> {
        Ok(Self {
            renderer: Box::new(WebGlRenderer::new(shared_canvas, present_canvas, opts)?),
        })
    }

    pub fn render(&mut self, module: &DataModule, job: RenderJob) -> Result<JsValue, JsValue> {
        let result = self.renderer.render(module, job)?;
        self.renderer.present()?;

        Ok(serde_wasm_bindgen::to_value(&result).unwrap())
    }

    pub fn size_changed(&mut self, width: u32, height: u32) -> Result<(), JsValue> {
        self.renderer.size_changed(width, height)
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

        self.renderer.create_bundle(module, from, to, &vec)
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

        self.renderer
            .rebundle(module, bundle, &to_add, &to_del, &to_mod)
    }

    pub fn dispose_bundle(&mut self, bundle: usize) -> Result<(), JsValue> {
        self.renderer.dispose_bundle(bundle)
    }
}
