use web_sys::WebGl2RenderingContext;

use crate::{
    trace_styles::{TraceFillStyle, TraceLineStyle, TracePointsStyle, TraceStyle},
    utils::ResolvedColor,
};

use super::{RenderContext, TraceGeometry, MAX_LINE_WIDTH};

pub struct WebGlTrace {
    pub style: TraceStyle,
    pub color: ResolvedColor,
    pub geometry: TraceGeometry,
}

impl WebGlTrace {
    pub fn render(&self, ctx: &RenderContext) {
        let gl = &ctx.renderer.context;
        let programs = &ctx.renderer.programs;
        let job = &ctx.job;

        let y_from = job.common.y_range.from as f32;

        let style: &TraceStyle = &self.style;
        let width = style.get_line_width() as f32;
        let color = self.color.as_floats();
        let line = style.get_line();

        let TraceGeometry {
            x_range,
            line_vertex_count,
            line_buffer,
            arc_length_buffer,
            fill_buffer,
            ..
        } = &self.geometry;

        let points = *line_vertex_count as i32;

        gl.uniform2f(
            Some(&programs.trace_origin),
            (job.common.x_range.from - x_range.from) as f32,
            y_from,
        );

        match (fill_buffer, style.get_fill()) {
            (
                Some((vertex_count, buffer)),
                TraceFillStyle::ToZeroY | TraceFillStyle::ToNextInStack,
            ) => {
                let opacity = style.get_fill_opacity();

                gl.uniform4f(
                    Some(&programs.trace_color),
                    color[0],
                    color[1],
                    color[2],
                    opacity * color[3],
                );

                // Dash buffer hack
                gl.uniform4f(Some(&programs.dash_gap_length), 1.0, 0.0, 0.0, 0.0);
                gl.bind_buffer(WebGl2RenderingContext::ARRAY_BUFFER, Some(buffer));
                gl.vertex_attrib_pointer_with_i32(
                    ctx.length_along_ptr,
                    1,
                    WebGl2RenderingContext::FLOAT,
                    false,
                    0,
                    0,
                );
                gl.enable_vertex_attrib_array(ctx.length_along_ptr);

                // Set the fill buffer
                gl.bind_buffer(WebGl2RenderingContext::ARRAY_BUFFER, Some(buffer));
                gl.vertex_attrib_pointer_with_i32(
                    ctx.vertex_position_ptr,
                    2,
                    WebGl2RenderingContext::FLOAT,
                    false,
                    0,
                    0,
                );
                gl.enable_vertex_attrib_array(ctx.vertex_position_ptr);
                gl.draw_arrays(
                    WebGl2RenderingContext::TRIANGLE_STRIP,
                    0,
                    *vertex_count as i32,
                );
            }
            _ => {
                // noop
            }
        }

        gl.uniform4f(
            Some(&programs.trace_color),
            color[0],
            color[1],
            color[2],
            color[3],
        );

        match line {
            TraceLineStyle::None => {
                gl.uniform4f(Some(&programs.dash_gap_length), 0.0, 1.0, 0.0, 0.0)
            }
            TraceLineStyle::Solid => {
                gl.uniform4f(Some(&programs.dash_gap_length), 1.0, 0.0, 0.0, 0.0)
            }
            TraceLineStyle::Dashed([dash, gap]) => {
                gl.uniform4f(Some(&programs.dash_gap_length), *dash, *gap, *dash, *gap)
            }
            TraceLineStyle::DoubleDashed([first_dash, first_gap, second_dash, second_gap]) => gl
                .uniform4f(
                    Some(&programs.dash_gap_length),
                    *first_dash,
                    *first_gap,
                    *second_dash,
                    *second_gap,
                ),
        }

        // Set the arc length buffer
        gl.bind_buffer(
            WebGl2RenderingContext::ARRAY_BUFFER,
            Some(arc_length_buffer),
        );
        gl.vertex_attrib_pointer_with_i32(
            ctx.length_along_ptr,
            1,
            WebGl2RenderingContext::FLOAT,
            false,
            0,
            0,
        );
        gl.enable_vertex_attrib_array(ctx.length_along_ptr);

        // Set the line buffer
        gl.bind_buffer(WebGl2RenderingContext::ARRAY_BUFFER, Some(line_buffer));
        gl.vertex_attrib_pointer_with_i32(
            ctx.vertex_position_ptr,
            2,
            WebGl2RenderingContext::FLOAT,
            false,
            0,
            0,
        );
        gl.enable_vertex_attrib_array(ctx.vertex_position_ptr);

        // // REMOVE
        // gl.vertex_attrib_pointer_with_i32(0, 2, WebGl2RenderingContext::FLOAT, false, 0, 0);
        // gl.enable_vertex_attrib_array(0);
        // // END REMOVE

        {
            gl.bind_buffer(
                WebGl2RenderingContext::ARRAY_BUFFER,
                Some(&ctx.renderer.brushpoint_buffer),
            );
            gl.enable_vertex_attrib_array(programs.trace_pixel_offset);
            gl.vertex_attrib_divisor(programs.trace_pixel_offset, 1);

            let closest = (width as i32).clamp(1, MAX_LINE_WIDTH);

            let (from, count) = ctx.renderer.brush_indices[closest as usize - 1];

            gl.vertex_attrib_pointer_with_i32(
                programs.trace_pixel_offset,
                2,
                WebGl2RenderingContext::FLOAT,
                false,
                8,        // two f32
                from * 8, // multiples of f32 pairs
            );
            gl.draw_arrays_instanced(WebGl2RenderingContext::LINE_STRIP, 0, points, count);
        }

        if matches!(style.get_points(), TracePointsStyle::Show) {
            gl.draw_arrays(WebGl2RenderingContext::POINTS, 0, points);
        }
    }
}
