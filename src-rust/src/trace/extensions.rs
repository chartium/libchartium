use num_traits::Float;
use wasm_bindgen::JsValue;

pub type BoxedPointTransformFn<T> = Box<dyn Fn((T, T)) -> (T, T)>;

pub trait PointIteratorExtension<T>: Sized {
    fn with_origin_at(self, x_orig: T, y_orig: T) -> std::iter::Map<Self, BoxedPointTransformFn<T>>;
}

impl<T, N> PointIteratorExtension<N> for T
where
    T: Sized + Iterator<Item = (N, N)>,
    N: Float + 'static,
{
    fn with_origin_at(self, x_orig: N, y_orig: N) -> std::iter::Map<Self, BoxedPointTransformFn<N>> {
        self.map(Box::new(move |(x, y)| (x - x_orig, y - y_orig)))
    }
}

pub trait IntoStruct<T> {
    fn try_into_struct_ref(&self) -> Result<&'static T, JsValue>;
    fn try_into_struct_mut_ref(&mut self) -> Result<&'static mut T, JsValue>;
    fn try_into_owned_struct(self) -> Result<T, JsValue>
    where
        T: 'static;
}

impl<T> IntoStruct<T> for JsValue {
    fn try_into_struct_ref(&self) -> Result<&'static T, JsValue> {
        let jsptr = js_sys::Reflect::get(self, &JsValue::from_str("__wbg_ptr"))?;
        let ptr = jsptr
            .as_f64()
            .ok_or_else(|| JsValue::from_str("Not a number"))? as usize;

        if ptr == 0 {
            return Err(JsValue::from_str("Null pointer"));
        }

        let val = unsafe { &*(ptr as *const T) };
        Ok(val)
    }

    fn try_into_struct_mut_ref(&mut self) -> Result<&'static mut T, JsValue> {
        let r: &T = self.try_into_struct_ref()?;
        unsafe { Ok(&mut *(r as *const T as usize as *mut T)) }
    }

    fn try_into_owned_struct(mut self) -> Result<T, JsValue>
    where
        T: 'static,
    {
        let r: &mut T = self.try_into_struct_mut_ref()?;
        unsafe { Ok(*Box::from_raw(r as *mut T)) }
    }
}
