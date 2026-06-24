export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function boxToPixelCenter(box, width, height) {
  const [ymin, xmin, ymax, xmax] = box;

  const cxNorm = (xmin + xmax) / 2;
  const cyNorm = (ymin + ymax) / 2;

  const x = (cxNorm / 1000) * width;
  const y = (cyNorm / 1000) * height;

  return {
    x: Math.round(clamp(x, 0, width - 1)),
    y: Math.round(clamp(y, 0, height - 1)),
  };
}

export function pointToPixel(point, width, height) {
  return {
    x: Math.round(clamp((point.x / 1000) * width, 0, width - 1)),
    y: Math.round(clamp((point.y / 1000) * height, 0, height - 1)),
  };
}
