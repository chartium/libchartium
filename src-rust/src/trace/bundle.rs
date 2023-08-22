use crate::data::TraceHandle;
use wasm_bindgen::prelude::wasm_bindgen;

pub enum InterpolationStrategy {
    None,
    Nearest,
    Linear,
    Previous,
    Next,
}

pub trait Bundle {
    fn traces(&self) -> Vec<TraceHandle>;
    fn from(&self) -> f64;
    fn to(&self) -> f64;
    fn point_count(&self) -> usize;

    fn contains(&self, point: f64) -> bool {
        self.from() <= point && self.to() >= point
    }

    fn intersects(&self, from: f64, to: f64) -> bool {
        self.from() <= to && self.to() >= from
    }

    fn iter_in_range_f64<'a>(
        &'a self,
        trace: TraceHandle,
        from: f64,
        to: f64,
    ) -> Box<dyn Iterator<Item = (f64, f64)> + 'a>;

    fn value_at(
        &self,
        trace: TraceHandle,
        x: f64,
        interpolation_strategy: InterpolationStrategy,
    ) -> Option<f64>;
}

#[wasm_bindgen]
pub struct BoxedBundle {
    bundle: Box<dyn Bundle>,
}

impl BoxedBundle {
    pub fn new(bundle: Box<dyn Bundle>) -> BoxedBundle {
        BoxedBundle { bundle }
    }

    #[allow(clippy::borrowed_box)]
    pub fn unwrap(&self) -> &Box<dyn Bundle> {
        &self.bundle
    }
}

#[wasm_bindgen]
impl BoxedBundle {
    pub fn traces(&self) -> Box<[TraceHandle]> {
        self.bundle.traces().into_boxed_slice()
    }
    pub fn from(&self) -> f64 {
        self.bundle.from()
    }
    pub fn to(&self) -> f64 {
        self.bundle.to()
    }
    pub fn point_count(&self) -> usize {
        self.bundle.point_count()
    }
    pub fn contains(&self, point: f64) -> bool {
        self.bundle.contains(point)
    }
    pub fn intersects(&self, from: f64, to: f64) -> bool {
        self.bundle.intersects(from, to)
    }
}
