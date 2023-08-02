use num_traits::Float;

pub type BoxedPointTransformFn<T> = Box<dyn Fn((T, T)) -> (T, T)>;

pub trait PointIteratorExtension<T>: Sized {
    fn with_origin(self, x_orig: T, y_orig: T) -> std::iter::Map<Self, BoxedPointTransformFn<T>>;
}

impl<T, N> PointIteratorExtension<N> for T
where
    T: Sized + Iterator<Item = (N, N)>,
    N: Float + 'static,
{
    fn with_origin(self, x_orig: N, y_orig: N) -> std::iter::Map<Self, BoxedPointTransformFn<N>> {
        self.map(Box::new(move |(x, y)| (x - x_orig, y - y_orig)))
    }
}
