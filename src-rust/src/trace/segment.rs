use dyn_clone::DynClone;

use crate::prelude::*;

pub trait Segment: DynClone {
    fn from(&self) -> RangePrec;
    fn to(&self) -> RangePrec;

    fn contains(&self, point: RangePrec) -> bool {
        self.from() <= point && self.to() >= point
    }

    fn intersects(&self, from: RangePrec, to: RangePrec) -> bool {
        self.from() <= to && self.to() >= from
    }

    fn iter_in_range<'a>(
        &'a self,
        from: RangePrec,
        to: RangePrec,
    ) -> Box<dyn Iterator<Item = (RangePrec, RangePrec)> + 'a>;

    // ! FIXME perform a binary search
    fn value_at(&self, x: RangePrec) -> Option<RangePrec>;

    fn shrink(&mut self, from: RangePrec, to: RangePrec);
    fn shift(&mut self, shift_x: RangePrec, shift_y: RangePrec);
}
