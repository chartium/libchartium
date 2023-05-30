use wasm_bindgen::prelude::*;

use crate::{
    data::{create_segment, DataIdx, TYPE_SIZES},
    prelude::*,
    trace::{Segment, TraceMetas},
};

use super::DataModule;

#[wasm_bindgen]
impl DataModule {
    pub fn get_data_at_point(&self, ptrs: &[DataIdx], x: RangePrec) -> JsValue {
        serde_wasm_bindgen::to_value(
            &self
                .get_data_at(ptrs, x)
                .filter_map(|(k, v)| v.map(|v| (k, v)))
                .collect::<Vec<_>>(),
        )
        .unwrap()
    }

    pub fn find_closest(
        &self,
        ptrs: &[DataIdx],
        x: RangePrec,
        y: RangePrec,
        max_dy: RangePrec,
    ) -> Option<DataIdx> {
        let mut dists: Vec<(DataIdx, RangePrec)> = self
            .get_data_at(ptrs, x)
            .filter_map(|d| d.1.map(|v| (d.0, (v - y).abs())))
            .filter(|(_, dy)| *dy < max_dy)
            .collect();

        dists.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());

        dists.first().map(|f| f.0)
    }

    pub fn shift_clone_trace(
        &mut self,
        output: DataIdx,
        source: DataIdx,
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
        output: DataIdx,
        ptrs: &[DataIdx],
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
                for (x, y) in t.get_data_high_prec(from, to) {
                    current.push((x as i32, y * mul));
                }

                current
            })
            .expect("Invalid ptr of ptrs in op_traces");

        for t in ptrs.iter().skip(1) {
            self.traces
                .get(t)
                .map(|t| {
                    for (row, (_, y)) in data.iter_mut().zip(t.get_data_high_prec(from, to)) {
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

    pub fn get_trace_metas(
        &self,
        ptr: DataIdx,
        from: RangePrec,
        to: RangePrec,
        val: &[RangePrec],
    ) -> JsValue {
        let mut metas = TraceMetas {
            handle: ptr,
            avg: 0.0,
            avg_nz: 0.0,
            min: RangePrec::INFINITY,
            max: RangePrec::NEG_INFINITY,
            val: val.try_into().ok(),
            val_closest: None,
        };
        let mut pts = 0;
        let mut nz_pts = 0;

        let trace = self
            .traces
            .get(&ptr)
            .expect("Invalid ptr in get_trace_metas");

        for (x, y) in trace.get_data_high_prec(from, to) {
            metas.avg += y;
            metas.min = RangePrec::min(metas.min, y);
            metas.max = RangePrec::max(metas.max, y);

            pts += 1;

            if y > 0.0 {
                nz_pts += 1;
                metas.avg_nz += y;
            }

            if metas.val.is_some()
                && (metas.val_closest.is_none()
                    || (metas.val_closest.unwrap()[0] - metas.val.unwrap()[0]).abs()
                        > (metas.val.unwrap()[0] - x).abs())
            {
                metas.val_closest = Some([x, y]);
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

    pub fn find_n_closest(
        &self,
        ptrs: &[DataIdx],
        point: &[RangePrec],
        n: usize,
        x_range: &[RangePrec],
        area_chart: bool,
    ) -> Box<[JsValue]> {
        assert!(point.len() == 2);
        assert!(x_range.len() == 2);

        let mut dists: Vec<(DataIdx, RangePrec)> = self
            .get_data_at(ptrs, point[0])
            .filter_map(|(k, v)| v.map(|v| (k, v)))
            .collect();

        if area_chart {
            let mut add = 0.0;

            for (id, y) in dists.iter() {
                if add <= point[1] && point[1] < add + y {
                    return Box::new([self.get_trace_metas(
                        *id,
                        x_range[0],
                        x_range[1],
                        &[point[0], *y],
                    )]);
                }

                add += y;
            }
        }

        dists.sort_by(|a, b| {
            (a.1 - point[1])
                .abs()
                .partial_cmp(&(b.1 - point[1]).abs())
                .unwrap()
        });

        dists
            .iter()
            .take(n)
            .map(|f| self.get_trace_metas(f.0, x_range[0], x_range[1], &[point[0], f.1]))
            .collect()
    }

    pub fn is_zero(&self, data_ptr: DataIdx, from: RangePrec, to: RangePrec) -> bool {
        self.traces
            .get(&data_ptr)
            .map(|t| !t.get_data_in(from, to).any(|(_, y)| y.abs() > 1e-3))
            .unwrap_or(true)
    }

    pub fn treshold(
        &self,
        data_ptr: DataIdx,
        from: RangePrec,
        to: RangePrec,
        tres: DataPrec,
    ) -> bool {
        self.traces
            .get(&data_ptr)
            .map(|t| t.get_data_in(from, to).any(|(_, y)| y.abs() >= tres))
            .unwrap_or(false)
    }

    pub fn get_extents(
        &self,
        data_ptr: DataIdx,
        from: RangePrec,
        to: RangePrec,
    ) -> Box<[RangePrec]> {
        let (min, max) = self
            .traces
            .get(&data_ptr)
            .map(|trace| {
                trace
                    .get_data_in(from, to)
                    .fold((f32::MAX, f32::MIN), |acc, (_, y)| {
                        (acc.0.min(y), acc.1.max(y))
                    })
            })
            .unwrap_or_else(|| (0., 1.));

        Box::new([from, to, min as RangePrec, max as RangePrec])
    }

    pub fn get_sum_extents(
        &self,
        ptrs: &[DataIdx],
        from: RangePrec,
        to: RangePrec,
    ) -> Box<[RangePrec]> {
        let mut data = self
            .traces
            .get(ptrs.first().unwrap())
            .map(|t| {
                let mut current = Vec::<(i32, f64)>::new();
                for (x, y) in t.get_data_high_prec(from, to) {
                    current.push((x as i32, y));
                }

                current
            })
            .unwrap(); // FIXME

        for t in ptrs.iter().skip(1) {
            self.traces
                .get(t)
                .map(|t| {
                    for (row, (_, y)) in data.iter_mut().zip(t.get_data_high_prec(from, to)) {
                        row.1 += y;
                    }
                })
                .expect("Invalid ptr of ptrs in get_sum_extents");
        }

        let result = data.iter().fold(f64::MIN, |acc, (_, y)| acc.max(*y));

        Box::new([from, to, 0.0, result as RangePrec])
    }
}
