#[derive(Clone, Default)]
pub struct AdaptiveGrid {
    pub x: Vec<f64>,
    pub y: Vec<f64>,
    pub overlay: Vec<f64>,
    layers: usize,
}

impl AdaptiveGrid {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            x: Vec::with_capacity(capacity),
            y: Vec::with_capacity(capacity),
            overlay: Vec::with_capacity(capacity),
            layers: 0,
        }
    }

    pub fn point_at(&self, idx: usize) -> (f64, f64) {
        (self.x[idx], self.y[idx])
    }

    pub fn merge_overlay(&mut self) {
        self.layers += 1;

        self.y
            .iter_mut()
            .zip(self.overlay.iter())
            .for_each(|(y, next)| *y = *next);
    }

    pub fn sum_add_points<I: Iterator<Item = (f64, f64)>>(
        &mut self,
        iter: impl IntoIterator<IntoIter = I>,
    ) -> SumAddIterator<'_, I> {
        SumAddIterator::new(self, iter)
    }

    pub fn layers(&self) -> usize {
        self.layers
    }
}

pub struct SumAddIterator<'a, I> {
    grid: &'a mut AdaptiveGrid,
    iter: I,
    state: Option<SumAddIteratorState>,
    stash: Option<(f64, f64)>,
    prev_point: Option<(f64, f64)>,
}

#[derive(Clone, Copy)]
enum SumAddIteratorState {
    Prepend { until: f64, idx: usize },
    Append,
    Combine { grid_idx: usize },
}

impl<'a, I: Iterator<Item = (f64, f64)>> SumAddIterator<'a, I> {
    pub fn new(grid: &'a mut AdaptiveGrid, iter: impl IntoIterator<IntoIter = I>) -> Self {
        Self {
            grid,
            iter: iter.into_iter(),
            state: None,
            stash: None,
            prev_point: None,
        }
    }
}

impl<'a, I> Drop for SumAddIterator<'a, I> {
    fn drop(&mut self) {
        self.grid.merge_overlay()
    }
}

impl<'a, I: Iterator<Item = (f64, f64)>> Iterator for SumAddIterator<'a, I> {
    /// `(x, prev_y, next_y)`
    type Item = (f64, f64, f64);

    fn next(&mut self) -> Option<Self::Item> {
        if self.state.is_none() {
            // initial state

            if self.grid.x.is_empty() {
                // handle empty grid by appending
                self.state = Some(SumAddIteratorState::Append);
            } else {
                // find the starting point

                let (x, y) = self.iter.next()?;
                self.stash = Some((x, y));

                match self.grid.x.binary_search_by(|p| p.total_cmp(&x)) {
                    Err(i) if i == self.grid.x.len() => {
                        self.state = Some(SumAddIteratorState::Append);
                    }
                    Err(0) => {
                        // Assumption B: x is before grid_x, therefore at least one point will be appended
                        self.state = Some(SumAddIteratorState::Prepend {
                            until: self.grid.x[0],
                            idx: 0,
                        });
                    }
                    Ok(i) | Err(i) => {
                        // Assumption A: i == 0 => grid_x == x
                        // Proof: only Ok(0) is possible, but then grid_x == x
                        // Assumption B: grid_x >= x
                        // Proof:
                        // * Ok(i) => grid.x[i] == x
                        // * Err(i) => grid.x[i] > x from binary_search definition
                        self.state = Some(SumAddIteratorState::Combine { grid_idx: i });
                    }
                }
            }
        }

        let (x, y) = self.stash.take().or_else(|| self.iter.next())?;

        loop {
            let state = self.state?;

            match state {
                SumAddIteratorState::Append => {
                    self.grid.x.push(x);
                    self.grid.y.push(y);
                    self.grid.overlay.push(y);

                    self.prev_point = Some((x, y));

                    return Some((x, 0., y));
                }
                SumAddIteratorState::Prepend { until, idx } => {
                    if x < until {
                        self.grid.x.insert(idx, x);
                        self.grid.y.insert(idx, y);
                        self.grid.overlay.insert(idx, y);

                        self.prev_point = Some((x, y));
                        self.state = Some(SumAddIteratorState::Prepend {
                            until,
                            idx: idx + 1,
                        });

                        return Some((x, 0., y));
                    } else {
                        // Assumption A: until = grid[0] => x >= grid_x
                        // Assumption B: initial conditions ensure at least one prepend was successful => prev_point is Some
                        self.state = Some(SumAddIteratorState::Combine { grid_idx: idx });
                    }
                }
                SumAddIteratorState::Combine { grid_idx } => {
                    if grid_idx >= self.grid.x.len() {
                        self.state = Some(SumAddIteratorState::Append);
                    } else {
                        let (grid_x, grid_y) = self.grid.point_at(grid_idx);

                        if x < grid_x {
                            // point is missing in the grid
                            // Assumption A used here: x < grid_x => grid_idx > 0
                            let prev = self.grid.point_at(grid_idx - 1);
                            let next = self.grid.point_at(grid_idx);
                            let grid_y = interpolate(prev, next, x);

                            self.grid.x.insert(grid_idx, x);
                            self.grid.y.insert(grid_idx, grid_y);
                            self.grid.overlay.insert(grid_idx, grid_y + y);

                            self.prev_point = Some((x, y));

                            return Some((x, grid_y, grid_y + y));
                        } else if x == grid_x {
                            self.state = Some(SumAddIteratorState::Combine {
                                grid_idx: grid_idx + 1,
                            });
                            self.prev_point = Some((x, y));

                            self.grid.overlay[grid_idx] = grid_y + y;

                            return Some((grid_x, grid_y, grid_y + y));
                        } else {
                            // point is missing along the curve

                            self.state = Some(SumAddIteratorState::Combine {
                                grid_idx: grid_idx + 1,
                            });
                            self.stash = Some((x, y));

                            // unwrap safe by assumption B
                            let y = interpolate(self.prev_point.unwrap(), (x, y), grid_x);

                            self.grid.overlay[grid_idx] = grid_y + y;

                            return Some((grid_x, grid_y, grid_y + y));
                        }
                    }
                }
            }
        }
    }
}

fn interpolate(prev: (f64, f64), next: (f64, f64), at: f64) -> f64 {
    prev.1 + (next.1 - prev.1) * (at - prev.0) / (next.0 - prev.0)
}

#[cfg(test)]
mod tests {
    use super::AdaptiveGrid;

    #[test]
    fn adds_to_grid() {
        let mut grid = AdaptiveGrid::new();
        grid.sum_add_points([(0.0, 1.0), (1.0, 1.0), (2.0, 1.0)])
            .for_each(|_| {
                // noop
            });

        let mut test = move |add: Vec<(f64, f64)>, expect: Vec<(f64, f64)>| {
            let out = grid
                .sum_add_points(add)
                .map(|(x, _, y)| (x, y))
                .collect::<Vec<_>>();

            assert_eq!(out, expect);
        };

        test(
            vec![(-1., 2.), (0., 1.), (0.5, 0.5)],
            vec![(-1., 2.), (0., 1. + 1.), (0.5, 1. + 0.5)],
        );

        test(
            vec![(0.5, 2.), (2., -1.), (3., 1.)],
            vec![(0.5, 1. + 2. + 0.5), (1., 1. + 1.), (2., 1. - 1.), (3., 1.)],
        );
    }
}
