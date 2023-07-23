use std::collections::HashMap;
use std::convert::TryInto;

use crate::prelude::*;
use crate::trace::Segment;
use lazy_static::lazy_static;

pub type TraceHandle = usize;

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
    ( "i16" ) => {
        i16
    };
    ( "i32" ) => {
        i32
    };
    ( "i64" ) => {
        i64
    };
    ( "u8" ) => {
        u8
    };
    ( "u16" ) => {
        u16
    };
    ( "u32" ) => {
        u32
    };
    ( "u64" ) => {
        u64
    };
    ( "f32" ) => {
        f32
    };
    ( "f64" ) => {
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
            "i16", type_map!("i16"),
            "i32", type_map!("i32"),
            "i64", type_map!("i64"),

            "u8", type_map!("u8"),
            "u16", type_map!("u16"),
            "u32", type_map!("u32"),
            "u64", type_map!("u64"),

            "f32", type_map!("f32"),
            "f64", type_map!("f64")
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
    // FIXME row_align needs to be replaced by a more robust system
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
        ("DateTime", "i16") => {
            create_segment!(type_map!("DateTime"), type_map!("i16"), d)
        }
        ("DateTime", "i32") => create_segment!(type_map!("DateTime"), type_map!("i32"), d),
        ("DateTime", "i64") => {
            create_segment!(type_map!("DateTime"), type_map!("i64"), d)
        }
        ("DateTime", "u8") => {
            create_segment!(type_map!("DateTime"), type_map!("u8"), d)
        }
        ("DateTime", "u16") => {
            create_segment!(type_map!("DateTime"), type_map!("u16"), d)
        }
        ("DateTime", "u32") => {
            create_segment!(type_map!("DateTime"), type_map!("u32"), d)
        }
        ("DateTime", "u64") => {
            create_segment!(type_map!("DateTime"), type_map!("u64"), d)
        }
        ("DateTime", "f32") => {
            create_segment!(type_map!("DateTime"), type_map!("f32"), d)
        }
        ("DateTime", "f64") => {
            create_segment!(type_map!("DateTime"), type_map!("f64"), d)
        }
        _ => panic!("Unknown XY pair"),
    }
}
