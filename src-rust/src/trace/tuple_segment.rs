use crate::structs::SegmentNumeric;

use crate::prelude::*;

use super::Segment;

#[repr(C)]
#[derive(Clone, Debug)]
pub struct PointTuple<X, Y>(X, Y);

#[derive(Clone)]
pub struct TupleSegment<X: Clone, Y: Clone> {
    pub from: RangePrec,
    pub to: RangePrec,

    pub data: Vec<PointTuple<X, Y>>,
}

impl<X: SegmentNumeric + Copy, Y: SegmentNumeric + Copy> Segment for TupleSegment<X, Y> {
    fn iter_in_range<'a>(
        &'a self,
        from: RangePrec,
        to: RangePrec,
    ) -> Box<dyn Iterator<Item = (RangePrec, RangePrec)> + 'a> {
        let from = from.max(self.from).min(self.to);
        let to = to.max(self.from).min(self.to);

        Box::new(
            self.data
                .iter()
                .skip_while(move |PointTuple(x, _)| x.to_rangeprec() < from)
                .take_while(move |PointTuple(x, _)| x.to_rangeprec() < to)
                .map(|PointTuple(x, y)| (x.to_rangeprec(), y.to_rangeprec())),
        )
    }

    // FIXME move to a common implementation in Segment trait
    fn value_at(&self, x: RangePrec) -> Option<RangePrec> {
        if !self.contains(x) {
            return None;
        }

        for window in self.data.windows(2) {
            let left = &window[0];
            let right = &window[1];

            if left.0.to_rangeprec() <= x && right.0.to_rangeprec() >= x {
                return Some(
                    ((right.0.to_rangeprec() - x) * left.1.to_rangeprec()
                        + (x - left.0.to_rangeprec()) * right.1.to_rangeprec())
                        / (right.0.to_rangeprec() - left.0.to_rangeprec()),
                );
            }
        }

        None
    }

    fn from(&self) -> RangePrec {
        self.from
    }

    fn to(&self) -> RangePrec {
        self.to
    }

    fn shrink(&mut self, from: RangePrec, to: RangePrec) {
        self.from = from;
        self.to = to;

        self.data
            .retain(|PointTuple(x, _)| x.to_rangeprec() >= from && x.to_rangeprec() <= to);
    }

    fn shift(&mut self, shift_x: RangePrec, shift_y: RangePrec) {
        self.from += shift_x;
        self.to += shift_x;

        for PointTuple(x, y) in self.data.iter_mut() {
            *x = X::from_rangeprec(x.to_rangeprec() + shift_x);
            *y = Y::from_rangeprec(y.to_rangeprec() + shift_y);
        }
    }
}
