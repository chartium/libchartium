use js_sys::wasm_bindgen::prelude::*;

use crate::{
    data::TraceHandle,
    renderers::{webgl::TraceGeometry, RenderJobCommon},
    structs::AdaptiveGrid,
    trace::{extensions::PointIteratorExtension, BoxedBundle},
    trace_styles::TraceStyle,
    utils::ResolvedColor,
};

use super::{trace::WebGlTrace, WebGlRenderer};

#[wasm_bindgen]
pub struct WebGlRenderJob {
    pub(super) common: RenderJobCommon,
    pub(super) traces: Vec<WebGlTrace>,
    pub(super) stack: Option<(isize, AdaptiveGrid)>,
}

#[wasm_bindgen]
impl WebGlRenderJob {
    #[wasm_bindgen(constructor)]
    pub fn new(common: RenderJobCommon, stack: Option<isize>) -> Self {
        Self {
            common,
            stack: stack.map(|i| (i, AdaptiveGrid::new())),
            traces: Vec::new(),
        }
    }

    pub fn add_trace(
        &mut self,
        renderer: &mut WebGlRenderer,
        bundle: &BoxedBundle,
        handle: TraceHandle,
        style: TraceStyle,
        color: ResolvedColor,
    ) {
        if let Some((_, grid)) = &mut self.stack {
            // - use an adaptive grid state
            // - add missing points by interpolating previous values
            // - interpolate missing points in new values
            // - return an iterator of (x, prev_y, new_y) to build a new triangle strip
            let data = bundle
                .unwrap()
                .iter_in_range_with_neighbors_f64(handle, self.common.x_range)
                .with_origin_at(self.common.x_range.from, 0.0);

            let geometry = TraceGeometry::new_area(
                renderer,
                grid.sum_add_points(data),
                &style,
                self.common.x_range,
                self.common.y_range,
            );

            self.traces.push(WebGlTrace {
                style,
                color,
                geometry,
            })
        } else {
            let geometry = renderer.get_trace_geometry(
                bundle,
                handle,
                &style,
                self.common.x_range,
                self.common.y_range,
            );

            self.traces.push(WebGlTrace {
                style,
                color,
                geometry,
            });
        }
    }
}

impl WebGlRenderJob {
    pub fn get_traces(&self) -> &Vec<WebGlTrace> {
        &self.traces
    }
}
