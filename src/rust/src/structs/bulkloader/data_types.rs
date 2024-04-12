use std::collections::HashMap;

use lazy_static::lazy_static;

pub struct TypeDescriptor {
    pub name: String,
    pub size: usize,
    pub parser: fn(&[u8]) -> f64,
}

impl TypeDescriptor {
    pub fn new(name: impl Into<String>, size: usize, parser: fn(&[u8]) -> f64) -> Self {
        Self {
            name: name.into(),
            size,
            parser,
        }
    }
}

macro_rules! type_map {
    ( "DateTime" ) => {
        u32
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
            TypeDescriptor::new($s, std::mem::size_of::<$t>(), |a| <$t>::from_le_bytes(a.try_into().unwrap()) as f64),
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
