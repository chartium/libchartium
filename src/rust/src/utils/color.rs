// https://github.com/madonoharu/tsify/issues/42
#![allow(non_snake_case)]

use rand::rngs::SmallRng;
use rand::{Rng, SeedableRng};
use serde::{Deserialize, Serialize};
use std::f32::consts;
use tsify::Tsify;
use wasm_bindgen::prelude::wasm_bindgen;

use crate::trace_styles::{TraceColor, TraceRandomColorSpace};

#[derive(Clone, PartialEq, Eq, Hash, Tsify, Serialize, Deserialize)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct ResolvedColor {
    pub red: u8,
    pub green: u8,
    pub blue: u8,
    pub alpha: u8,
}
impl ResolvedColor {
    pub fn from_bytes([red, green, blue, alpha]: [u8; 4]) -> Self {
        Self {
            red,
            green,
            blue,
            alpha,
        }
    }
    pub fn from_floats(f: [f32; 4]) -> Self {
        Self {
            red: f2b(f[0]),
            green: f2b(f[1]),
            blue: f2b(f[2]),
            alpha: f2b(f[3]),
        }
    }
    pub fn as_bytes(&self) -> [u8; 4] {
        [self.red, self.green, self.blue, self.alpha]
    }
    pub fn as_floats(&self) -> [f32; 4] {
        self.as_bytes().b2f()
    }
}

#[inline(always)]
fn f2b(f: f32) -> u8 {
    (f * 255.) as u8
}
trait B2F {
    fn b2f(&self) -> [f32; 4];
}
impl B2F for [u8; 4] {
    #[inline(always)]
    fn b2f(&self) -> [f32; 4] {
        self.map(
            #[inline(always)]
            |b| b as f32 / 255.,
        )
    }
}

pub const BRIGHT: [(&str, [f32; 3]); 4] = [
    ("blue", [0.543, 0.674, 0.445]),
    ("purple", [0.878, 0.768, 0.594]),
    ("olive", [0.192, 0.680, 0.478]),
    ("orange", [0.055, 1., 0.527]),
];
pub const BRIGHT_HUE_OFFSET: f32 = 0.15 * consts::FRAC_1_SQRT_2;
pub const BRIGHT_LIGHTNESS_AMPLITUDE: f32 = -0.2;
pub const BRIGHT_LIGHTNESS_ANGULAR_VELOCITY: f32 = 2.5;

pub const PLOTLY: [[u8; 3]; 10] = [
    [31, 119, 180],
    [255, 127, 14],
    [44, 160, 44],
    [214, 39, 40],
    [148, 103, 189],
    [140, 86, 75],
    [227, 119, 194],
    [127, 127, 127],
    [188, 189, 34],
    [23, 190, 207],
];

#[wasm_bindgen(typescript_custom_section)]
const TS_ORUNSET: &'static str = r#"
export type PaletteName = "bright" | "plotly" | "rainbow";"#;

#[wasm_bindgen]
pub fn is_valid_palette_name(n: &str) -> bool {
    matches!(n, "bright" | "plotly" | "rainbow")
}

// "Missing Texture" magenta
// also see lib/utils/color.ts
pub const MISSING_COLOR: [u8; 4] = [0xff, 0x00, 0xdc, 0xff];

// Palette color
fn palette_color(palette_name: &str, palette_index: usize, total_count: usize) -> ResolvedColor {
    if palette_name == "rainbow" {
        let ratio = palette_index as f32 / (total_count + 1) as f32;
        return hsl_to_color(ratio, 0.5, 0.5);
    }

    if palette_name == "plotly" {
        let [r, g, b] = PLOTLY[palette_index % PLOTLY.len()];
        return ResolvedColor::from_bytes([r, g, b, 1]);
    }

    if palette_name == "bright" {
        return match palette_index {
            6 => hsl_to_color(0.1135, 0.783, 0.529),
            11 => hsl_to_color(0.278, 0.680, 0.2),
            _ => {
                let index = palette_index % BRIGHT.len();
                let generation = (palette_index / BRIGHT.len()) as f32;
                let hue_offset = generation * BRIGHT_HUE_OFFSET;
                let lightness_offset = BRIGHT_LIGHTNESS_AMPLITUDE
                    * f32::sin(generation * BRIGHT_LIGHTNESS_ANGULAR_VELOCITY);

                let [h, s, l] = BRIGHT[index].1;

                hsl_to_color(h + hue_offset, s, l + lightness_offset)
            }
        };
    }

    crate::warn(&format!("Unknown color palette: {}", palette_name));
    ResolvedColor::from_bytes(MISSING_COLOR)
}

// HSL to RGB
// https://stackoverflow.com/a/9493060/1137334
fn hue_to_intensity(p: f32, q: f32, t: f32) -> f32 {
    let t = t % 1.;

    match () {
        () if t < 1. / 6. => p + (q - p) * 6. * t,
        () if t < 2. / 3. => p + (q - p) * (2. / 3. - t) * 6.,
        () => p,
    }
}
pub fn hsl_to_color(h: f32, s: f32, l: f32) -> ResolvedColor {
    if s == 0. {
        return ResolvedColor::from_floats([l, l, l, 1.]);
    }

    let q = if l < 0.5 { l * (1. + s) } else { l + s - l * s };
    let p = 2. * l - q;
    let r = hue_to_intensity(p, q, h + 1. / 3.);
    let g = hue_to_intensity(p, q, h);
    let b = hue_to_intensity(p, q, h - 1. / 3.);

    ResolvedColor::from_floats([r, g, b, 1.])
}

pub fn hash_pair(x: usize, y: usize) -> usize {
    (1073741827 * x) + y
}

// Random color
pub fn random_contrasting_color(
    pref: &TraceRandomColorSpace,
    seed: usize,
    index: usize,
) -> ResolvedColor {
    let mut rng = SmallRng::seed_from_u64(hash_pair(seed, index) as u64);
    let mut random = || rng.gen::<f32>();

    // for a tutorial on custom probability distributions see:
    // https://programming.guide/generate-random-value-with-distribution.html

    let h = random();
    let s = (0.2 + random() * 0.8).sqrt();
    let l = 0.3 + random() * 0.5;

    const DEG: f32 = 1. / 360.;

    let contrast_with_dark = !(matches!(pref, TraceRandomColorSpace::ContrastWithLight));
    let contrast_with_light = !(matches!(pref, TraceRandomColorSpace::ContrastWithDark));

    // dark violet and dark red are unreadable against dark background
    if contrast_with_dark && l < 0.55 && !(210.0..10.).contains(&(h / DEG)) {
        return random_contrasting_color(pref, seed + 1, index);
    }

    // light yellow is unreadable against white background
    if contrast_with_light && l > 0.7 && (30.0..100.).contains(&(h / DEG)) {
        return random_contrasting_color(pref, seed + 1, index);
    }

    // the color is all right!
    hsl_to_color(h, s, l)
}

impl TraceColor {
    pub fn resolve(
        &self,
        palette_index: usize,
        total_count: usize,
        random_seed: usize,
    ) -> ResolvedColor {
        match self {
            TraceColor::Exact(rgba) => rgba.clone(),
            TraceColor::Random(r) => random_contrasting_color(r, random_seed, palette_index),
            TraceColor::PaletteAuto(palette_name) => {
                palette_color(palette_name, palette_index, total_count)
            }
        }
    }
}
