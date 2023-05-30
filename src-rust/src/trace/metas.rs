use serde::{Deserialize, Serialize};

use crate::prelude::*;

#[derive(Serialize, Deserialize)]
pub struct TraceMetas {
    pub handle: usize,
    pub val: Option<[RangePrec; 2]>,
    pub val_closest: Option<[RangePrec; 2]>,
    pub avg: RangePrec,
    pub avg_nz: RangePrec,
    pub min: RangePrec,
    pub max: RangePrec,
}
