mod data_types;

use std::collections::HashMap;

use js_sys::{Float64Array, Uint8Array};
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

use crate::{
    data::TraceHandle,
    structs::bulkloader::data_types::TYPE_SIZES,
    trace::{Batch, BundleRc, ConstantBatch},
};

use self::data_types::TypeDescriptor;

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

    pub fn apply(self) -> BundleRc {
        let Bulkloader {
            handles,
            x_desc,
            y_desc,
            data,
        } = self;

        let row_bytes_len = x_desc.size + y_desc.size * handles.len();

        let point_count = data.len() / row_bytes_len;
        let mut x = Vec::<i64>::with_capacity(point_count);
        let mut y = vec![0.; point_count * handles.len()];

        for (row_idx, row) in data.chunks_exact(row_bytes_len).enumerate() {
            let cur = (x_desc.parser)(&row[0..x_desc.size]);
            x.push(cur as i64);

            for (col_idx, col) in row[x_desc.size..].chunks_exact(y_desc.size).enumerate() {
                y[col_idx * point_count + row_idx] = (y_desc.parser)(col);
            }
        }

        BundleRc::new(Batch::new(x, y, &handles))
    }

    pub fn from_columnar(
        handles: Vec<TraceHandle>,
        x_type: String,
        y_type: String,
        input_x: Uint8Array,
        input_ys: Vec<Uint8Array>,
    ) -> BundleRc {
        let [x_desc, y_desc] = [x_type, y_type].map(|t| TYPE_SIZES.get(t.as_str()).unwrap());

        let point_count = input_x.length() as usize / x_desc.size;

        let mut x = Vec::<i64>::with_capacity(point_count);
        let mut y = Vec::<f64>::with_capacity(point_count * input_ys.len());

        let input_x = input_x.to_vec();

        for current_x in input_x.chunks_exact(x_desc.size) {
            let cur = (x_desc.parser)(current_x);
            x.push(cur as i64);
        }

        let mut buffer = vec![0u8; y_desc.size * point_count];

        for input_y in input_ys.into_iter() {
            input_y.copy_to(&mut buffer);

            for window in buffer.chunks_exact(y_desc.size) {
                y.push((y_desc.parser)(window));
            }
        }

        BundleRc::new(Batch::new(x, y, &handles))
    }

    // FIXME move this to a different file once it works :d
    pub fn threshold_from_array(handles: Vec<TraceHandle>, input_ys: Float64Array) -> BundleRc {
        let ys_as_vec: Vec<f64> = input_ys.to_vec();
        let ys = HashMap::from_iter(handles.iter().zip(ys_as_vec.iter()).map(|(h, y)| (*h, *y)));

        BundleRc::new(ConstantBatch::new(ys))
    }
}
