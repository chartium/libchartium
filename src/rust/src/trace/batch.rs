use std::collections::HashMap;

use js_sys::{ArrayBuffer, Iterator};
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

fn export_to_csv(
    batch: Batch<f64, f64>,
    from: f64,
    to: f64,
    handles: Vec<TraceHandle>,
    interpolate_holes: bool,
) -> String {
    // TODO: turn into byob
    // TODO: think through the n² algorithm and whether we can go faster
    // TODO: get the to_string() impl
    // TODO: find a way to compare found_x and x
    // TODO: research some string builders or something, we're smushing a bžilion strings
    // TODO: rn ur doing it very statefully; maybe think of a way to make this more functional?
    // we iterate over all xs in this batch
    // and add only such ys for which we have x
    //┌──┐ ┌───────────────────┐
    //│xs│ │  traces_in_range  │
    //│  │ ├───────┬───────┬───┤
    //│  │ │trace_1│trace_2│...│
    //├──┤ ├───────┼───────┼───┤
    //│x1│ │ (x,y) │ (x,y) │ . │
    //│  │ │       │       │   │
    //│x2│ │ (x,y) │       │ . │
    //│  │ │       │       │   │
    //│x3│ │       │ (x,y) │ . │
    //│  │ │       │       │   │
    //│x4│ │ (x,y) │ (x,y) │ . │
    //│  │ │       │       │   │
    //│..│ │  ...  │  ...  │ . │

    let xs = batch.x;
    let trace_handles = batch.traces();
    let traces_in_range = trace_handles
        .into_iter()
        .map(|handle: u32| batch.iter_in_range_f64(handle, from, to).peekable());

    let mut output: String = String::new();
    let record_x = |x: &f64| output.push_str(&format!("{},", x.to_string()));
    let record_y = |y: &f64| output.push_str(&format!("{},", y.to_string()));
    let record_no_y_found = || output.push_str(",");
    let record_end_line = || output.push_str("\n");

    xs.into_iter().for_each(|&x| {
        record_x(x);

        traces_in_range.for_each(|trace| {
            // TODO: think through the n² algorithm
            let first = trace.peek();
            match first {
                Some((found_x, found_y)) => {
                    if found_x == x {
                        // TODO: find a way to compare found_x and x
                        record_y(found_y);
                        trace.next();
                    } else if interpolate_holes {
                        // interpolate
                    } else {
                        record_no_y_found();
                    }
                }
                None => {
                    record_no_y_found();
                }
            }
        });
        record_end_line();
    });
    return output;
}

impl<X: N, Y: N> Batch<X, Y> {
    pub fn new(x: Vec<X>, ys: HashMap<TraceHandle, Vec<Y>>) -> Self {
        let from = x.first().unwrap().as_f64();
        let to = x.last().unwrap().as_f64();

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

    fn iter_many_in_range_f64<'a>(
        &'a self,
        traces: Vec<TraceHandle>,
        from: f64,
        to: f64,
    ) -> Box<dyn Iterator<Item = Vec<f64>> + 'a> {
        let index = self
            .x
            .iter()
            .enumerate()
            .find(move |(_, x)| x.as_f64() >= from)
            .map(|(i, _)| i)
            .unwrap_or(usize::MAX);

        Box::new(BatchManyIterator {
            batch: self,
            traces,
            index,
            to,
        })
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

struct BatchManyIterator<'a, X: N, Y: N> {
    batch: &'a Batch<X, Y>,
    traces: Vec<TraceHandle>,
    to: f64,
    index: usize,
}

impl<'a, X: N, Y: N> Iterator for BatchManyIterator<'a, X, Y> {
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
            let y = &self.batch.ys[t];
            result.push(y[self.index].as_f64());
        }
        self.index += 1;

        Some(result)
    }
}
