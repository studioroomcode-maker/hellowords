/**
 * Radar Chart SVG geometry helpers
 * Generates hexagonal radar chart points for react-native-svg
 */

export interface Point {
  x: number;
  y: number;
}

/** Generate regular polygon vertices (top-aligned, clockwise) */
export function getHexagonPoints(cx: number, cy: number, r: number, sides: number = 6): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < sides; i++) {
    // Start from top (-90°), go clockwise
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
    points.push({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    });
  }
  return points;
}

/** Get a single data point position on the radar */
export function getStatPoint(
  cx: number,
  cy: number,
  maxRadius: number,
  statIndex: number,
  totalStats: number,
  value: number,
  max: number = 100,
): Point {
  const angle = (Math.PI * 2 * statIndex) / totalStats - Math.PI / 2;
  const r = (value / max) * maxRadius;
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

/** Convert points array to SVG polygon points string */
export function buildPolygonString(points: Point[]): string {
  return points.map(p => `${p.x},${p.y}`).join(' ');
}

/** Build data polygon string from stat values */
export function buildDataPolygon(
  cx: number,
  cy: number,
  maxRadius: number,
  values: number[],
  max: number = 100,
): string {
  const points = values.map((v, i) =>
    getStatPoint(cx, cy, maxRadius, i, values.length, v, max)
  );
  return buildPolygonString(points);
}
