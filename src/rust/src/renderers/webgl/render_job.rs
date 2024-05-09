use js_sys::wasm_bindgen::prelude::*;

use crate::{
    data::TraceHandle, renderers::RenderJobCommon, structs::AdaptiveGrid, trace::BundleRc,
    trace_styles::TraceStyle, utils::ResolvedColor,
};

use super::{trace::WebGlTrace, WebGlRenderer};

#[wasm_bindgen]
pub struct WebGlRenderJob {
    pub(super) common: RenderJobCommon,
    pub(super) traces: Vec<WebGlTrace>,
    pub(super) stack: Option<(isize, usize, AdaptiveGrid)>,
}

#[wasm_bindgen]
impl WebGlRenderJob {
    #[wasm_bindgen(constructor)]
    pub fn new(common: RenderJobCommon, stack: Option<isize>) -> Self {
        Self {
            common,
            stack: stack.map(|i| (i, 0, AdaptiveGrid::new())),
            traces: Vec::new(),
        }
    }

    pub fn add_trace(
        &mut self,
        renderer: &mut WebGlRenderer,
        bundle: &BundleRc,
        handle: TraceHandle,
        style: TraceStyle,
        color: ResolvedColor,
    ) {
        if let Some((stack_id, in_stack_idx, grid)) = &mut self.stack {
            let geometry = renderer.get_stacked_trace_geometry(
                bundle,
                handle,
                &style,
                &self.common,
                (*stack_id, *in_stack_idx, grid),
            );

            *in_stack_idx += 1;

            self.traces.push(WebGlTrace {
                style,
                color,
                geometry,
            })
        } else {
            let geometry = renderer.get_trace_geometry(bundle, handle, &style, &self.common);

            self.traces.push(WebGlTrace {
                style,
                color,
                geometry,
            });
        }
    }
}

impl WebGlRenderJob {
    pub fn get_traces(&self) -> &[WebGlTrace] {
        &self.traces
    }
}
