import type { Matrix2x3 } from '../model/schema';

export function invertMatrix(matrix: Matrix2x3): Matrix2x3 | null {
  const [a, b, c] = matrix[0];
  const [d, e, f] = matrix[1];
  const det = a * e - b * d;
  if (det === 0) {
    return null;
  }
  const invDet = 1 / det;
  return [
    [e * invDet, -b * invDet, (b * f - c * e) * invDet],
    [-d * invDet, a * invDet, (c * d - a * f) * invDet],
  ];
}

export function transformPoint(matrix: Matrix2x3, point: { x: number; y: number }) {
  return {
    x: matrix[0][0] * point.x + matrix[0][1] * point.y + matrix[0][2],
    y: matrix[1][0] * point.x + matrix[1][1] * point.y + matrix[1][2],
  };
}
