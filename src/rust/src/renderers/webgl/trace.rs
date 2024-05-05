use web_sys::WebGl2RenderingContext;

use crate::{
    trace_styles::{TraceFillStyle, TraceLineStyle, TracePointsStyle, TraceStyle},
    utils::ResolvedColor,
};

use super::{RenderContext, TraceGeometry};

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

        let style = &self.style;
        let width = style.get_line_width() as f32;
        let color = self.color.as_floats();
        let line = style.get_line();

        let TraceGeometry {
            points,
            x_range,
            line_buffer,
            arc_length_buffer,
            fill_buffer,
            ..
        } = &self.geometry;

        let points = *points as i32;

        gl.uniform2f(
            Some(&programs.trace_origin),
            (job.common.x_range.from - x_range.from) as f32,
            y_from,
        );

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

        match (fill_buffer, style.get_fill()) {
            (Some(buffer), TraceFillStyle::ToZeroY | TraceFillStyle::ToNextInStack) => {
                gl.uniform4f(Some(&programs.dash_gap_length), 1.0, 0.0, 0.0, 0.0);
                gl.uniform4f(
                    Some(&programs.trace_color),
                    color[0],
                    color[1],
                    color[2],
                    0.25 * color[3],
                );

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
                gl.draw_arrays(WebGl2RenderingContext::TRIANGLE_STRIP, 0, 2 * points);
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

        if width < ctx.renderer.line_width_limit + 0.1 {
            gl.line_width(width);
            gl.draw_arrays(WebGl2RenderingContext::LINE_STRIP, 0, points);
        } else {
            gl.line_width(1.0);
            let start_offset = width / 2.0 - 0.5;
            let amount = width.round() as usize;

            for i in 0..amount {
                gl.uniform2f(
                    Some(&programs.trace_csoffset),
                    0.0,
                    2.0 * (start_offset + i as f32) / ctx.renderer.height as f32,
                );
                gl.draw_arrays(WebGl2RenderingContext::LINE_STRIP, 0, points);
            }
        }

        if matches!(style.get_points(), TracePointsStyle::Show) {
            gl.draw_arrays(WebGl2RenderingContext::POINTS, 0, points);
        }
    }
}
