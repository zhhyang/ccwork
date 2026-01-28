import type { CanvasKit, Paint, Shader } from 'canvaskit-wasm';
import type { FillPaint, GradientFill, Matrix2x3, RGBA, StrokePaint } from '../model/schema';
import { RenderCache } from './cache';

const identityMatrix: number[] = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function paintForFill(
  CanvasKit: CanvasKit,
  cache: RenderCache,
  fill: FillPaint,
  keyPrefix: string,
): Paint {
  const key = `${keyPrefix}:fill:${JSON.stringify(fill)}`;
  return cache.getPaint(key, () => {
    const paint = new CanvasKit.Paint();
    paint.setStyle(CanvasKit.PaintStyle.Fill);
    if (fill.type === 'SOLID') {
      paint.setColor(rgbaToColor(CanvasKit, fill.color, fill.opacity));
    } else if (fill.type === 'GRADIENT_LINEAR' || fill.type === 'GRADIENT_RADIAL') {
      const shader = shaderForGradient(CanvasKit, cache, fill, keyPrefix);
      paint.setShader(shader);
    } else {
      paint.setColor(rgbaToColor(CanvasKit, { r: 0, g: 0, b: 0, a: 1 }, fill.opacity));
    }
    return paint;
  });
}

export function paintForStroke(
  CanvasKit: CanvasKit,
  cache: RenderCache,
  stroke: StrokePaint,
  keyPrefix: string,
): Paint {
  const key = `${keyPrefix}:stroke:${JSON.stringify(stroke)}`;
  return cache.getPaint(key, () => {
    const paint = new CanvasKit.Paint();
    paint.setStyle(CanvasKit.PaintStyle.Stroke);
    paint.setStrokeWidth(stroke.width);
    paint.setStrokeCap(CanvasKit.StrokeCap[stroke.cap]);
    paint.setStrokeJoin(CanvasKit.StrokeJoin[stroke.join]);
    if (stroke.dash.length > 0) {
      paint.setPathEffect(CanvasKit.PathEffect.MakeDash(stroke.dash, 0));
    }
    const fill = stroke.fills[0];
    if (fill) {
      if (fill.type === 'SOLID') {
        paint.setColor(rgbaToColor(CanvasKit, fill.color, fill.opacity));
      } else if (fill.type === 'GRADIENT_LINEAR' || fill.type === 'GRADIENT_RADIAL') {
        const shader = shaderForGradient(CanvasKit, cache, fill, keyPrefix);
        paint.setShader(shader);
      }
    }
    return paint;
  });
}

function shaderForGradient(
  CanvasKit: CanvasKit,
  cache: RenderCache,
  gradient: GradientFill,
  keyPrefix: string,
): Shader {
  const key = `${keyPrefix}:shader:${JSON.stringify(gradient)}`;
  return cache.getShader(key, () => {
    const colors = gradient.stops.map((stop) => rgbaToColor(CanvasKit, stop.color, gradient.opacity));
    const positions = gradient.stops.map((stop) => stop.position);
    const matrix = matrix2x3ToSkMatrix(gradient.transform);
    if (gradient.type === 'GRADIENT_RADIAL') {
      return CanvasKit.Shader.MakeRadialGradient(
        [0, 0],
        0.5,
        colors,
        positions,
        CanvasKit.TileMode.Clamp,
        matrix,
      );
    }
    return CanvasKit.Shader.MakeLinearGradient(
      [0, 0],
      [1, 0],
      colors,
      positions,
      CanvasKit.TileMode.Clamp,
      matrix,
    );
  });
}

function rgbaToColor(CanvasKit: CanvasKit, color: RGBA, opacity: number) {
  return CanvasKit.Color(color.r, color.g, color.b, color.a * opacity);
}

function matrix2x3ToSkMatrix(matrix: Matrix2x3): number[] {
  if (!matrix) {
    return identityMatrix;
  }
  return [matrix[0][0], matrix[0][1], matrix[0][2], matrix[1][0], matrix[1][1], matrix[1][2], 0, 0, 1];
}
