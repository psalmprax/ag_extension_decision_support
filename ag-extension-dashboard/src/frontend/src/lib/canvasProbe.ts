/**
 * Pointer math for canvas probing tools (soil heatmaps, canopy scrubbers).
 * Clamp a pointer position to canvas bounds and normalize to 0–1.
 * Shared by mouse and touch probing so taps behave exactly like hovers.
 */
export function normalizeProbePoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number }
): { x: number; y: number; xNorm: number; yNorm: number } {
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const safeWidth = rect.width > 0 ? rect.width : 1;
  const safeHeight = rect.height > 0 ? rect.height : 1;
  return {
    x,
    y,
    xNorm: Math.max(0, Math.min(1, x / safeWidth)),
    yNorm: Math.max(0, Math.min(1, y / safeHeight)),
  };
}
