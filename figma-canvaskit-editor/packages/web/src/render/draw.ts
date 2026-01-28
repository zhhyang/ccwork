import type { CanvasKit, SkCanvas } from 'canvaskit-wasm';
import type { Node, SceneDoc, VectorNode, RectangleNode, TextNode, Matrix2x3 } from '../model/schema';
import { RenderCache } from './cache';
import { applyWindingRule, makePathFromSvg } from './path';
import { paintForFill, paintForStroke } from './paint';

export function drawScene(CanvasKit: CanvasKit, canvas: SkCanvas, doc: SceneDoc, cache: RenderCache) {
  const root = doc.nodes[doc.rootId];
  if (!root) {
    return;
  }
  drawNode(CanvasKit, canvas, doc, root, cache);
}

function drawNode(
  CanvasKit: CanvasKit,
  canvas: SkCanvas,
  doc: SceneDoc,
  node: Node,
  cache: RenderCache,
) {
  if (!node.visible || node.opacity === 0) {
    return;
  }

  canvas.save();
  canvas.concat(matrix2x3ToSkMatrix(node.relativeTransform));

  if ('clipsContent' in node && node.clipsContent) {
    canvas.save();
    canvas.clipRect(CanvasKit.XYWHRect(0, 0, node.size.width, node.size.height), true);
  }

  switch (node.type) {
    case 'FRAME':
      drawStyle(CanvasKit, canvas, node, cache, node.id);
      node.children.forEach((childId) => {
        const child = doc.nodes[childId];
        if (child) drawNode(CanvasKit, canvas, doc, child, cache);
      });
      break;
    case 'GROUP':
      node.children.forEach((childId) => {
        const child = doc.nodes[childId];
        if (child) drawNode(CanvasKit, canvas, doc, child, cache);
      });
      break;
    case 'RECTANGLE':
      drawRectangle(CanvasKit, canvas, node, cache);
      break;
    case 'VECTOR':
    case 'BOOLEAN_OPERATION':
      drawVector(CanvasKit, canvas, node, cache);
      break;
    case 'TEXT':
      drawText(CanvasKit, canvas, node, cache);
      break;
    default:
      break;
  }

  if ('clipsContent' in node && node.clipsContent) {
    canvas.restore();
  }
  canvas.restore();
}

function drawRectangle(CanvasKit: CanvasKit, canvas: SkCanvas, node: RectangleNode, cache: RenderCache) {
  const { topLeft, topRight, bottomRight, bottomLeft } = node.cornerRadius;
  const rrect = CanvasKit.RRectXY(
    CanvasKit.XYWHRect(0, 0, node.size.width, node.size.height),
    topLeft,
    topRight,
    bottomRight,
    bottomLeft,
  );
  drawStyle(CanvasKit, canvas, node, cache, node.id, rrect);
}

function drawVector(CanvasKit: CanvasKit, canvas: SkCanvas, node: VectorNode, cache: RenderCache) {
  node.geometry.svgPaths.paths.forEach((pathData, index) => {
    const key = `${node.id}:path:${index}:${pathData}`;
    const path = cache.getPath(key, () => makePathFromSvg(CanvasKit, pathData));
    const rule = node.geometry.svgPaths.windingRules[index];
    if (rule) {
      applyWindingRule(CanvasKit, path, rule);
    }
    node.style.fills.forEach((fill, fillIndex) => {
      const paint = paintForFill(CanvasKit, cache, fill, `${node.id}:fill:${fillIndex}`);
      canvas.drawPath(path, paint);
    });
    node.style.strokes.forEach((stroke, strokeIndex) => {
      const paint = paintForStroke(CanvasKit, cache, stroke, `${node.id}:stroke:${strokeIndex}`);
      canvas.drawPath(path, paint);
    });
  });
}

function drawText(CanvasKit: CanvasKit, canvas: SkCanvas, node: TextNode, cache: RenderCache) {
  const key = `${node.id}:paragraph:${node.characters}`;
  const paragraph = cache.getParagraph(key, () => {
    const fill = node.style.fills[0];
    const color =
      fill && fill.type === 'SOLID'
        ? CanvasKit.Color(fill.color.r, fill.color.g, fill.color.b, fill.color.a * fill.opacity)
        : CanvasKit.Color(0, 0, 0, 1);
    const textStyle = new CanvasKit.TextStyle({
      color,
      fontFamilies: [node.font.family],
      fontSize: node.fontSize,
      heightMultiplier: node.lineHeight / node.fontSize,
      letterSpacing: node.letterSpacing,
    });
    const paragraphStyle = new CanvasKit.ParagraphStyle({
      textAlign: CanvasKit.TextAlign[node.textAlign],
      maxLines: 0,
    });
    const builder = CanvasKit.ParagraphBuilder.Make(paragraphStyle, CanvasKit.FontMgr.FromData([]));
    builder.pushStyle(textStyle);
    builder.addText(node.characters);
    const paragraph = builder.build();
    paragraph.layout(node.size.width);
    return paragraph;
  });

  canvas.drawParagraph(paragraph, 0, 0);
}

function drawStyle(
  CanvasKit: CanvasKit,
  canvas: SkCanvas,
  node: { style: { fills: any[]; strokes: any[] } },
  cache: RenderCache,
  key: string,
  shape?: ReturnType<typeof CanvasKit.XYWHRect> | ReturnType<typeof CanvasKit.RRectXY>,
) {
  const rect = shape ?? CanvasKit.XYWHRect(0, 0, node['size']?.width ?? 0, node['size']?.height ?? 0);
  node.style.fills.forEach((fill, index) => {
    const paint = paintForFill(CanvasKit, cache, fill, `${key}:fill:${index}`);
    canvas.drawRect(rect, paint);
  });
  node.style.strokes.forEach((stroke, index) => {
    const paint = paintForStroke(CanvasKit, cache, stroke, `${key}:stroke:${index}`);
    canvas.drawRect(rect, paint);
  });
}

function matrix2x3ToSkMatrix(matrix: Matrix2x3): number[] {
  return [matrix[0][0], matrix[0][1], matrix[0][2], matrix[1][0], matrix[1][1], matrix[1][2], 0, 0, 1];
}
