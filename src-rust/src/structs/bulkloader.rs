use js_sys::Uint8Array;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

use crate::{
    data::{TraceHandle, TypeDescriptor, TYPE_SIZES},
    data_module::DataModule,
};

#[wasm_bindgen]
pub struct Bulkloader {
    ptrs: Vec<TraceHandle>,
    x_desc: &'static TypeDescriptor,
    y_desc: &'static TypeDescriptor,
    data: Vec<u8>,
}

#[wasm_bindgen]
impl Bulkloader {
    pub async fn from_stream(
        ptrs: Vec<TraceHandle>,
        x_type: String,
        y_type: String,
        stream: wasm_streams::readable::sys::ReadableStream,
    ) -> Result<Bulkloader, JsValue> {
        use js_sys::Uint8Array;

        const ALLOC_ROWS: usize = 1440;

        let x_desc = TYPE_SIZES.get(x_type.as_str()).unwrap();
        let y_desc = TYPE_SIZES.get(y_type.as_str()).unwrap();
        let row_len_bytes = x_desc.size + y_desc.size * ptrs.len();
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
            ptrs,
            x_desc,
            y_desc,
            data: buffer,
        })
    }

    pub async fn from_array(
        ptrs: Vec<TraceHandle>,
        x_type: String,
        y_type: String,
        array: Uint8Array,
    ) -> Result<Bulkloader, JsValue> {
        let x_desc = TYPE_SIZES.get(x_type.as_str()).unwrap();
        let y_desc = TYPE_SIZES.get(y_type.as_str()).unwrap();

        Ok(Self {
            ptrs,
            x_desc,
            y_desc,
            data: array.to_vec(),
        })
    }

    pub fn apply(self, module: &mut DataModule) -> JsValue {
        serde_wasm_bindgen::to_value(&module.bulkload_segments(
            &self.ptrs,
            self.x_desc,
            self.y_desc,
            &self.data,
        ))
        .unwrap()
    }
}
