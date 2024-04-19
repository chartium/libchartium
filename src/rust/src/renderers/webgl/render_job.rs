use js_sys::wasm_bindgen::prelude::*;

use crate::{renderers::RenderJobCommon, trace_styles::TraceStyle, utils::ResolvedColor};

use super::TraceGeometryHandle;

pub struct WebGlTrace {
    pub style: TraceStyle,
    pub color: ResolvedColor,
    pub geometry: TraceGeometryHandle,
}

#[wasm_bindgen]
pub struct WebGlRenderJob {
    pub(super) common: RenderJobCommon,
    pub(super) traces: Vec<WebGlTrace>,
}

#[wasm_bindgen]
impl WebGlRenderJob {
    #[wasm_bindgen(constructor)]
    pub fn new(common: RenderJobCommon) -> Self {
        Self {
            common,
            traces: Vec::new(),
        }
    }

    pub fn add_trace(
        &mut self,
        style: TraceStyle,
        color: ResolvedColor,
        geometry: TraceGeometryHandle,
    ) {
        self.traces.push(WebGlTrace {
            style,
            color,
            geometry,
        });
    }
}

impl WebGlRenderJob {
    pub fn get_traces(&self) -> &Vec<WebGlTrace> {
        &self.traces
    }
}
