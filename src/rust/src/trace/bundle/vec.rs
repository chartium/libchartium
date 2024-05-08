use js_sys::wasm_bindgen::prelude::*;

use super::{BundleRc, BundleWeak};

#[wasm_bindgen]
pub struct BundleVec(Vec<BundleWeak>);

#[wasm_bindgen]
impl BundleVec {
    #[wasm_bindgen(constructor)]
    pub fn new_empty() -> BundleVec {
        BundleVec(Vec::new())
    }

    pub fn push(&mut self, bundle: &BundleRc) {
        self.push_weak(bundle.downgrade());
    }

    pub fn len(&self) -> usize {
        self.0.len()
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

impl BundleVec {
    pub fn iter(&self) -> impl Iterator<Item = BundleRc> + '_ {
        self.0.iter().map(|d| d.upgrade().unwrap())
    }

    pub fn push_weak(&mut self, bundle: BundleWeak) {
        self.0.push(bundle);
    }
}
