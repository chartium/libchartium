use crate::{prelude::*, trace::TraceMetas};

pub struct MetaCounter {
    sums: Vec<RangePrec>,
    lens: Vec<usize>,
    nz_lens: Vec<usize>,
    mins: Vec<RangePrec>,
    maxs: Vec<RangePrec>,
}

impl MetaCounter {
    pub fn new(len: usize) -> Self {
        Self {
            sums: vec![0.0; len],
            lens: vec![0; len],
            nz_lens: vec![0; len],
            mins: vec![std::f64::INFINITY; len],
            maxs: vec![std::f64::NEG_INFINITY; len],
        }
    }

    pub fn add(&mut self, col: usize, val: RangePrec) {
        self.sums[col] += val;
        self.lens[col] += 1;
        self.maxs[col] = val.max(self.maxs[col]);
        self.mins[col] = val.min(self.mins[col]);
        if val > 0. {
            self.nz_lens[col] += 1;
        }
    }

    pub fn iter_metas(&self) -> impl Iterator<Item = TraceMetas> + '_ {
        (0..self.sums.len()).map(|i| TraceMetas {
            handle: 0,
            avg: self.sums[i] / self.lens[i] as RangePrec,
            avg_nz: self.sums[i] / self.nz_lens[i] as RangePrec,
            min: self.mins[i],
            max: self.maxs[i],
        })
    }
}
