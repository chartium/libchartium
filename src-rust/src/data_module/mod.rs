use std::{collections::HashMap, rc::Rc};

use wasm_bindgen::prelude::wasm_bindgen;

use crate::{
    data::{DataIdx, TypeDescriptor},
    prelude::*,
    structs::MetaCounter,
    trace::{SharedSegment, TraceDescriptor, TraceMetas},
};

mod traceops;

#[wasm_bindgen]
#[derive(Default)]
pub struct DataModule {
    next_handle: DataIdx,
    traces: HashMap<DataIdx, TraceDescriptor>,
}

#[wasm_bindgen]
impl DataModule {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Default::default()
    }

    pub fn create_trace(&mut self, id: &str, x_type: &str) -> DataIdx {
        let handle = self.next_handle;
        self.next_handle += 1;

        self.traces.insert(
            handle,
            TraceDescriptor {
                id: id.to_string(),
                x_type: x_type.to_string(),

                segments: vec![],
            },
        );

        handle
    }

    pub fn dispose_trace(&mut self, handle: usize) {
        self.traces.remove(&handle);
    }

    pub fn print_data_as_csv(&self, ptrs: &[DataIdx], from: RangePrec, to: RangePrec) -> String {
        use chrono::{DateTime, NaiveDateTime, Utc};
        let mut output = String::new();

        let len = (to - from) as usize;

        for i in 0..=len {
            let x = from + i as RangePrec;

            output.push_str(
                &DateTime::<Utc>::from_utc(
                    NaiveDateTime::from_timestamp_opt(x as i64 * 60, 0).unwrap(),
                    Utc,
                )
                .format("%m/%d/%Y %H:%M:%S")
                .to_string(),
            );

            for (_, val) in self.get_data_at(ptrs, x) {
                output.push_str(&format!(",{}", val.unwrap_or(0.)));
            }

            output.push_str("\r\n");
        }

        output
    }
}

impl DataModule {
    pub fn get_trace(&self, handle: DataIdx) -> Option<&TraceDescriptor> {
        self.traces.get(&handle)
    }

    pub fn get_trace_mut(&mut self, handle: DataIdx) -> Option<&mut TraceDescriptor> {
        self.traces.get_mut(&handle)
    }

    pub fn get_data_at<'a, 'b: 'a>(
        &'a self,
        ptrs: &'b [DataIdx],
        x: RangePrec,
    ) -> impl Iterator<Item = (DataIdx, Option<RangePrec>)> + 'a {
        ptrs.iter().map(move |&p| {
            (
                p,
                self.traces.get(&p).and_then(|trace| trace.get_data_at(x)),
            )
        })
    }

    pub fn bulkload_segments(
        &mut self,
        ptrs: &[DataIdx],
        x_desc: &TypeDescriptor,
        y_desc: &TypeDescriptor,
        data: &[u8],
    ) -> Vec<TraceMetas> {
        let row_bytes_len = x_desc.size + y_desc.size * ptrs.len();

        let points = data.len() / row_bytes_len;
        let mut x = Vec::<u64>::with_capacity(points);

        let mut out = {
            let ptr = unsafe {
                std::alloc::alloc(std::alloc::Layout::array::<f64>(points * ptrs.len()).unwrap())
                    as *mut f64
            };
            ptrs.iter()
                .enumerate()
                .map(|(i, _)| unsafe { Vec::from_raw_parts(ptr.add(i * points), 0, points) })
                .collect::<Vec<_>>()
        };

        let mut counter = MetaCounter::new(ptrs.len());

        for row in data.chunks_exact(row_bytes_len) {
            let cur = (x_desc.parser)(&row[0..x_desc.size]);
            x.push(cur as u64);

            out.iter_mut()
                .zip(row[x_desc.size..].chunks(y_desc.size))
                .enumerate()
                .for_each(|(i, (out, bytes))| {
                    let val = (y_desc.parser)(bytes);
                    counter.add(i, val);
                    out.push(val);
                });
        }

        let x = Rc::new(x);
        let mut metas = Vec::with_capacity(ptrs.len());

        for ((d, handle), mut m) in out.into_iter().zip(ptrs.iter()).zip(counter.iter_metas()) {
            m.handle = *handle;
            metas.push(m);

            match self.traces.get_mut(handle) {
                Some(trace) => {
                    trace.push_segment(Box::new(SharedSegment::new(x.clone(), Rc::new(d))))
                }
                None => {
                    panic!("Handle {} is invalid", handle);
                }
            };
        }

        metas
    }
}
