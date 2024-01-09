use std::collections::HashMap;

use num_traits::{FromPrimitive, Num, ToPrimitive};

use crate::data::TraceHandle;

use super::{Bundle, InterpolationStrategy};

pub trait N: Num + Clone + ToPrimitive + FromPrimitive {
    fn as_f64(&self) -> f64 {
        self.to_f64().unwrap()
    }
}
impl<T: Num + Clone + ToPrimitive + FromPrimitive> N for T {}

#[derive(Clone)]
pub struct Batch<X: N, Y: N> {
    pub x: Vec<X>,
    pub ys: HashMap<TraceHandle, Vec<Y>>,

    from: f64,
    to: f64,
}

impl<X: N, Y: N> Batch<X, Y> {
    pub fn new(x: Vec<X>, ys: HashMap<TraceHandle, Vec<Y>>) -> Self {
        let from = x.first().unwrap().clone().as_f64();
        let to = x.last().unwrap().clone().as_f64();

        Self { x, ys, from, to }
    }
}

impl<X: N, Y: N> Bundle for Batch<X, Y> {
    fn traces(&self) -> Vec<TraceHandle> {
        self.ys.keys().copied().collect()
    }

    fn from(&self) -> f64 {
        self.from.as_f64()
    }

    fn to(&self) -> f64 {
        self.to.as_f64()
    }

    fn point_count(&self) -> usize {
        self.x.len()
    }

    fn iter_in_range_f64<'a>(
        &'a self,
        trace: TraceHandle,
        from: f64,
        to: f64,
    ) -> Box<dyn Iterator<Item = (f64, f64)> + 'a> {
        Box::new(
            self.x
                .iter()
                .enumerate()
                .skip_while(move |(_, x)| x.as_f64() < from)
                .take_while(move |(_, x)| x.as_f64() <= to)
                .map(move |(i, x)| (x.as_f64(), self.ys.get(&trace).map(|y| y[i].as_f64())))
                .filter_map(|(x, maybe_y)| maybe_y.map(|y| (x, y))),
        )
    }

    fn value_at(
        &self,
        handle: TraceHandle,
        x: f64,
        strategy: InterpolationStrategy,
    ) -> Option<f64> {
        if !self.contains(x) {
            return None;
        }

        // ! FIXME perform a binary search
        for (i, window) in self.x.windows(2).enumerate() {
            let left = &window[0];
            let right = &window[1];
            let left_x = left.as_f64();
            let right_x = right.as_f64();

            if left.as_f64() <= x && right.as_f64() >= x {
                let left_y = self.ys[&handle][i].as_f64();
                let right_y = self.ys[&handle][i + 1].as_f64();
                match strategy {
                    InterpolationStrategy::Previous => return left_y.into(),
                    InterpolationStrategy::Next => return right_y.into(),
                    InterpolationStrategy::None => {
                        let xx = X::from_f64(x).unwrap();
                        if xx == *left {
                            return left_y.into();
                        }
                        if xx == *right {
                            return right_y.into();
                        }
                        return None;
                    }
                    InterpolationStrategy::Nearest => {
                        if (x - left_x) < (right_x - x) {
                            return left_y.into();
                        } else {
                            return right_y.into();
                        }
                    }
                    InterpolationStrategy::Linear => {
                        let frac = (x - left_x) / (right_x - left_x);

                        return Some(right_y * frac + left_y * (1.0 - frac));
                    }
                }
            }
        }

        None
    }
}
