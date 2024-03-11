use std::collections::HashMap;

use js_sys::{Float64Array, Uint8Array};
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

use crate::{
    data::{TraceHandle, TypeDescriptor, TYPE_SIZES},
    structs::MetaCounter,
    trace::{Batch, BoxedBundle, ConstantBatch},
};

#[wasm_bindgen]
pub struct Bulkloader {
    handles: Vec<TraceHandle>,
    x_desc: &'static TypeDescriptor,
    y_desc: &'static TypeDescriptor,
    data: Vec<u8>,
}

#[wasm_bindgen]
impl Bulkloader {
    pub async fn from_stream(
        handles: Vec<TraceHandle>,
        x_type: String,
        y_type: String,
        stream: wasm_streams::readable::sys::ReadableStream,
    ) -> Result<Bulkloader, JsValue> {
        use js_sys::Uint8Array;

        const ALLOC_ROWS: usize = 1440;

        let x_desc = TYPE_SIZES.get(x_type.as_str()).unwrap();
        let y_desc = TYPE_SIZES.get(y_type.as_str()).unwrap();
        let row_len_bytes = x_desc.size + y_desc.size * handles.len();
        let default_alloc = ALLOC_ROWS * row_len_bytes;

        let mut buffer: Vec<u8> = Vec::with_capacity(default_alloc);

        let mut stream = wasm_streams::ReadableStream::from_raw(stream);
        let mut reader = stream.try_get_reader()?;

        let mut cursor = 0;

        while let Some(row) = reader.read().await? {
            let row = Uint8Array::from(row);

            unsafe {
                let next_len = cursor + row.byte_length() as usize;

                if next_len > buffer.capacity() {
                    let delta = next_len - buffer.capacity();
                    buffer.reserve(
                        (delta / default_alloc + (delta % default_alloc).min(1)) * default_alloc,
                    );
                }

                buffer.set_len(next_len);
            }

            row.copy_to(&mut buffer[cursor..(cursor + row.byte_length() as usize)]);
            cursor += row.byte_length() as usize;
        }

        Ok(Self {
            handles,
            x_desc,
            y_desc,
            data: buffer,
        })
    }

    pub async fn from_array(
        handles: Vec<TraceHandle>,
        x_type: String,
        y_type: String,
        array: Uint8Array,
    ) -> Result<Bulkloader, JsValue> {
        let x_desc = TYPE_SIZES.get(x_type.as_str()).unwrap();
        let y_desc = TYPE_SIZES.get(y_type.as_str()).unwrap();

        Ok(Self {
            handles,
            x_desc,
            y_desc,
            data: array.to_vec(),
        })
    }

    pub fn apply(self) -> BoxedBundle {
        let Bulkloader {
            handles,
            x_desc,
            y_desc,
            data,
        } = self;

        let row_bytes_len = x_desc.size + y_desc.size * handles.len();

        let point_count = data.len() / row_bytes_len;
        let mut x = Vec::<u64>::with_capacity(point_count);

        let mut ys = {
            let ptr = unsafe {
                use std::alloc::{alloc, Layout};

                alloc(Layout::array::<f64>(point_count * handles.len()).unwrap()) as *mut f64
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

        let ys = HashMap::from_iter(handles.iter().zip(ys).map(|(h, y)| (*h, y)));

        BoxedBundle::new(Batch::new(x, ys))
    }

    pub fn from_columnar(
        handles: Vec<TraceHandle>,
        x_type: String,
        y_type: String,
        input_x: Uint8Array,
        input_ys: Vec<Uint8Array>,
    ) -> BoxedBundle {
        let x_desc = TYPE_SIZES.get(x_type.as_str()).unwrap();
        let y_desc = TYPE_SIZES.get(y_type.as_str()).unwrap();

        let point_count = input_x.length() as usize / x_desc.size;

        let mut x = Vec::<u64>::with_capacity(point_count);
        let mut ys = {
            let ptr = unsafe {
                use std::alloc::{alloc, Layout};

                alloc(Layout::array::<f64>(point_count * input_ys.len()).unwrap()) as *mut f64
            };
            handles
                .iter()
                .enumerate()
                .map(|(i, _)| unsafe {
                    Vec::from_raw_parts(ptr.add(i * point_count), 0, point_count)
                })
                .collect::<Vec<_>>()
        };

        let input_x = input_x.to_vec();

        for current_x in input_x.chunks_exact(x_desc.size) {
            let cur = (x_desc.parser)(current_x);
            x.push(cur as u64);
        }

        for (input, output) in input_ys.into_iter().zip(ys.iter_mut()) {
            let y = input.to_vec();

            for current_y in y.chunks_exact(y_desc.size) {
                let val = (y_desc.parser)(current_y);

                output.push(val);
            }
        }

        let ys = HashMap::from_iter(handles.iter().zip(ys).map(|(h, y)| (*h, y)));

        BoxedBundle::new(Batch::new(x, ys))
    }

    // FIXME move this to a different file once it works :d
    pub fn threshold_from_array(handles: Vec<TraceHandle>, input_ys: Float64Array) -> BoxedBundle {
        let ys_as_vec: Vec<f64> = input_ys.to_vec();
        let ys = HashMap::from_iter(handles.iter().zip(ys_as_vec.iter()).map(|(h, y)| (*h, *y)));

        BoxedBundle::new(ConstantBatch::new(ys))
    }
}
