use wasm_bindgen::prelude::*;

use crate::{
    data::{create_segment, TraceHandle, TYPE_SIZES},
    prelude::*,
    trace::{Segment, TraceMetas},
};

use super::DataModule;

trait OptionUtils<T> {
    fn is_none_or(&self, f: impl FnOnce(&T) -> bool) -> bool;
}

impl<T> OptionUtils<T> for Option<T> {
    fn is_none_or(&self, f: impl FnOnce(&T) -> bool) -> bool {
        match self.as_ref() {
            Some(v) => f(v),
            None => true,
        }
    }
}

#[wasm_bindgen]
impl DataModule {
    pub fn get_data_at_point(&self, ptrs: &[TraceHandle], x: RangePrec) -> JsValue {
        serde_wasm_bindgen::to_value(
            &self
                .get_data_at(ptrs, x)
                .filter_map(|(k, v)| v.map(|v| (k, v)))
                .collect::<Vec<_>>(),
        )
        .unwrap()
    }

    pub fn find_n_closest(
        &self,
        ptrs: &[TraceHandle],
        x: RangePrec,
        y: RangePrec,
        n: usize,
        max_dy: Option<RangePrec>,
    ) -> Box<[TraceHandle]> {
        let mut dists: Vec<(TraceHandle, RangePrec)> = self
            .get_data_at(ptrs, x)
            .filter_map(|(p, ty)| ty.map(|v| (p, (v - y).abs())))
            .filter(|(_, delta)| match max_dy {
                Some(m) => *delta < m,
                None => true,
            })
            .collect();

        dists.sort_by(|(_, a_delta), (_, b_delta)| a_delta.partial_cmp(b_delta).unwrap());

        dists.into_iter().take(n).map(|(p, _)| p).collect()
    }

    // pub fn find_n_closest(
    //     &self,
    //     ptrs: &[DataIdx],
    //     n: usize,
    //     point_x: RangePrec,
    //     point_y: RangePrec,
    //     from: RangePrec,
    //     to: RangePrec,
    //     area_chart: bool,
    // ) -> Box<[JsValue]> {

    //     let mut dists: Vec<(DataIdx, RangePrec)> = self
    //         .get_data_at(ptrs, point_x)
    //         .filter_map(|(k, v)| v.map(|v| (k, v)))
    //         .collect();

    //     if area_chart {
    //         let mut add = 0.0;

    //         for (id, y) in dists.iter() {
    //             if add <= point_y && point_y < add + y {
    //                 return Box::new([self.get_trace_metas(*id, from, to)]);
    //             }

    //             add += y;
    //         }
    //     }

    //     dists.sort_by(|a, b| {
    //         (a.1 - point_y)
    //             .abs()
    //             .partial_cmp(&(b.1 - point_y).abs())
    //             .unwrap()
    //     });

    //     dists
    //         .iter()
    //         .take(n)
    //         .map(|f| self.get_trace_metas(f.0, from, to))
    //         .collect()
    // }

    pub fn shift_clone_trace(
        &mut self,
        output: TraceHandle,
        source: TraceHandle,
        from: RangePrec,
        to: RangePrec,
        shift_x: RangePrec,
        shift_y: RangePrec,
    ) {
        let segments: Vec<_> = self
            .traces
            .get(&source)
            .map(|t| {
                t.get_segments_in(from, to)
                    .map(|s| dyn_clone::clone_box(s.as_ref()))
                    .collect()
            })
            .expect("Invalid source handle in shift_clone_trace");

        self.traces
            .get_mut(&output)
            .map(|t| {
                for mut seg in segments.into_iter() {
                    seg.shift(shift_x, shift_y);
                    t.push_segment(seg);
                }
            })
            .expect("Invalid output handle in shift_clone_trace");
    }

    pub fn op_traces(
        &mut self,
        output: TraceHandle,
        ptrs: &[TraceHandle],
        op: &str,
        from: RangePrec,
        to: RangePrec,
    ) {
        if op == "clone" {
            assert!(ptrs.len() == 1);
            let source_handle = ptrs.first().unwrap();

            let cloned: Vec<Box<dyn Segment>> = self
                .traces
                .get(source_handle)
                .map(|t| {
                    t.get_segments_in(from, to)
                        .map(|seg| dyn_clone::clone_box(seg.as_ref()))
                        .collect()
                })
                .expect("Invalid source_handle in op_traces");

            self.traces
                .get_mut(&output)
                .map(|t| {
                    for seg in cloned {
                        t.push_segment(seg);
                    }
                })
                .expect("Invalid output in op_traces");

            return;
        }

        let mul = match op {
            "sum" => 1.0,
            "avg" => 1.0 / ptrs.len() as f64,
            _ => panic!("Unknown operation"),
        };

        let mut data = ptrs
            .first()
            .and_then(|ptr| self.traces.get(ptr))
            .map(|t| {
                let mut current = Vec::<(i32, f64)>::new();
                for (x, y) in t.get_data_in_range(from, to) {
                    current.push((x as i32, y * mul));
                }

                current
            })
            .expect("Invalid ptr of ptrs in op_traces");

        for t in ptrs.iter().skip(1) {
            self.traces
                .get(t)
                .map(|t| {
                    for (row, (_, y)) in data.iter_mut().zip(t.get_data_in_range(from, to)) {
                        row.1 += y * mul;
                    }
                })
                .expect("Invalid ptr of ptrs in op_traces");
        }

        let data: Vec<u8> = unsafe {
            let row_len = std::mem::align_of::<(i32, f64)>();
            let len = data.len() * row_len;
            let cap = data.capacity() * row_len;
            let ptr = data.as_mut_ptr();
            std::mem::forget(data);

            Vec::from_raw_parts(std::mem::transmute(ptr), len, cap)
        };

        self.traces
            .get_mut(&output)
            .map(move |t| {
                let x_desc = TYPE_SIZES.get(t.x_type.as_str()).unwrap();
                let y_desc = TYPE_SIZES.get("F64").unwrap();
                t.push_segment(create_segment(
                    x_desc,
                    y_desc,
                    std::mem::align_of::<(i32, f64)>(),
                    from,
                    to,
                    data,
                ));
            })
            .expect("Invalid output in op_traces");
    }

    pub fn get_closest_point(
        &self,
        ptr: TraceHandle,
        rx: RangePrec,
        _ry: RangePrec,
    ) -> Option<Box<[RangePrec]>> {
        let mut closest_x: Option<RangePrec> = None;
        let mut closest_y: Option<RangePrec> = None;

        let trace = self
            .traces
            .get(&ptr)
            .expect("Invalid ptr in get_closest_point");

        let data = trace
            .segments
            .iter()
            .find(|s| s.contains(rx))
            .map(|s| s.iter_in_range(s.from(), s.to()))
            .unwrap_or_else(|| {
                Box::new(
                    trace
                        .segments
                        .iter()
                        .flat_map(|s| s.iter_in_range(s.from(), s.to())),
                )
            });

        for (x, y) in data {
            if closest_x.is_none_or(|cx| (rx - cx).abs() > (rx - x).abs()) {
                closest_x = Some(x);
                closest_y = Some(y);
            }
        }

        match (closest_x, closest_y) {
            (Some(x), Some(y)) => Some(vec![x, y].into_boxed_slice()),
            _ => None,
        }
    }

    pub fn get_trace_metas(&self, ptr: TraceHandle, from: RangePrec, to: RangePrec) -> JsValue {
        let mut metas = TraceMetas {
            handle: ptr,
            avg: 0.0,
            avg_nz: 0.0,
            min: RangePrec::INFINITY,
            max: RangePrec::NEG_INFINITY,
        };
        let mut pts = 0;
        let mut nz_pts = 0;

        let trace = self
            .traces
            .get(&ptr)
            .expect("Invalid ptr in get_trace_metas");

        for (_, y) in trace.get_data_in_range(from, to) {
            metas.avg += y;
            metas.min = RangePrec::min(metas.min, y);
            metas.max = RangePrec::max(metas.max, y);

            pts += 1;

            if y > 0.0 {
                nz_pts += 1;
                metas.avg_nz += y;
            }
        }

        metas.avg = if pts > 0 {
            metas.avg / pts as RangePrec
        } else {
            0.0
        };
        metas.avg_nz = if nz_pts > 0 {
            metas.avg_nz / nz_pts as RangePrec
        } else {
            0.0
        };

        serde_wasm_bindgen::to_value(&metas).unwrap()
    }

    pub fn get_multiple_traces_metas(
        &self,
        ptrs: &[TraceHandle],
        from: RangePrec,
        to: RangePrec,
    ) -> Vec<JsValue> {
        ptrs.iter()
            .map(|t| self.get_trace_metas(*t, from, to))
            .collect::<Vec<JsValue>>()
    }

    /// checks if all datapoints of selected trace in specific interval are identically zero
    pub fn is_trace_zero(&self, data_ptr: TraceHandle, from: RangePrec, to: RangePrec) -> bool {
        self.traces
            .get(&data_ptr)
            .map(|t| !t.get_data_in_range(from, to).any(|(_, y)| y.abs() > 1e-3))
            .unwrap_or(true)
    }

    /// checks if which traces have all their datapoints indentically zero on set interval
    pub fn are_traces_zero(
        &self,
        data_ptrs: &[TraceHandle],
        from: RangePrec,
        to: RangePrec,
    ) -> Box<[JsValue]> {
        data_ptrs
            .iter()
            .map(|ptr| self.is_trace_zero(*ptr, from, to).into())
            .collect()
    }

    /// Returns true if all values of trace at data_ptr in range from:to are above treshold
    pub fn is_trace_over_treshold(
        &self,
        data_ptr: TraceHandle,
        from: RangePrec,
        to: RangePrec,
        tres: RangePrec,
    ) -> bool {
        self.traces
            .get(&data_ptr)
            .map(|t| t.get_data_in_range(from, to).any(|(_, y)| y.abs() >= tres))
            .unwrap_or(false)
    }

    /// Returns array of bools for each trace in ptrs, true if all values of trace at data_ptr in range from:to are above treshold
    /// is just map of data_ptrs to treshold() of its values
    pub fn are_traces_over_threshold(
        &self,
        data_ptrs: &[TraceHandle],
        from: RangePrec,
        to: RangePrec,
        tres: RangePrec,
    ) -> Box<[JsValue]> {
        data_ptrs
            .iter()
            .map(|ptr| self.is_trace_over_treshold(*ptr, from, to, tres).into())
            .collect()
    }

    pub fn get_extents(
        &self,
        data_ptr: TraceHandle,
        from: RangePrec,
        to: RangePrec,
    ) -> Box<[RangePrec]> {
        let (min, max) = self
            .traces
            .get(&data_ptr)
            .map(|trace| {
                trace
                    .get_data_in_range(from, to)
                    .fold((RangePrec::MAX, RangePrec::MIN), |acc, (_, y)| {
                        (acc.0.min(y), acc.1.max(y))
                    })
            })
            .unwrap_or_else(|| (0., 1.));

        Box::new([from, to, min as RangePrec, max as RangePrec])
    }

    pub fn get_sum_extents(
        &self,
        ptrs: &[TraceHandle],
        from: RangePrec,
        to: RangePrec,
    ) -> Box<[RangePrec]> {
        let mut data = self
            .traces
            .get(ptrs.first().unwrap())
            .map(|t| {
                let mut current = Vec::<(i32, f64)>::new();
                for (x, y) in t.get_data_in_range(from, to) {
                    current.push((x as i32, y));
                }

                current
            })
            .unwrap(); // FIXME

        for t in ptrs.iter().skip(1) {
            self.traces
                .get(t)
                .map(|t| {
                    for (row, (_, y)) in data.iter_mut().zip(t.get_data_in_range(from, to)) {
                        row.1 += y;
                    }
                })
                .expect("Invalid ptr of ptrs in get_sum_extents");
        }

        let result = data.iter().fold(f64::MIN, |acc, (_, y)| acc.max(*y));

        Box::new([from, to, 0.0, result as RangePrec])
    }
}
