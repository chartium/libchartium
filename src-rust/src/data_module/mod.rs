use std::collections::HashMap;

use wasm_bindgen::prelude::wasm_bindgen;

use crate::{
    data::{TraceHandle, TypeDescriptor},
    structs::MetaCounter,
    trace::{Batch, BoxedBundle},
};

#[wasm_bindgen]
#[derive(Default)]
pub struct DataModule {}

#[wasm_bindgen]
impl DataModule {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Default::default()
    }

    // pub fn print_data_as_csv(
    //     &self,
    //     ptrs: &[TraceHandle],
    //     from: f64,
    //     to: f64,
    // ) -> String {
    //     use chrono::{DateTime, NaiveDateTime, Utc};
    //     let mut output = String::new();

    //     let len = (to - from) as usize;

    //     for i in 0..=len {
    //         let x = from + i as f64;

    //         output.push_str(
    //             &DateTime::<Utc>::from_utc(
    //                 NaiveDateTime::from_timestamp_opt(x as i64 * 60, 0).unwrap(),
    //                 Utc,
    //             )
    //             .format("%m/%d/%Y %H:%M:%S")
    //             .to_string(),
    //         );

    //         for (_, val) in self.get_data_at(ptrs, x) {
    //             output.push_str(&format!(",{}", val.unwrap_or(0.)));
    //         }

    //         output.push_str("\r\n");
    //     }

    //     output
    // }
}

impl DataModule {
    pub fn bulkload_segments(
        &mut self,
        handles: &[TraceHandle],
        x_desc: &TypeDescriptor,
        y_desc: &TypeDescriptor,
        data: &[u8],
    ) -> BoxedBundle {
        let row_bytes_len = x_desc.size + y_desc.size * handles.len();

        let point_count = data.len() / row_bytes_len;
        let mut x = Vec::<u64>::with_capacity(point_count);

        let mut ys = {
            let ptr = unsafe {
                std::alloc::alloc(
                    std::alloc::Layout::array::<f64>(point_count * handles.len()).unwrap(),
                ) as *mut f64
            };
            handles
                .iter()
                .enumerate()
                .map(|(i, _)| unsafe {
                    Vec::from_raw_parts(ptr.add(i * point_count), 0, point_count)
                })
                .collect::<Vec<_>>()
        };

        let mut counter = MetaCounter::new(handles.len());

        for row in data.chunks_exact(row_bytes_len) {
            let cur = (x_desc.parser)(&row[0..x_desc.size]);
            x.push(cur as u64);

            ys.iter_mut()
                .zip(row[x_desc.size..].chunks(y_desc.size))
                .enumerate()
                .for_each(|(i, (y, bytes))| {
                    let val = (y_desc.parser)(bytes);
                    counter.add(i, val);
                    y.push(val);
                });
        }

        let ys = HashMap::from_iter(handles.iter().enumerate().map(|(i, &h)| (h, ys[i].clone())));

        BoxedBundle::new(Box::new(Batch::new(x, ys)))
    }
}
