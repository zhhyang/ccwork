import type { CanvasKit } from 'canvaskit-wasm';
import type { SceneDoc, Matrix2x3, Node } from '../model/schema';
import { RenderCache } from '../render/cache';
import { drawScene } from '../render/draw';

export class Renderer {
  private cache: RenderCache;
  private doc: SceneDoc | null = null;
  worldMatrices = new Map<string, Matrix2x3>();

  constructor(private CanvasKit: CanvasKit, private surface: ReturnType<CanvasKit['MakeCanvasSurface']>) {
    this.cache = new RenderCache(CanvasKit);
  }

  setScene(doc: SceneDoc) {
    this.doc = doc;
  }

  render(overlay?: { selectedId?: string | null; controlPoints?: Array<{ x: number; y: number; kind: 'anchor' | 'control' }> }) {
    if (!this.doc) {
      return;
    }
    const canvas = this.surface.getCanvas();
    canvas.clear(this.CanvasKit.TRANSPARENT);
    this.worldMatrices = computeWorldMatrices(this.doc);
    drawScene(this.CanvasKit, canvas, this.doc, this.cache);
    if (overlay?.selectedId) {
      drawSelection(this.CanvasKit, canvas, this.doc, overlay.selectedId);
    }
    if (overlay?.controlPoints && overlay.controlPoints.length > 0) {
      drawControlPoints(this.CanvasKit, canvas, overlay.controlPoints);
    }
    this.surface.flush();
  }

  getCache() {
    return this.cache;
  }
}

export function computeWorldMatrices(doc: SceneDoc): Map<string, Matrix2x3> {
  const matrices = new Map<string, Matrix2x3>();
  const root = doc.nodes[doc.rootId];
  if (!root) {
    return matrices;
  }

  const identity: Matrix2x3 = [
    [1, 0, 0],
    [0, 1, 0],
  ];

  const visit = (node: Node, parentMatrix: Matrix2x3) => {
    const world = multiplyMatrix(parentMatrix, node.relativeTransform);
    matrices.set(node.id, world);
    if ('children' in node) {
      node.children.forEach((childId) => {
        const child = doc.nodes[childId];
        if (child) visit(child, world);
      });
    }
  };

  visit(root, identity);
  return matrices;
}

export function multiplyMatrix(a: Matrix2x3, b: Matrix2x3): Matrix2x3 {
  return [
    [
      a[0][0] * b[0][0] + a[0][1] * b[1][0],
      a[0][0] * b[0][1] + a[0][1] * b[1][1],
      a[0][0] * b[0][2] + a[0][1] * b[1][2] + a[0][2],
    ],
    [
      a[1][0] * b[0][0] + a[1][1] * b[1][0],
      a[1][0] * b[0][1] + a[1][1] * b[1][1],
      a[1][0] * b[0][2] + a[1][1] * b[1][2] + a[1][2],
    ],
  ];
}

function drawSelection(CanvasKit: CanvasKit, canvas: ReturnType<CanvasKit['MakeCanvasSurface']>['getCanvas'], doc: SceneDoc, selectedId: string) {
  const node = doc.nodes[selectedId];
  if (!node) return;
  const paint = new CanvasKit.Paint();
  paint.setStyle(CanvasKit.PaintStyle.Stroke);
  paint.setStrokeWidth(1);
  paint.setColor(CanvasKit.Color(0, 0.6, 1, 1));
  const rect = CanvasKit.XYWHRect(node.absBounds.x, node.absBounds.y, node.absBounds.width, node.absBounds.height);
  canvas.drawRect(rect, paint);

  const handlePaint = new CanvasKit.Paint();
  handlePaint.setStyle(CanvasKit.PaintStyle.Fill);
  handlePaint.setColor(CanvasKit.Color(0, 0.6, 1, 1));
  const size = 6;
  const corners = [
    { x: node.absBounds.x, y: node.absBounds.y },
    { x: node.absBounds.x + node.absBounds.width, y: node.absBounds.y },
    { x: node.absBounds.x, y: node.absBounds.y + node.absBounds.height },
    { x: node.absBounds.x + node.absBounds.width, y: node.absBounds.y + node.absBounds.height },
  ];
  corners.forEach((corner) => {
    const handle = CanvasKit.XYWHRect(corner.x - size / 2, corner.y - size / 2, size, size);
    canvas.drawRect(handle, handlePaint);
  });
}

function drawControlPoints(
  CanvasKit: CanvasKit,
  canvas: ReturnType<CanvasKit['MakeCanvasSurface']>['getCanvas'],
  points: Array<{ x: number; y: number; kind: 'anchor' | 'control' }>,
) {
  const anchorPaint = new CanvasKit.Paint();
  anchorPaint.setStyle(CanvasKit.PaintStyle.Fill);
  anchorPaint.setColor(CanvasKit.Color(0.9, 0.4, 0, 1));
  const controlPaint = new CanvasKit.Paint();
  controlPaint.setStyle(CanvasKit.PaintStyle.Fill);
  controlPaint.setColor(CanvasKit.Color(0.4, 0.8, 0.2, 1));
  const size = 5;
  points.forEach((point) => {
    const paint = point.kind === 'anchor' ? anchorPaint : controlPaint;
    const rect = CanvasKit.XYWHRect(point.x - size / 2, point.y - size / 2, size, size);
    canvas.drawRect(rect, paint);
  });
}
