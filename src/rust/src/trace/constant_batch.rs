use std::{collections::HashMap, vec};

use crate::{data::TraceHandle, types::NumericRange};

use super::{Bundle, BundleRange, InterpolationStrategy, N};

#[derive(Clone)]
pub struct ConstantBatch<Y: N> {
    pub ys: HashMap<TraceHandle, Y>,
}

impl<Y: N> ConstantBatch<Y> {
    pub fn new(ys: HashMap<TraceHandle, Y>) -> Self {
        Self { ys }
    }
}

impl<Y: N> Bundle for ConstantBatch<Y> {
    fn traces(&self) -> Vec<crate::data::TraceHandle> {
        self.ys.keys().copied().collect()
    }

    fn contains_trace(&self, trace: TraceHandle) -> bool {
        self.ys.contains_key(&trace)
    }

    fn range(&self) -> BundleRange {
        BundleRange::Everywhere
    }

    fn point_count(&self) -> usize {
        2
    }

    fn iter_in_range_f64<'a>(
        &'a self,
        handle: crate::data::TraceHandle,
        x_range: NumericRange,
    ) -> Box<dyn Iterator<Item = (f64, f64)> + 'a> {
        Box::new(
            self.iter_in_range_with_neighbors_f64(handle, x_range)
                .skip_while(move |(x, _)| *x < x_range.from)
                .take_while(move |(x, _)| *x <= x_range.to),
        )
    }

    fn iter_in_range_with_neighbors_f64<'a>(
        &'a self,
        handle: crate::data::TraceHandle,
        x_range: NumericRange,
    ) -> Box<dyn Iterator<Item = (f64, f64)> + 'a> {
        let Some(y) = self.ys.get(&handle).map(|y| y.as_f64()) else {
            return Box::new(std::iter::empty());
        };

        Box::new([(x_range.from, y), (x_range.to, y)].into_iter())
    }

    fn iter_many_in_range_f64<'a>(
        &'a self,
        handles: Vec<crate::data::TraceHandle>,
        x_range: NumericRange,
    ) -> Box<dyn Iterator<Item = Vec<f64>> + 'a> {
        let mut ys: Vec<f64> = handles
            .into_iter()
            .map(|handle| self.ys.get(&handle))
            .filter(|y| y.is_some())
            .map(|y| y.unwrap().as_f64())
            .collect();
        let mut from = vec![x_range.from];
        from.append(&mut ys.clone());
        let mut to = vec![x_range.to];
        to.append(&mut ys);
        Box::new([from, to].into_iter())
    }

    fn value_at(
        &self,
        trace: crate::data::TraceHandle,
        x: f64,
        _interpolation_strategy: InterpolationStrategy,
    ) -> Option<(f64, f64)> {
        self.ys.get(&trace).map(|y| (x, y.as_f64()))
    }
}
