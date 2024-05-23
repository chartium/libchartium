use libchartium::trace_styles::{
    OrUnset, TraceColor, TraceFillStyle, TraceStylePatch, TraceStyleSheet,
    TraceStyleSheetPatchBuilder,
};

#[test]
fn it_works() {
    let mut builder = TraceStyleSheetPatchBuilder::base(TraceStylePatch {
        color: Some(OrUnset::Set(TraceColor::PaletteAuto("rainbow".to_string()))),
        line_width: Some(OrUnset::Set(4)),
        ..Default::default()
    });

    builder.add(
        1,
        TraceStylePatch {
            line_width: Some(OrUnset::Unset),
            fill: Some(OrUnset::Set(TraceFillStyle::ToZeroY)),
            ..Default::default()
        },
    );

    let base_style = TraceStyleSheet::unset().patch(builder.collect());

    assert!(matches!(
        base_style.get(0).get_color(),
        TraceColor::PaletteAuto(_)
    ));
    assert_eq!(base_style.get(0).get_line_width(), 4);

    assert!(matches!(
        base_style.get(1).get_color(),
        TraceColor::PaletteAuto(_)
    ));
    assert_eq!(base_style.get(1).get_line_width(), 2);
}
