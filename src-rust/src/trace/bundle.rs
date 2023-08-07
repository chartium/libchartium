use dyn_clone::DynClone;

use crate::data::TraceHandle;

pub enum InterpolationStrategy {
    None,
    Nearest,
    Linear,
    Previous,
    Next,
}

pub trait Bundle: DynClone {
    fn traces(&self) -> Vec<TraceHandle>;
    fn from(&self) -> f64;
    fn to(&self) -> f64;

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
        interpolationStrategy: InterpolationStrategy,
    ) -> Box<dyn Iterator<Item = (f64, f64)> + 'a>;

    fn value_at(&self, trace: TraceHandle, x: f64) -> Option<f64>;

    fn shrink(&mut self, from: f64, to: f64);
    fn shift(&mut self, shift_x: f64, shift_y: f64);
}
