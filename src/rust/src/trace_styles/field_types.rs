// https://github.com/madonoharu/tsify/issues/42
#![allow(non_snake_case)]

use std::hash::Hash;

use serde::{Deserialize, Serialize};
use tsify::Tsify;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

use crate::{derive_static_default, trace_styles::utils::StaticDefault, utils::ResolvedColor};

#[derive(Clone, PartialEq, Eq, Hash, Tsify, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TraceColor {
    Exact(ResolvedColor),
    Random(TraceRandomColorSpace),
    PaletteAuto(String),
}

#[derive(Clone, Copy, PartialEq, Eq, Hash, Tsify, Serialize, Deserialize)]
pub enum TraceRandomColorSpace {
    #[serde(rename = "random")]
    ContrastWithBoth,
    #[serde(rename = "random-on-light-background")]
    ContrastWithLight,
    #[serde(rename = "random-on-dark-background")]
    ContrastWithDark,
}
#[wasm_bindgen(typescript_custom_section)]
const TS_COLOR_SPACE_GUARD: &'static str =
    r#"export function is_trace_random_color_space(s: unknown): s is TraceRandomColorSpace;"#;
#[wasm_bindgen(skip_typescript)]
pub fn is_trace_random_color_space(s: JsValue) -> bool {
    TraceRandomColorSpace::from_js(s).is_ok()
}

#[derive(Clone, Copy, PartialEq, Tsify, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TraceLineStyle {
    None,
    Solid,
    Dashed([f32; 2]),
    DoubleDashed([f32; 4]),
}
derive_static_default!(TraceLineStyle, TraceLineStyle::Solid);

impl TraceLineStyle {
    pub fn is_solid(&self) -> bool {
        matches!(self, TraceLineStyle::None | TraceLineStyle::Solid)
    }
}

#[derive(Clone, Copy, Default, PartialEq, Tsify, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TracePointsStyle {
    #[default]
    None,
    Show,
}
derive_static_default!(TracePointsStyle, TracePointsStyle::None);

#[wasm_bindgen(typescript_custom_section)]
const TS_PALETTE_INDEX: &'static str = r#"export type TracePaletteIndex = number | "auto";"#;
#[derive(Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TracePaletteIndex {
    Auto,
    #[serde(untagged)]
    Some(usize),
}
derive_static_default!(TracePaletteIndex, TracePaletteIndex::Auto);

#[derive(Clone, Copy, Default, PartialEq, Tsify, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TraceFillStyle {
    #[default]
    None,
    ToZeroY,
}
derive_static_default!(TraceFillStyle, TraceFillStyle::None);
