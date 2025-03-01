use std::collections::HashMap;

use num_traits::{FromPrimitive, Num, ToPrimitive};

use crate::{data::TraceHandle, types::NumericRange};

use super::{Bundle, BundleRange, InterpolationStrategy};

pub trait N: Num + Clone + ToPrimitive + FromPrimitive {
    fn as_f64(&self) -> f64 {
        self.to_f64().unwrap()
    }
}
impl<T: Num + Clone + ToPrimitive + FromPrimitive> N for T {}

#[derive(Clone)]
pub struct Batch<X: N, Y: N> {
    x: Vec<X>,
    y: Vec<Y>,
    y_idx: HashMap<TraceHandle, usize>,

    from: f64,
    to: f64,
}

impl<X: N, Y: N> Batch<X, Y> {
    pub fn new(x: Vec<X>, y: Vec<Y>, handles: &[TraceHandle]) -> Self {
        let from = x.first().unwrap().as_f64();
        let to = x.last().unwrap().as_f64();

        assert_eq!(
            y.len(),
            x.len() * handles.len(),
            "length of y matches (length of x * number of handles)"
        );

        let y_idx = HashMap::from_iter(handles.iter().enumerate().map(|(i, handle)| (*handle, i)));

        Self {
            x,
            y,
            y_idx,
            from,
            to,
        }
    }

    pub fn get_y_data_of(&self, trace: TraceHandle) -> Option<&[Y]> {
        let window = self.x.len();

        self.y_idx.get(&trace).map(|idx| {
            let offset = idx * window;

            &self.y[offset..(offset + window)]
        })
    }
}

impl<X: N + Ord, Y: N> Bundle for Batch<X, Y> {
    fn traces(&self) -> Vec<TraceHandle> {
        self.y_idx.keys().copied().collect()
    }

    fn contains_trace(&self, trace: TraceHandle) -> bool {
        self.y_idx.contains_key(&trace)
    }

    fn range(&self) -> BundleRange {
        BundleRange::Bounded {
            from: self.from.as_f64(),
            to: self.to.as_f64(),
        }
    }

    fn point_count(&self) -> usize {
        self.x.len()
    }

    fn iter_in_range_f64<'a>(
        &'a self,
        trace: TraceHandle,
        x_range: NumericRange,
    ) -> Box<dyn Iterator<Item = (f64, f64)> + 'a> {
        let Some(data) = self.get_y_data_of(trace) else {
            return Box::new(std::iter::empty());
        };

        let from = match self.x.binary_search(&X::from_f64(x_range.from).unwrap()) {
            Ok(i) | Err(i) => i,
        };

        Box::new(
            self.x
                .iter()
                .zip(data.iter())
                .skip(from)
                .take_while(move |(x, _)| x.as_f64() <= x_range.to)
                .map(|(x, y)| (x.as_f64(), y.as_f64())),
        )
    }

    fn iter_in_range_with_neighbors_f64<'a>(
        &'a self,
        handle: TraceHandle,
        x_range: NumericRange,
    ) -> Box<dyn Iterator<Item = (f64, f64)> + 'a> {
        let Some(data) = self.get_y_data_of(handle) else {
            return Box::new(std::iter::empty());
        };

        let from = match self.x.binary_search(&X::from_f64(x_range.from).unwrap()) {
            Ok(i) => i,
            Err(0) => 0,
            Err(i) if i == self.x.len() => return Box::new(std::iter::empty()),
            Err(i) => i - 1,
        };

        let take = match self.x[from..].binary_search(&X::from_f64(x_range.to).unwrap()) {
            // x_range.to is before from
            Err(0) => return Box::new(std::iter::empty()),
            Ok(i) | Err(i) => i + 1,
        };

        Box::new(
            self.x
                .iter()
                .zip(data.iter())
                .skip(from)
                .take(take)
                .map(|(x, y)| (x.as_f64(), y.as_f64())),
        )
    }

    fn iter_many_in_range_f64<'a>(
        &'a self,
        traces: Vec<TraceHandle>,
        x_range: NumericRange,
    ) -> Box<dyn Iterator<Item = Vec<f64>> + 'a> {
        let index = match self.x.binary_search(&X::from_f64(x_range.from).unwrap()) {
            Ok(i) => i,
            Err(i) => i,
        };

        Box::new(BatchManyIterator {
            batch: self,
            traces,
            index,
            to: x_range.to,
        })
    }

    fn value_at(
        &self,
        handle: TraceHandle,
        x: f64,
        strategy: InterpolationStrategy,
    ) -> Option<(f64, f64)> {
        if !self.contains_point(x) {
            return None;
        }

        let data = self.get_y_data_of(handle)?;

        match self.x.binary_search(&X::from_f64(x).unwrap()) {
            Err(0) => None,
            Err(i) if i == self.x.len() => None,
            Ok(i) => Some((x, data[i].as_f64())),
            Err(i) => {
                let left_x = self.x[i - 1].as_f64();
                let right_x = self.x[i].as_f64();

                let left_y = data[i - 1].as_f64();
                let right_y = data[i].as_f64();

                match strategy {
                    InterpolationStrategy::None => None,
                    InterpolationStrategy::Previous => (left_x, left_y).into(),
                    InterpolationStrategy::Next => (right_x, right_y).into(),
                    InterpolationStrategy::Nearest => {
                        if (x - left_x) < (right_x - x) {
                            (left_x, left_y).into()
                        } else {
                            (right_x, right_y).into()
                        }
                    }
                    InterpolationStrategy::Linear => {
                        let frac = (x - left_x) / (right_x - left_x);

                        Some((x, right_y * frac + left_y * (1.0 - frac)))
                    }
                }
            }
        }
    }
}

struct BatchManyIterator<'a, X: N, Y: N> {
    batch: &'a Batch<X, Y>,
    traces: Vec<TraceHandle>,
    to: f64,
    index: usize,
}

impl<X: N, Y: N> Iterator for BatchManyIterator<'_, X, Y> {
    type Item = Vec<f64>;
    fn next(&mut self) -> Option<Self::Item> {
        if self.index >= self.batch.x.len() {
            return None;
        }

        let xi = self.batch.x[self.index].as_f64();
        if xi > self.to {
            return None;
        }

        let mut result = Vec::with_capacity(self.traces.len() + 1);
        result.push(xi);

        for t in &self.traces {
            let y = self.batch.get_y_data_of(*t).unwrap();

            result.push(y[self.index].as_f64());
        }
        self.index += 1;

        Some(result)
    }
}
