export const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export const nextAnimationFrame = () =>
  new Promise((res) => requestAnimationFrame(res));
