use crate::prelude::*;

pub trait SegmentNumeric {
    fn to_rangeprec(self) -> RangePrec;
    fn to_dataprec(self) -> DataPrec;
    fn from_rangeprec(n: RangePrec) -> Self;
    fn from_dataprec(n: DataPrec) -> Self;
}

macro_rules! impl_segment {
    ($t:ty) => {
        impl SegmentNumeric for $t {
            fn to_rangeprec(self) -> RangePrec {
                self as RangePrec
            }
            fn to_dataprec(self) -> DataPrec {
                self as DataPrec
            }

            fn from_rangeprec(n: RangePrec) -> Self {
                n as $t
            }

            fn from_dataprec(n: DataPrec) -> Self {
                n as $t
            }
        }
    };
    ($t:ty, $($tail:tt)*) => {
        impl_segment!($t);
        impl_segment!($($tail)*);
    };
}

impl_segment!(f32, f64);
impl_segment!(i8, i16, i32, i64);
impl_segment!(u8, u16, u32, u64);
