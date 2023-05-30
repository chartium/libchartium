use std::collections::HashMap;
use std::convert::TryInto;

use crate::prelude::*;
use crate::trace::Segment;
use lazy_static::lazy_static;

pub type DataIdx = usize;

pub struct TypeDescriptor {
    pub name: String,
    pub size: usize,
    pub parser: fn(&[u8]) -> RangePrec,
}

impl TypeDescriptor {
    pub fn new(name: impl Into<String>, size: usize, parser: fn(&[u8]) -> RangePrec) -> Self {
        Self {
            name: name.into(),
            size,
            parser,
        }
    }
}

macro_rules! type_map {
    ( "DateTime" ) => {
        i32
    };
    ( "I16" ) => {
        i16
    };
    ( "I32" ) => {
        i32
    };
    ( "I64" ) => {
        i64
    };
    ( "U8" ) => {
        u8
    };
    ( "U16" ) => {
        u16
    };
    ( "U32" ) => {
        u32
    };
    ( "U64" ) => {
        u64
    };
    ( "F32" ) => {
        f32
    };
    ( "F64" ) => {
        f64
    };
}

macro_rules! type_desc {
    ( $m:expr, $s:expr, $t:ty ) => {
        $m.insert(
            $s,
            TypeDescriptor::new($s, std::mem::size_of::<$t>(), |a| <$t>::from_le_bytes(a.try_into().unwrap()) as RangePrec),
        )
    };
    ( $m: expr, [ $($s:expr, $t:ty),+ ] ) => {
        $(
            type_desc!($m, $s, $t);
        )+
    };
    ( $m:expr ) => {
        type_desc!($m, [
            "DateTime", type_map!("DateTime"),
            "I16", type_map!("I16"),
            "I32", type_map!("I32"),
            "I64", type_map!("I64"),

            "U8", type_map!("U8"),
            "U16", type_map!("U16"),
            "U32", type_map!("U32"),
            "U64", type_map!("U64"),

            "F32", type_map!("F32"),
            "F64", type_map!("F64")
        ])
    };
}

lazy_static! {
    pub static ref TYPE_SIZES: HashMap<&'static str, TypeDescriptor> = {
        let mut m = HashMap::new();

        type_desc!(m);

        m
    };
}

pub fn create_segment(
    x_desc: &TypeDescriptor,
    y_desc: &TypeDescriptor,
    row_align: usize,
    from: RangePrec,
    to: RangePrec,
    mut d: Vec<u8>,
) -> Box<dyn Segment> {
    // FIXME row_align needs to be replaced by a more competent system
    // ! Right now misaligned data from backend would break (row_align != align_of::<(X, Y)>)
    let len = d.len() / row_align;
    let cap = d.capacity() / row_align;
    let ptr = d.as_mut_ptr();
    std::mem::forget(d);

    macro_rules! create_segment {
        ( $xt:ty, $yt:ty, $d:expr ) => {
            Box::new(crate::trace::TupleSegment::<$xt, $yt> {
                from,
                to,
                data: unsafe {
                    Vec::from_raw_parts(ptr as *mut crate::trace::PointTuple<$xt, $yt>, len, cap)
                },
            })
        };
    }

    match (x_desc.name.as_ref(), y_desc.name.as_ref()) {
        ("DateTime", "I16") => {
            create_segment!(type_map!("DateTime"), type_map!("I16"), d)
        }
        ("DateTime", "I32") => create_segment!(type_map!("DateTime"), type_map!("I32"), d),
        ("DateTime", "I64") => {
            create_segment!(type_map!("DateTime"), type_map!("I64"), d)
        }
        ("DateTime", "U8") => {
            create_segment!(type_map!("DateTime"), type_map!("U8"), d)
        }
        ("DateTime", "U16") => {
            create_segment!(type_map!("DateTime"), type_map!("U16"), d)
        }
        ("DateTime", "U32") => {
            create_segment!(type_map!("DateTime"), type_map!("U32"), d)
        }
        ("DateTime", "U64") => {
            create_segment!(type_map!("DateTime"), type_map!("U64"), d)
        }
        ("DateTime", "F32") => {
            create_segment!(type_map!("DateTime"), type_map!("F32"), d)
        }
        ("DateTime", "F64") => {
            create_segment!(type_map!("DateTime"), type_map!("F64"), d)
        }
        _ => panic!("Unknown XY pair"),
    }
}
