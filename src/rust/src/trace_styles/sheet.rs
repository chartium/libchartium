use std::collections::{HashMap, HashSet};
use wasm_bindgen::prelude::wasm_bindgen;

use crate::data::TraceHandle;

use super::style::{SharedTraceStyle, TraceStyle, TraceStylePatch};

#[wasm_bindgen]
#[derive(Clone)]
pub struct TraceStyleSheet {
    pub(super) base: TraceStyle,
    pub(super) traces: HashMap<TraceHandle, SharedTraceStyle>,
}

#[wasm_bindgen]
#[derive(Clone)]
pub struct TraceStyleSheetPatch {
    pub(super) base: TraceStylePatch,
    pub(super) traces: HashMap<TraceHandle, TraceStylePatch>,
}

impl TraceStyleSheet {
    pub fn get(&self, t: TraceHandle) -> &TraceStyle {
        self.traces.get(&t).map_or(&self.base, |s| s.as_ref())
    }
}
#[wasm_bindgen]
impl TraceStyleSheet {
    pub fn unset() -> Self {
        Self {
            base: TraceStyle::unset(),
            traces: HashMap::new(),
        }
    }

    pub fn get_line_width(&self, t: TraceHandle) -> u32 {
        self.get(t).get_line_width()
    }

    pub fn get_cloned(&self, t: TraceHandle) -> TraceStyle {
        self.get(t).clone()
    }

    pub fn patch(&self, style_sheet_patch: TraceStyleSheetPatch) -> TraceStyleSheet {
        let mut traces = apply_base_patch_to_trace_styles(&self.traces, &style_sheet_patch.base);
        for (t, style_patch) in style_sheet_patch.traces {
            let patched = traces
                .get(&t)
                .map_or(&self.base, |s| s.as_ref())
                .patch(style_patch);
            traces.insert(t, SharedTraceStyle::from(patched));
        }

        TraceStyleSheet {
            base: self.base.patch(style_sheet_patch.base),
            traces,
        }
    }
}

fn apply_base_patch_to_trace_styles(
    traces: &HashMap<TraceHandle, SharedTraceStyle>,
    patch: &TraceStylePatch,
) -> HashMap<TraceHandle, SharedTraceStyle> {
    if patch.is_empty() {
        return traces.clone();
    }

    let distinct_styles: HashSet<_> = traces.values().collect();
    let style_map: HashMap<_, _> = distinct_styles
        .iter()
        .map(|&old| {
            let new = SharedTraceStyle::from(old.as_ref().patch(patch.clone()));
            (old, new)
        })
        .collect();

    traces
        .iter()
        .map(|(&handle, old_style)| {
            let new_style = style_map.get(old_style).unwrap().clone();
            (handle, new_style)
        })
        .collect()
}
