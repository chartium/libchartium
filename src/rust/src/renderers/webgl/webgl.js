/**
 * @param {OffscreenCanvas} source
 * @param {OffscreenCanvas} target
 */
export function render_between(source, target) {
  const ctxt = target.getContext("2d");

  if (!ctxt) return;

  ctxt.clearRect(0, 0, target.width, target.height);
  ctxt.drawImage(source, 0, target.height - source.height);
}
