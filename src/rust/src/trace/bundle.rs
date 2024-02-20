use crate::data::TraceHandle;
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
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
        handle: TraceHandle,
        from: f64,
        to: f64,
    ) -> Box<dyn Iterator<Item = (f64, f64)> + 'a>;

    fn iter_many_in_range_f64<'a>(
        &'a self,
        handles: Vec<TraceHandle>,
        from: f64,
        to: f64,
    ) -> Box<dyn Iterator<Item = Vec<f64>> + 'a>;

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

impl From<Box<dyn Bundle>> for BoxedBundle {
    fn from(bundle: Box<dyn Bundle>) -> Self {
        BoxedBundle { bundle }
    }
}

impl BoxedBundle {
    pub fn new(bundle: impl Bundle + 'static) -> BoxedBundle {
        BoxedBundle {
            bundle: Box::new(bundle),
        }
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
    /// ### Fills input buffer with trace data from input range (including both endpoints) and handle array, returns number of valid elements
    /// * Buffer format is always \[x, y₁, y₂,… yₙ, x', y'₁, …], i.e. each datapoint takes up n+1 elements of the buffer (given n trace handles on input)
    ///   * Therefore returned number is always a multiple of `trace_handles.length()+1`
    ///   * Only whole datapoints are recorded. If there isn't space for n+1 more elements left the remaining space will remain unchanged
    ///   * The same applies for the end of the range
    // FIXME not used for batches? idk lol
    // /// * If any trace doesn't have data for an x, the y datapoint get's interpolated via interpolation_strategy
    // ///   * if interpolation_strategy == InterpolationStrategy::None, the y will be NaN
    pub fn export_to_buffer(
        &self,
        buffer: &mut [f64],
        trace_handles: &[u32],
        range_from: f64,
        range_to: f64,
        //interpolation_strategy: InterpolationStrategy,
    ) -> usize {
        let datapoint_length = trace_handles.len() + 1;
        let space_in_buffer = buffer.len() / datapoint_length;
        if space_in_buffer == 0 {
            return 0;
        }
        let mut iterator =
            self.bundle
                .iter_many_in_range_f64(trace_handles.to_vec(), range_from, range_to);
        for i in 0..space_in_buffer {
            if let Some(datapoint) = iterator.next() {
                buffer[i * datapoint_length..(i + 1) * datapoint_length]
                    .copy_from_slice(datapoint.as_slice());
            } else {
                return i * datapoint_length;
            }
        }

        space_in_buffer * datapoint_length
    }
}
