use std::{
    rc::{Rc, Weak},
    sync::atomic::{AtomicU32, Ordering},
};

use js_sys::wasm_bindgen::prelude::*;

use crate::{
    data::{BundleHandle, TraceHandle},
    trace::BundleRange,
    types::NumericRange,
};

use super::Bundle;

static BUNDLE_COUNTER: AtomicU32 = AtomicU32::new(0);

#[wasm_bindgen]
pub struct BundleRc {
    handle: BundleHandle,
    bundle: Rc<dyn Bundle>,
}

impl BundleRc {
    pub fn new(bundle: impl Bundle + 'static) -> BundleRc {
        BundleRc {
            handle: BUNDLE_COUNTER.fetch_add(1, Ordering::Relaxed),
            bundle: Rc::new(bundle),
        }
    }

    pub fn downgrade(&self) -> BundleWeak {
        BundleWeak {
            handle: self.handle,
            bundle: Rc::downgrade(&self.bundle),
        }
    }
}

impl std::ops::Deref for BundleRc {
    type Target = dyn Bundle;

    fn deref(&self) -> &Self::Target {
        &*self.bundle
    }
}

impl Clone for BundleRc {
    fn clone(&self) -> Self {
        BundleRc {
            handle: self.handle,
            bundle: self.bundle.clone(),
        }
    }
}

impl PartialEq for BundleRc {
    fn eq(&self, other: &Self) -> bool {
        Rc::ptr_eq(&self.bundle, &other.bundle)
    }
}

impl Eq for BundleRc {}

#[wasm_bindgen]
impl BundleRc {
    pub fn handle(&self) -> BundleHandle {
        self.handle
    }

    pub fn traces(&self) -> Box<[TraceHandle]> {
        self.bundle.traces().into_boxed_slice()
    }
    pub fn contains_trace(&self, trace: TraceHandle) -> bool {
        self.bundle.contains_trace(trace)
    }
    pub fn range(&self) -> BundleRange {
        self.bundle.range()
    }
    pub fn range_in_view(&self, view_x_range: NumericRange) -> NumericRange {
        match self.bundle.range() {
            BundleRange::Everywhere => view_x_range,
            BundleRange::Bounded { from, to } => {
                let from = from.max(view_x_range.from);
                let to = to.min(view_x_range.to);
                let to = to.max(from);
                NumericRange { from, to }
            }
        }
    }

    pub fn point_count(&self) -> usize {
        self.bundle.point_count()
    }
    pub fn contains_point(&self, point: f64) -> bool {
        self.bundle.contains_point(point)
    }
    pub fn intersects(&self, from: f64, to: f64) -> bool {
        self.bundle.intersects(from, to)
    }
    /// ### Fills input buffer with trace data from input range (including both endpoints) and handle array, returns number of valid elements
    /// * Buffer format is always \[x, y₁, y₂,… yₙ, x', y'₁, …], i.e. each datapoint takes up n+1 elements of the buffer (given n trace handles on input)
    ///   * Therefore returned number is always a multiple of `trace_handles.length()+1`
    ///   * Only whole data points are recorded. If there isn't space for n+1 more elements left the remaining space will remain unchanged
    ///   * The same applies for the end of the range
    pub fn export_to_buffer(
        &self,
        buffer: &mut [f64],
        trace_handles: &[u32],
        x_range: NumericRange,
    ) -> usize {
        let datapoint_length = trace_handles.len() + 1;
        let space_in_buffer = buffer.len() / datapoint_length;
        let mut iterator = self
            .bundle
            .iter_many_in_range_f64(trace_handles.to_vec(), x_range);

        for i in 0..space_in_buffer {
            if let Some(datapoint) = iterator.next() {
                buffer[i * datapoint_length..(i + 1) * datapoint_length]
                    .copy_from_slice(datapoint.as_slice());
            } else {
                return i * datapoint_length;
            }
        }

        space_in_buffer * datapoint_length
    }
}

pub struct BundleWeak {
    handle: BundleHandle,
    bundle: Weak<dyn Bundle>,
}

impl BundleWeak {
    pub fn handle(&self) -> BundleHandle {
        self.handle
    }

    pub fn upgrade(&self) -> Option<BundleRc> {
        self.bundle.upgrade().map(|b| BundleRc {
            handle: self.handle,
            bundle: b,
        })
    }
}

impl Clone for BundleWeak {
    fn clone(&self) -> Self {
        BundleWeak {
            handle: self.handle,
            bundle: self.bundle.clone(),
        }
    }
}

impl std::hash::Hash for BundleWeak {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        self.bundle.as_ptr().hash(state);
    }
}

impl PartialEq for BundleWeak {
    fn eq(&self, other: &Self) -> bool {
        self.bundle.ptr_eq(&other.bundle)
    }
}

impl Eq for BundleWeak {}

impl PartialEq<BundleRc> for BundleWeak {
    fn eq(&self, other: &BundleRc) -> bool {
        std::ptr::addr_eq(self.bundle.as_ptr(), Rc::as_ptr(&other.bundle))
    }
}
