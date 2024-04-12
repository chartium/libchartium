use std::collections::HashMap;
use wasm_bindgen::prelude::wasm_bindgen;

use crate::data::TraceHandle;

use super::{
    style::{SharedTraceStyle, TraceStylePatch},
    TraceStyleSheet, TraceStyleSheetPatch,
};

#[wasm_bindgen]
pub struct TraceStyleSheetPatchBuilder {
    style_sheet: TraceStyleSheetPatch,
}

#[wasm_bindgen]
impl TraceStyleSheetPatchBuilder {
    pub fn base(base: TraceStylePatch) -> Self {
        Self {
            style_sheet: TraceStyleSheetPatch {
                base,
                traces: HashMap::new(),
            },
        }
    }

    pub fn add(&mut self, trace_handle: TraceHandle, style: TraceStylePatch) {
        self.style_sheet.traces.insert(trace_handle, style.clone());
    }

    pub fn collect(self) -> TraceStyleSheetPatch {
        self.style_sheet
    }
}

#[wasm_bindgen]
pub struct TraceStyleSheetUnionBuilder {
    style_sheet: TraceStyleSheet,
}

#[wasm_bindgen]
impl TraceStyleSheetUnionBuilder {
    #[wasm_bindgen(constructor)]
    pub fn new(first_sheet: &TraceStyleSheet) -> TraceStyleSheetUnionBuilder {
        TraceStyleSheetUnionBuilder {
            style_sheet: first_sheet.clone(),
        }
    }

    pub fn add(&mut self, trace_handles: &[TraceHandle], style_sheet: &TraceStyleSheet) {
        let base = SharedTraceStyle::from(style_sheet.base.clone());
        for &handle in trace_handles {
            self.style_sheet.traces.insert(
                handle,
                style_sheet.traces.get(&handle).unwrap_or(&base).clone(),
            );
        }
    }

    pub fn collect(self) -> TraceStyleSheet {
        self.style_sheet
    }
}
