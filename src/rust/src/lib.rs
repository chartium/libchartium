#![allow(clippy::unused_unit)]
#![allow(clippy::format_push_string)]
use wasm_bindgen::prelude::*;

pub mod data;
pub mod renderers;
pub mod structs;
pub mod trace;
pub mod utils;

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

#[macro_export]
macro_rules! console_log {
    ($($t:tt)*) => ($crate::log(&format!($($t)*)))
}
#[wasm_bindgen]
pub fn set_panic_hook() {
    // For more details see
    // https://github.com/rustwasm/console_error_panic_hook#readme
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}
