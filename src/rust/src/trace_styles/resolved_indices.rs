use std::collections::{HashMap, HashSet};
use wasm_bindgen::prelude::wasm_bindgen;

use crate::{data::TraceHandle, utils::ResolvedColor};

use super::{TraceColor, TracePaletteIndex, TraceStyleSheet};

fn should_assign_index_to_color(color: &TraceColor) -> bool {
    !matches!(color, TraceColor::Exact(_))
}

#[wasm_bindgen]
pub struct ResolvedColorIndices {
    indices: HashMap<TraceHandle, usize>,
    largest_index: HashMap<TraceColor, usize>,
}
#[wasm_bindgen]
impl ResolvedColorIndices {
    pub fn compute(sheet: &TraceStyleSheet, traces: &[TraceHandle]) -> Self {
        let mut indices = HashMap::<TraceHandle, usize>::new();
        let mut used_indices = HashMap::<&TraceColor, HashSet<usize>>::new();
        let mut last_consecutive_index = HashMap::<&TraceColor, usize>::new();
        let mut largest_index = HashMap::<TraceColor, usize>::new();

        for first in [true, false] {
            for &trace in traces {
                let style = sheet.get(trace);
                let color = style.get_color();
                let index = style.get_palette_index();

                // first, use the user-specified indices
                if first {
                    if let TracePaletteIndex::Some(i) = index {
                        let i = *i;

                        indices.insert(trace, i);

                        if should_assign_index_to_color(color) {
                            used_indices.entry(color).or_default().insert(i);
                            if largest_index.get(color).map_or(false, |&j| i > j) {
                                largest_index.insert(color.clone(), i);
                            }
                        }
                    }

                    // then, auto-fill indices
                } else if let TracePaletteIndex::Auto = index {
                    let used_indices = &used_indices;

                    if should_assign_index_to_color(color) {
                        let last_index = last_consecutive_index.entry(color).or_insert(0);
                        while used_indices
                            .get(color)
                            .map_or(false, |s| s.contains(last_index))
                        {
                            *last_index += 1;
                        }
                        let i = *last_index;
                        *last_index += 1;

                        indices.insert(trace, i);

                        if largest_index.get(color).map_or(false, |&j| i > j) {
                            largest_index.insert(color.clone(), i);
                        }
                    }
                }
            }
        }

        Self {
            indices,
            largest_index,
        }
    }
}
impl ResolvedColorIndices {
    pub fn get_trace_index(&self, trace: TraceHandle) -> usize {
        *self.indices.get(&trace).unwrap_or(&0)
    }

    pub fn get_color_max_index(&self, color: &TraceColor) -> usize {
        *self.largest_index.get(color).unwrap_or(&0)
    }
}

#[wasm_bindgen]
impl TraceStyleSheet {
    pub fn get_color(&self, trace: TraceHandle, indices: ResolvedColorIndices) -> ResolvedColor {
        let color = self.get(trace).get_color();
        let trace_index = indices.get_trace_index(trace);
        let max_index = indices.get_color_max_index(color);

        color.resolve(trace_index, max_index)
    }
}
