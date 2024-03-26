use wasm_bindgen::prelude::wasm_bindgen;

use crate::structs::{TraceColor, TraceRandomColorSpace};

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = Math)]
    fn random() -> f32;

    #[wasm_bindgen(js_namespace = console)]
    fn warn(msg: &str);
}

pub const BRIGHT: [(&str, [f32; 3]); 6] = [
    ("blue", [0.543, 0.674, 0.445]),
    ("purple", [0.878, 0.768, 0.594]),
    ("olive", [0.192, 0.680, 0.478]),
    ("orange", [0.078, 1., 0.527]),
    ("green", [0.278, 0.680, 0.478]),
    ("yellow", [0.1135, 0.783, 0.529]),
];

#[wasm_bindgen]
pub fn is_valid_palette_name(n: &str) -> bool {
    n == "bright" || n == "rainbow"
}

// Palette color
fn palette_color(palette_name: &str, palette_index: usize, total_count: usize) -> [f32; 4] {
    if palette_name == "bright" {
        let [h, s, l] = BRIGHT[palette_index % BRIGHT.len()].1;
        return hsl_to_color(h, s, l);
    }

    if palette_name == "rainbow" {
        return hsl_to_color(0.5, palette_index as f32 / total_count as f32, 0.5);
    }

    warn(&format!("Unknown color palette: {}", palette_name));
    [1., 0., 0.86, 1.] // "Missing Texture" magenta
}

// HSL to RGB
// https://stackoverflow.com/a/9493060/1137334
fn hue_to_intensity(p: f32, q: f32, t: f32) -> f32 {
    match () {
        () if t < 0. => hue_to_intensity(p, q, t + 1.),
        () if t > 1. => hue_to_intensity(p, q, t - 1.),
        () if t < 1. / 6. => p + (q - p) * 6. * t,
        () if t < 2. / 3. => p + (q - p) * (2. / 3. - t) * 6.,
        () => p,
    }
}
pub fn hsl_to_color(h: f32, s: f32, l: f32) -> [f32; 4] {
    if s == 0. {
        return [l, l, l, 1.];
    }

    let q = if l < 0.5 { l * (1. + s) } else { l + s - l * s };
    let p = 2. * l - q;
    let r = hue_to_intensity(p, q, h + 1. / 3.);
    let g = hue_to_intensity(p, q, h);
    let b = hue_to_intensity(p, q, h - 1. / 3.);

    [r, g, b, 1.]
}

// Random color
pub fn random_contrasting_color(pref: &TraceRandomColorSpace) -> [f32; 4] {
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
        return random_contrasting_color(pref);
    }

    // light yellow is unreadable against white background
    if contrast_with_light && l > 0.7 && (30.0..100.).contains(&(h / DEG)) {
        return random_contrasting_color(pref);
    }

    // the color is all right!
    hsl_to_color(h, s, l)
}

impl TraceColor {
    pub fn resolve(&self, palette_index: usize, total_count: usize) -> [f32; 4] {
        match self {
            TraceColor::Exact(rgba) => *rgba,
            TraceColor::Random(r) => random_contrasting_color(r),
            TraceColor::PaletteAuto(palette_name) => {
                palette_color(palette_name, palette_index, total_count)
            }
        }
    }
}
