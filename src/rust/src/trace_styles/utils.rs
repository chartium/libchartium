use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::wasm_bindgen;

pub trait StaticDefault {
    fn default() -> &'static Self;
}
#[macro_export]
macro_rules! derive_static_default {
    ($t:ty, $v:expr) => {
        const _: () = {
            const STATIC_DEFAULT: $t = $v;
            impl StaticDefault for $t {
                #[inline(always)]
                fn default() -> &'static Self {
                    &STATIC_DEFAULT
                }
            }
        };
    };
}

#[wasm_bindgen(typescript_custom_section)]
const TS_ORUNSET: &'static str = r#"
export type OrUnset<T> = T | "unset";"#;

#[derive(Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum OrUnset<T> {
    #[default]
    Unset,
    #[serde(untagged)]
    Set(T),
}
impl<T> OrUnset<T>
where
    T: Clone,
{
    pub fn set_or(&self, value: T) -> T {
        match self {
            OrUnset::Set(v) => v.clone(),
            OrUnset::Unset => value,
        }
    }
}
impl<T> OrUnset<T>
where
    T: StaticDefault + Clone + 'static,
{
    #[inline(always)]
    pub fn or_default(&self) -> &T {
        match self {
            OrUnset::Set(v) => v,
            OrUnset::Unset => StaticDefault::default(),
        }
    }
}