use std::rc::Rc;

use crate::{prelude::*, structs::SegmentNumeric};

use super::Segment;

#[derive(Clone)]
pub struct SharedSegment {
    pub x: Rc<Vec<u64>>,
    pub y: Rc<Vec<f64>>,

    from: RangePrec,
    to: RangePrec,
}

impl SharedSegment {
    pub fn new(x: Rc<Vec<u64>>, y: Rc<Vec<f64>>) -> Self {
        let from = x.first().copied().unwrap_or(1) as RangePrec;
        let to = x.last().copied().unwrap_or(0) as RangePrec;

        Self { x, y, from, to }
    }
}

impl Segment for SharedSegment {
    fn from(&self) -> RangePrec {
        self.from
    }

    fn to(&self) -> RangePrec {
        self.to
    }

    fn iter_in<'a>(
        &'a self,
        from: RangePrec,
        to: RangePrec,
    ) -> Box<dyn Iterator<Item = (crate::prelude::DataPrec, crate::prelude::DataPrec)> + 'a> {
        Box::new(
            self.x
                .iter()
                .zip(self.y.iter())
                .skip_while(move |(&x, _)| (x as RangePrec) < from)
                .take_while(move |(&x, _)| (x as RangePrec) <= to)
                .map(|(&x, &y)| (x as DataPrec, y as DataPrec)),
        )
    }

    fn iter_with_origin<'a>(
        &'a self,
        from: RangePrec,
        to: RangePrec,
        x_orig: RangePrec,
        y_orig: RangePrec,
    ) -> Box<dyn Iterator<Item = (crate::prelude::DataPrec, crate::prelude::DataPrec)> + 'a> {
        Box::new(
            self.x
                .iter()
                .enumerate()
                .skip_while(move |(_, x)| (**x as RangePrec) < from)
                .take_while(move |(_, x)| (**x as RangePrec) <= to)
                .map(move |(i, &x)| {
                    (
                        (x as RangePrec - x_orig) as DataPrec,
                        (self.y[i] - y_orig) as DataPrec,
                    )
                }),
        )
    }

    fn iter_high_prec<'a>(
        &'a self,
        from: RangePrec,
        to: RangePrec,
    ) -> Box<dyn Iterator<Item = (RangePrec, RangePrec)> + 'a> {
        Box::new(
            self.x
                .iter()
                .enumerate()
                .skip_while(move |(_, x)| (**x as RangePrec) < from)
                .take_while(move |(_, x)| (**x as RangePrec) <= to)
                .map(|(i, &x)| (x as RangePrec, self.y[i] as RangePrec)),
        )
    }

    fn value_at(&self, x: RangePrec) -> Option<RangePrec> {
        if !self.contains(x) {
            return None;
        }

        for (i, window) in self.x.windows(2).enumerate() {
            let left = window[0];
            let right = window[1];

            if left.to_rangeprec() <= x && right.to_rangeprec() >= x {
                return Some(
                    ((right.to_rangeprec() - x) * self.y[i]
                        + (x - left.to_rangeprec()) * self.y[i + 1])
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
            .zip(self.y.iter())
            .skip_while(|(x, _)| x.to_rangeprec() < from)
            .take_while(|(x, _)| x.to_rangeprec() <= to)
            .for_each(|(x, y)| {
                next_x.push(*x);
                next_y.push(*y);
            });

        self.from = from;
        self.to = to;

        self.x = Rc::new(next_x);
        self.y = Rc::new(next_y);
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
        self.y = Rc::new(self.y.iter().copied().map(|y| y + shift_y).collect());
    }
}
