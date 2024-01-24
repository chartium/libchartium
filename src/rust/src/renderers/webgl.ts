export function render_between(
  source: OffscreenCanvas,
  target: OffscreenCanvas,
) {
  const ctxt = target.getContext("2d");

  if (!ctxt) return;

  ctxt.clearRect(0, 0, target.width, target.height);
  ctxt.drawImage(source, 0, target.height - source.height);
}
