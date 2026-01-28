import type { CanvasKit } from 'canvaskit-wasm';
import type { SceneDoc, Matrix2x3, Node } from '../model/schema';
import { RenderCache } from '../render/cache';
import { applyWindingRule, makePathFromSvg } from '../render/path';
import { invertMatrix, transformPoint } from './matrix';

export function hitTest(
  CanvasKit: CanvasKit,
  doc: SceneDoc,
  worldMatrices: Map<string, Matrix2x3>,
  cache: RenderCache,
  point: { x: number; y: number },
): string | null {
  const root = doc.nodes[doc.rootId];
  if (!root) {
    return null;
  }

  const ordered = flattenNodes(doc, root);
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    const node = ordered[i];
    if (!node.visible) continue;
    if (!containsBounds(node.absBounds, point)) continue;
    if (node.type === 'RECTANGLE' || node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION') {
      const world = worldMatrices.get(node.id);
      if (!world) continue;
      const inverse = invertMatrix(world);
      if (!inverse) continue;
      const localPoint = transformPoint(inverse, point);
      if (node.type === 'RECTANGLE') {
        if (
          localPoint.x >= 0 &&
          localPoint.y >= 0 &&
          localPoint.x <= node.size.width &&
          localPoint.y <= node.size.height
        ) {
          return node.id;
        }
      }
      if (node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION') {
        for (let index = 0; index < node.geometry.svgPaths.paths.length; index += 1) {
          const pathData = node.geometry.svgPaths.paths[index];
          const pathKey = `${node.id}:hit:${index}:${pathData}`;
          const path = cache.getPath(pathKey, () => makePathFromSvg(CanvasKit, pathData));
          applyWindingRule(CanvasKit, path, node.geometry.svgPaths.windingRules[index]);
          if (path.contains(localPoint.x, localPoint.y)) {
            return node.id;
          }
        }
      }
    }
  }
  return null;
}

function flattenNodes(doc: SceneDoc, root: Node): Node[] {
  const result: Node[] = [];
  const stack: Node[] = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    result.push(node);
    if ('children' in node) {
      node.children.forEach((childId) => {
        const child = doc.nodes[childId];
        if (child) stack.push(child);
      });
    }
  }
  return result;
}

function containsBounds(bounds: { x: number; y: number; width: number; height: number }, point: { x: number; y: number }) {
  return (
    point.x >= bounds.x &&
    point.y >= bounds.y &&
    point.x <= bounds.x + bounds.width &&
    point.y <= bounds.y + bounds.height
  );
}
