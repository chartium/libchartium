use crate::prelude::*;

use super::Segment;

pub struct TraceDescriptor {
    pub id: String,
    pub x_type: String,

    pub segments: Vec<Box<dyn Segment>>,
}

impl TraceDescriptor {
    pub fn get_x_type(&self) -> &String {
        &self.x_type
    }

    pub fn get_segments_in(
        &self,
        from: RangePrec,
        to: RangePrec,
    ) -> impl Iterator<Item = &Box<dyn Segment>> {
        self.segments
            .iter()
            .filter(move |&x| x.intersects(from, to))
    }

    pub fn get_data_in_range(
        &self,
        from: RangePrec,
        to: RangePrec,
    ) -> impl Iterator<Item = (RangePrec, RangePrec)> + '_ {
        // FIXME: this duplicates values on overlapping segments

        self.get_segments_in(from, to)
            .flat_map(move |seg| seg.iter_in_range(from, to))
    }

    pub fn get_data_at(&self, x: RangePrec) -> Option<RangePrec> {
        let seg = self
            .segments
            .iter()
            .find(|s| s.contains(x))
            .map(|s| s.value_at(x));

        seg.flatten()
    }
    pub fn push_segment(&mut self, seg: Box<dyn Segment>) {
        // If this interval is already loaded, cancel the push
        if self.segments.iter().any(|d| {
            seg.from() >= d.from()
                && seg.to() <= d.to()
                && (seg.to() != d.to() || seg.from() != d.from())
        }) {
            return;
        }

        // Remove contained segments
        self.segments
            .retain(|d| d.from() < seg.from() || d.to() > seg.to());

        // Shrink overlaping border segments
        if let Some(lead) = self
            .segments
            .iter_mut()
            .find(|d| d.from() < seg.from() && d.to() > seg.from())
        {
            lead.shrink(lead.from(), seg.from());
        }

        if let Some(trail) = self
            .segments
            .iter_mut()
            .find(|d| d.from() < seg.to() && d.to() > seg.to())
        {
            trail.shrink(seg.to(), trail.to());
        }

        self.segments.push(seg);
        self.segments
            .sort_by(|a, b| a.from().partial_cmp(&b.from()).unwrap());
    }
}
