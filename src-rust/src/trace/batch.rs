use std::{collections::HashMap, rc::Rc};

use num_traits::{Num, ToPrimitive};

use crate::{data::TraceHandle, prelude::*, structs::SegmentNumeric};

use super::{Bundle, InterpolationStrategy};

trait N: Num + Clone + ToPrimitive {}
impl<T: Num + Clone + ToPrimitive> N for T {}

#[derive(Clone)]
pub struct Batch<X: N, Y: N>
{
    pub x: Vec<X>,
    pub ys: HashMap<TraceHandle, Vec<Y>>,

    from: X,
    to: X,
}

impl<X: N, Y: N> Batch<X, Y>
{
    pub fn new(x: Vec<X>, ys: HashMap<TraceHandle, Vec<Y>>) -> Self {
        let from = x.first().cloned().unwrap_or(X::one());
        let to = x.last().cloned().unwrap_or(X::zero());

        Self { x, ys, from, to }
    }
}

impl<X: N, Y: N> Bundle for Batch<X, Y>
{
    fn traces(&self) -> Vec<TraceHandle> {
        self.ys.keys().map(|x| *x).collect()
    }

    fn from(&self) -> f64 {
        self.from.to_f64().unwrap()
    }

    fn to(&self) -> f64 {
        self.to.to_f64().unwrap()
    }

    fn iter_in_range_f64<'a>(
        &'a self,
        trace: TraceHandle,
        from: f64,
        to: f64,
        strategy: InterpolationStrategy
    ) -> Box<dyn Iterator<Item = (f64, f64)> + 'a> {
        Box::new(
            self.x
                .iter()
                .enumerate()
                .skip_while(move |(_, x)| x.to_f64().unwrap() < from)
                .take_while(move |(_, x)| x.to_f64().unwrap() <= to)
                .map(|(i, &x)| (x.to_f64().unwrap(), self.ys[&trace][i].to_f64().unwrap())),
        )
    }

    // ! FIXME perform a binary search
    fn value_at(&self, x: RangePrec) -> Option<RangePrec> {
        if !self.contains(x) {
            return None;
        }

        for (i, window) in self.x.windows(2).enumerate() {
            let left = window[0];
            let right = window[1];

            if left.to_rangeprec() <= x && right.to_rangeprec() >= x {
                return Some(
                    ((right.to_rangeprec() - x) * self.ys[i]
                        + (x - left.to_rangeprec()) * self.ys[i + 1])
                        / (right.to_rangeprec() - left.to_rangeprec()),
                );
            }
        }

        None
    }

    fn shrink(&mut self, from: RangePrec, to: RangePrec) {
        let mut next_x = vec![];
        let mut next_y = vec![];

        self.x
            .iter()
            .zip(self.ys.iter())
            .skip_while(|(x, _)| x.to_rangeprec() < from)
            .take_while(|(x, _)| x.to_rangeprec() <= to)
            .for_each(|(x, y)| {
                next_x.push(*x);
                next_y.push(*y);
            });

        self.from = from;
        self.to = to;

        self.x = Rc::new(next_x);
        self.ys = Rc::new(next_y);
    }

    fn shift(&mut self, shift_x: RangePrec, shift_y: RangePrec) {
        self.from += shift_x;
        self.to += shift_x;

        println!("{}", self.from);

        self.x = Rc::new(
            self.x
                .iter()
                .copied()
                .map(|x| (x as RangePrec + shift_x) as u64)
                .collect(),
        );
        self.ys = Rc::new(self.ys.iter().copied().map(|y| y + shift_y).collect());
    }
}
