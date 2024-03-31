use std::cmp::Ordering;

use wasm_bindgen::prelude::*;

use crate::{
    data::TraceHandle,
    trace::{BoxedBundle, TraceMetas},
};

use super::{BundleRange, InterpolationStrategy::Linear, TracePoint};

#[wasm_bindgen]
impl BoxedBundle {
    /// Finds n closest points to input x, y such that no two points are from the same trace.
    pub fn find_n_closest_points(
        &self,
        traces: Option<Box<[TraceHandle]>>,
        x: f64,
        y: f64,
        n: usize,
        max_dy: Option<f64>,
    ) -> Box<[JsValue]> {
        // clamp x to the range we are working with
        // NOTE this may lead to wrong results
        let x = match serde_wasm_bindgen::from_value::<BundleRange>(self.range()).unwrap() {
            BundleRange::Everywhere => x,
            BundleRange::Bounded { from, to } => (x.max(from)).min(to),
        };

        let mut dists: Vec<_> = traces
            .unwrap_or_else(|| self.traces())
            .iter()
            .map(|&h| (h, self.unwrap().value_at(h, x, Linear)))
            .filter_map(|(h, ty_opt)| ty_opt.map(|ty| (h, ty)))
            .map(|(h, ty)| (h, ty, (ty - y).abs()))
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
            .map(|(handle, y, _)| TracePoint { handle, x, y })
            .map(|tp| serde_wasm_bindgen::to_value(&tp).unwrap())
            .collect()
    }

    pub fn get_trace_metas(&self, trace: TraceHandle, from: f64, to: f64) -> JsValue {
        let mut metas = TraceMetas {
            handle: trace,
            avg: 0.0,
            avg_nz: 0.0,
            min: f64::INFINITY,
            max: f64::NEG_INFINITY,
        };
        let mut pts = 0;
        let mut nz_pts = 0;

        for (_, y) in self.unwrap().iter_in_range_f64(trace, from, to) {
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

        serde_wasm_bindgen::to_value(&metas).unwrap()
    }

    pub fn get_multiple_traces_metas(
        &self,
        ptrs: &[TraceHandle],
        from: f64,
        to: f64,
    ) -> Vec<JsValue> {
        ptrs.iter()
            .map(|t| self.get_trace_metas(*t, from, to))
            .collect::<Vec<JsValue>>()
    }

    /// checks if all datapoints of selected trace in specific interval are identically zero
    pub fn is_trace_zero(&self, trace: TraceHandle, from: f64, to: f64) -> bool {
        self.unwrap()
            .iter_in_range_f64(trace, from, to)
            .any(|(_, y)| y.abs() > 1e-3)
    }

    /// checks if which traces have all their datapoints indentically zero on set interval
    pub fn are_traces_zero(&self, data_ptrs: &[TraceHandle], from: f64, to: f64) -> Box<[JsValue]> {
        data_ptrs
            .iter()
            .map(|ptr| self.is_trace_zero(*ptr, from, to).into())
            .collect()
    }

    /// Returns true if all values of trace at data_ptr in range from:to are above treshold
    pub fn is_trace_over_treshold(
        &self,
        trace: TraceHandle,
        from: f64,
        to: f64,
        tres: f64,
    ) -> bool {
        self.unwrap()
            .iter_in_range_f64(trace, from, to)
            .any(|(_, y)| y.abs() >= tres)
    }

    /// Returns array of bools for each trace in ptrs, true if all values of trace at data_ptr in range from:to are above treshold
    /// is just map of data_ptrs to treshold() of its values
    pub fn are_traces_over_threshold(
        &self,
        data_ptrs: &[TraceHandle],
        from: f64,
        to: f64,
        tres: f64,
    ) -> Box<[JsValue]> {
        data_ptrs
            .iter()
            .map(|ptr| self.is_trace_over_treshold(*ptr, from, to, tres).into())
            .collect()
    }

    // pub fn get_sum_extents(&self, ptrs: &[TraceHandle], from: f64, to: f64) -> Box<[f64]> {
    //     let mut data = self
    //         .traces
    //         .get(ptrs.first().unwrap())
    //         .map(|t| {
    //             let mut current = Vec::<(i32, f64)>::new();
    //             for (x, y) in t.get_data_in_range(from, to) {
    //                 current.push((x as i32, y));
    //             }

    //             current
    //         })
    //         .unwrap(); // FIXME

    //     for t in ptrs.iter().skip(1) {
    //         self.traces
    //             .get(t)
    //             .map(|t| {
    //                 for (row, (_, y)) in data.iter_mut().zip(t.get_data_in_range(from, to)) {
    //                     row.1 += y;
    //                 }
    //             })
    //             .expect("Invalid ptr of ptrs in get_sum_extents");
    //     }

    //     let result = data.iter().fold(f64::MIN, |acc, (_, y)| acc.max(*y));

    //     Box::new([from, to, 0.0, result as f64])
    // }

    // pub fn shift_clone_trace(
    //     &mut self,
    //     output: TraceHandle,
    //     source: TraceHandle,
    //     from: f64,
    //     to: f64,
    //     shift_x: f64,
    //     shift_y: f64,
    // ) {
    //     let segments: Vec<_> = self
    //         .traces
    //         .get(&source)
    //         .map(|t| {
    //             t.get_segments_in(from, to)
    //                 .map(|s| dyn_clone::clone_box(s.as_ref()))
    //                 .collect()
    //         })
    //         .expect("Invalid source handle in shift_clone_trace");

    //     self.traces
    //         .get_mut(&output)
    //         .map(|t| {
    //             for mut seg in segments.into_iter() {
    //                 seg.shift(shift_x, shift_y);
    //                 t.push_segment(seg);
    //             }
    //         })
    //         .expect("Invalid output handle in shift_clone_trace");
    // }

    // pub fn op_traces(
    //     &mut self,
    //     output: TraceHandle,
    //     ptrs: &[TraceHandle],
    //     op: &str,
    //     from: f64,
    //     to: f64,
    // ) {
    //     if op == "clone" {
    //         assert!(ptrs.len() == 1);
    //         let source_handle = ptrs.first().unwrap();

    //         let cloned: Vec<Box<dyn Segment>> = self
    //             .traces
    //             .get(source_handle)
    //             .map(|t| {
    //                 t.get_segments_in(from, to)
    //                     .map(|seg| dyn_clone::clone_box(seg.as_ref()))
    //                     .collect()
    //             })
    //             .expect("Invalid source_handle in op_traces");

    //         self.traces
    //             .get_mut(&output)
    //             .map(|t| {
    //                 for seg in cloned {
    //                     t.push_segment(seg);
    //                 }
    //             })
    //             .expect("Invalid output in op_traces");

    //         return;
    //     }

    //     let mul = match op {
    //         "sum" => 1.0,
    //         "avg" => 1.0 / ptrs.len() as f64,
    //         _ => panic!("Unknown operation"),
    //     };

    //     let mut data = ptrs
    //         .first()
    //         .and_then(|ptr| self.traces.get(ptr))
    //         .map(|t| {
    //             let mut current = Vec::<(i32, f64)>::new();
    //             for (x, y) in t.get_data_in_range(from, to) {
    //                 current.push((x as i32, y * mul));
    //             }

    //             current
    //         })
    //         .expect("Invalid ptr of ptrs in op_traces");

    //     for t in ptrs.iter().skip(1) {
    //         self.traces
    //             .get(t)
    //             .map(|t| {
    //                 for (row, (_, y)) in data.iter_mut().zip(t.get_data_in_range(from, to)) {
    //                     row.1 += y * mul;
    //                 }
    //             })
    //             .expect("Invalid ptr of ptrs in op_traces");
    //     }

    //     let data: Vec<u8> = unsafe {
    //         let row_len = std::mem::align_of::<(i32, f64)>();
    //         let len = data.len() * row_len;
    //         let cap = data.capacity() * row_len;
    //         let ptr = data.as_mut_ptr();
    //         std::mem::forget(data);

    //         Vec::from_raw_parts(std::mem::transmute(ptr), len, cap)
    //     };

    //     self.traces
    //         .get_mut(&output)
    //         .map(move |t| {
    //             let x_desc = TYPE_SIZES.get(t.x_type.as_str()).unwrap();
    //             let y_desc = TYPE_SIZES.get("F64").unwrap();
    //             t.push_segment(create_segment(
    //                 x_desc,
    //                 y_desc,
    //                 std::mem::align_of::<(i32, f64)>(),
    //                 from,
    //                 to,
    //                 data,
    //             ));
    //         })
    //         .expect("Invalid output in op_traces");
    // }
}
