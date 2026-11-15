// Module-level bridge between the Konva editor (which owns the design layer) and the
// consumers that need pixels: the 3D preview texture atlas, project thumbnails and CRP export.
export const registry = {
  layer: null,
  size: { W: 1200, H: 600 },
  atlas: null, // { color, mr, emissive } canvases for the 3D preview
};

export function renderDesign(pixelWidth) {
  if (!registry.layer) throw new Error('Design canvas is not ready');
  const { W, H } = registry.size;
  return registry.layer.toCanvas({ x: 0, y: 0, width: W, height: H, pixelRatio: pixelWidth / W });
}
