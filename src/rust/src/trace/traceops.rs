use std::cmp::Ordering;

use wasm_bindgen::prelude::*;

use crate::{
    data::TraceHandle,
    structs::AdaptiveGrid,
    trace::BundleRc,
    types::{NumericRange, TraceMetas, TracePoint},
};

use super::{BundleVec, InterpolationStrategy};

#[wasm_bindgen]
impl BundleRc {
    pub fn find_n_closest_points(
        &self,
        traces: Option<Box<[TraceHandle]>>,
        x: f64,
        y: f64,
        n: usize,
        max_dy: Option<f64>,
        interpolation: InterpolationStrategy,
    ) -> Box<[JsValue]> {
        if !self.range().contains(x) {
            return vec![].into();
        }

        let mut dists: Vec<_> = traces
            .unwrap_or_else(|| self.traces())
            .iter()
            .map(|&h| (h, self.unwrap().value_at(h, x, interpolation)))
            .filter_map(|(h, ty_opt)| ty_opt.map(|ty| (h, ty)))
            .map(|(h, point)| (h, point, (point.1 - y).abs()))
            .filter(|(_, _, delta)| match max_dy {
                Some(m) => *delta < m,
                None => true,
            })
            .collect();

        dists.sort_by(|(_, _, a_delta), (_, _, b_delta)| {
            a_delta.partial_cmp(b_delta).unwrap_or(Ordering::Equal)
        });

        dists
            .into_iter()
            .take(n)
            .map(|(handle, (x, y), _)| TracePoint { handle, x, y })
            .map(|tp| serde_wasm_bindgen::to_value(&tp).unwrap())
            .collect()
    }

    pub fn get_trace_metas(&self, trace: TraceHandle, x_range: NumericRange) -> TraceMetas {
        let mut metas = TraceMetas {
            handle: trace,
            avg: 0.0,
            avg_nz: 0.0,
            min: f64::INFINITY,
            max: f64::NEG_INFINITY,
        };
        let mut pts = 0;
        let mut nz_pts = 0;

        for (_, y) in self.unwrap().iter_in_range_f64(trace, x_range) {
            if y.is_nan() {
                continue;
            }
            metas.avg += y;
            metas.min = f64::min(metas.min, y);
            metas.max = f64::max(metas.max, y);

            pts += 1;

            if y > 0.0 {
                nz_pts += 1;
                metas.avg_nz += y;
            }
        }

        metas.avg = if pts > 0 { metas.avg / pts as f64 } else { 0.0 };
        metas.avg_nz = if nz_pts > 0 {
            metas.avg_nz / nz_pts as f64
        } else {
            0.0
        };

        metas
    }

    pub fn get_multiple_traces_metas(
        &self,
        traces: &[TraceHandle],
        x_range: NumericRange,
    ) -> Vec<JsValue> {
        traces
            .iter()
            .map(|t| self.get_trace_metas(*t, x_range))
            .map(|m| serde_wasm_bindgen::to_value(&m).unwrap())
            .collect()
    }

    /// checks if all datapoints of selected trace in specific interval are identically zero
    pub fn is_trace_zero(&self, trace: TraceHandle, x_range: NumericRange) -> bool {
        self.unwrap()
            .iter_in_range_f64(trace, x_range)
            .any(|(_, y)| y.abs() > 1e-3)
    }

    /// checks if which traces have all their datapoints indentically zero on set interval
    pub fn are_traces_zero(&self, traces: &[TraceHandle], x_range: NumericRange) -> Box<[JsValue]> {
        traces
            .iter()
            .map(|t| self.is_trace_zero(*t, x_range).into())
            .collect()
    }

    /// Returns true if the given trace gets larger than the given
    /// threshold at any point in the specified range
    pub fn is_trace_over_treshold(
        &self,
        trace: TraceHandle,
        x_range: NumericRange,
        tres: f64,
    ) -> bool {
        self.unwrap()
            .iter_in_range_f64(trace, x_range)
            .any(|(_, y)| y >= tres)
    }

    /// Returns array of bools for each specified trace,
    /// true if the trace gets larger than the given threshold
    /// at any point in the specified range, false otherwise.
    /// Also accepts trace handles that are not present in this
    /// bundle, always returning false for them.
    pub fn are_traces_over_threshold(
        &self,
        traces: &[TraceHandle],
        x_range: NumericRange,
        tres: f64,
    ) -> Box<[JsValue]> {
        traces
            .iter()
            .map(|&t| self.contains_trace(t) && self.is_trace_over_treshold(t, x_range, tres))
            .map(|b| b.into())
            .collect()
    }
}

#[wasm_bindgen]
pub fn find_closest_in_stack(
    bundles: &BundleVec,
    factors: &[f64],
    stack: &[TraceHandle],
    x: f64,
    y: f64,
    interpolation: InterpolationStrategy,
) -> JsValue {
    assert_eq!(
        bundles.len(),
        factors.len(),
        "there must be a factor for each bundle"
    );

    let mut sum = 0.;

    for handle in stack {
        let Some((bundle, factor)) = bundles
            .iter()
            .zip(factors)
            .find(|(b, _)| b.contains_trace(*handle) && b.contains_point(x))
        else {
            continue;
        };

        let Some(value) = bundle.value_at(*handle, x, interpolation) else {
            continue;
        };

        let trace_y = value.1 * factor;

        if is_between(y, sum, sum + trace_y) {
            return serde_wasm_bindgen::to_value(&TracePoint {
                x: value.0,
                y: sum + trace_y,
                handle: *handle,
            })
            .unwrap();
        }

        sum += trace_y;
    }

    JsValue::null()
}

#[wasm_bindgen]
pub fn find_list_extents(
    bundles: &BundleVec,
    factors: &[f64],
    trace_list: &[TraceHandle],
    x_range: NumericRange,
) -> NumericRange {
    assert!(
        !trace_list.is_empty(),
        "empty lists should be handled on the JS side"
    );

    let mut y_range = NumericRange {
        from: f64::MAX,
        to: f64::MIN,
    };

    for (bundle, factor) in bundles.iter().zip(factors) {
        if !bundle.intersects(x_range.from, x_range.to) {
            continue;
        }

        for trace in trace_list {
            if bundle.contains_trace(*trace) {
                for (_, y) in bundle.iter_in_range_with_neighbors_f64(*trace, x_range) {
                    let y = y * factor;

                    y_range.from = y_range.from.min(y);
                    y_range.to = y_range.to.max(y);
                }
            }
        }
    }

    y_range
}

#[wasm_bindgen]
pub fn find_stack_extents(
    bundles: &BundleVec,
    factors: &[f64],
    stack: &[TraceHandle],
    x_range: NumericRange,
) -> NumericRange {
    assert!(
        !stack.is_empty(),
        "empty stacks should be handled on the JS side"
    );

    let mut grid = AdaptiveGrid::new();
    let mut y_range = NumericRange {
        from: f64::MAX,
        to: f64::MIN,
    };

    for handle in stack {
        for (bundle, factor) in bundles.iter().zip(factors) {
            if !bundle.contains_trace(*handle) {
                continue;
            }

            for (_, _, y) in grid.sum_add_points(
                bundle
                    .iter_in_range_with_neighbors_f64(*handle, x_range)
                    .map(|(x, y)| (x, y * factor)),
            ) {
                y_range.from = y_range.from.min(y);
                y_range.to = y_range.to.max(y);
            }
        }
    }

    y_range
}

fn is_between(val: f64, from: f64, to: f64) -> bool {
    if from <= to {
        from <= val && val <= to
    } else {
        from >= val && val >= to
    }
}
