import type { CanvasKit, Path } from 'canvaskit-wasm';
import type { WindingRule } from '../model/schema';

export function makePathFromSvg(CanvasKit: CanvasKit, svg: string): Path {
  if ('MakePathFromSVGString' in CanvasKit) {
    return CanvasKit.MakePathFromSVGString(svg) as Path;
  }
  return CanvasKit.Path.MakeFromSVGString(svg);
}

export function applyWindingRule(CanvasKit: CanvasKit, path: Path, rule: WindingRule) {
  const fillType = rule === 'EVENODD' ? CanvasKit.FillType.EvenOdd : CanvasKit.FillType.Winding;
  path.setFillType(fillType);
}
