#![allow(clippy::unused_unit)]
#![allow(clippy::format_push_string)]
use wasm_bindgen::prelude::*;

pub mod data;
pub mod data_module;
pub mod renderers;
pub mod structs;
pub mod trace;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);

    #[wasm_bindgen(js_namespace = console, js_name = log)]
    fn log_obj(s: &JsValue);

    #[wasm_bindgen(js_namespace = console)]
    fn time(s: &str);

    #[wasm_bindgen(js_namespace = console, js_name = timeEnd)]
    fn time_end(s: &str);
}

#[wasm_bindgen]
pub fn set_panic_hook() {
    // When the `console_error_panic_hook` feature is enabled, we can call the
    // `set_panic_hook` function at least once during initialization, and then
    // we will get better error messages if our code ever panics.
    //
    // For more details see
    // https://github.com/rustwasm/console_error_panic_hook#readme
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}
