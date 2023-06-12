use serde::{Deserialize, Serialize};

use crate::prelude::*;

#[derive(Serialize, Deserialize)]
pub struct TraceMetas {
    pub handle: usize,
    pub avg: RangePrec,
    pub avg_nz: RangePrec,
    pub min: RangePrec,
    pub max: RangePrec,
}
