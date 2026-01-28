import type { CanvasKit } from 'canvaskit-wasm';
import type { Matrix2x3, SceneDoc } from '../model/schema';
import { RenderCache } from '../render/cache';
import { hitTest } from '../runtime/hittest';
import { invertMatrix, transformPoint } from '../runtime/matrix';
import { ControlPoint, getControlPoints, parseSvgPath, serializeSvgPath, updateControlPoint } from './pathCommands';
import { editorState } from './state';

const commandCache = new Map<string, ReturnType<typeof parseSvgPath>>();
let controlPointRefs: ControlPoint[] = [];

export function attachInteraction(
  CanvasKit: CanvasKit,
  canvas: HTMLCanvasElement,
  doc: SceneDoc,
  worldMatrices: () => Map<string, Matrix2x3>,
  cache: RenderCache,
) {
  canvas.addEventListener('pointerdown', (event) => {
    const point = getPoint(canvas, event);
    if (editorState.mode === 'editPath' && editorState.selectedId) {
      const hitControlIndex = findControlPoint(point);
      if (hitControlIndex !== null) {
        editorState.activeControlPointIndex = hitControlIndex;
        editorState.dragging = true;
        editorState.dragStart = point;
        return;
      }
    }

    const selected = hitTest(CanvasKit, doc, worldMatrices(), cache, point);
    editorState.selectedId = selected;
    editorState.dragging = selected !== null;
    editorState.dragStart = point;
    editorState.activeControlPointIndex = null;
    if (editorState.mode === 'editPath') {
      refreshControlPoints(doc, worldMatrices());
    }
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!editorState.dragging || !editorState.selectedId || !editorState.dragStart) {
      return;
    }
    const point = getPoint(canvas, event);
    if (editorState.mode === 'editPath' && editorState.activeControlPointIndex !== null) {
      updatePathControlPoint(doc, worldMatrices(), point);
      editorState.dragStart = point;
      return;
    }

    const dx = point.x - editorState.dragStart.x;
    const dy = point.y - editorState.dragStart.y;
    editorState.dragStart = point;
    applyTranslation(doc, editorState.selectedId, dx, dy);
    if (editorState.mode === 'editPath') {
      refreshControlPoints(doc, worldMatrices);
    }
  });

  canvas.addEventListener('pointerup', () => {
    editorState.dragging = false;
    editorState.dragStart = null;
    editorState.activeControlPointIndex = null;
  });
}

function applyTranslation(doc: SceneDoc, nodeId: string, dx: number, dy: number) {
  const node = doc.nodes[nodeId];
  if (!node) return;
  node.relativeTransform[0][2] += dx;
  node.relativeTransform[1][2] += dy;
  updateAbsBounds(doc, nodeId, dx, dy);
}

function updateAbsBounds(doc: SceneDoc, nodeId: string, dx: number, dy: number) {
  const node = doc.nodes[nodeId];
  if (!node) return;
  node.absBounds = {
    ...node.absBounds,
    x: node.absBounds.x + dx,
    y: node.absBounds.y + dy,
  };
  if ('children' in node) {
    node.children.forEach((childId) => updateAbsBounds(doc, childId, dx, dy));
  }
}

function refreshControlPoints(doc: SceneDoc, matrices: () => Map<string, Matrix2x3>) {
  if (!editorState.selectedId) {
    editorState.controlPoints = [];
    controlPointRefs = [];
    return;
  }
  const node = doc.nodes[editorState.selectedId];
  if (!node || (node.type !== 'VECTOR' && node.type !== 'BOOLEAN_OPERATION')) {
    editorState.controlPoints = [];
    controlPointRefs = [];
    return;
  }
  const world = matrices().get(node.id);
  if (!world) {
    editorState.controlPoints = [];
    controlPointRefs = [];
    return;
  }
  const points: ControlPoint[] = [];
  node.geometry.svgPaths.paths.forEach((path, pathIndex) => {
    const commands = getCommands(node.id, pathIndex, path);
    points.push(...getControlPoints(pathIndex, commands));
  });
  controlPointRefs = points;
  editorState.controlPoints = points.map((point) => {
    const worldPoint = transformPoint(world, { x: point.x, y: point.y });
    return { x: worldPoint.x, y: worldPoint.y, kind: point.kind };
  });
}

function updatePathControlPoint(doc: SceneDoc, matrices: () => Map<string, Matrix2x3>, point: { x: number; y: number }) {
  const index = editorState.activeControlPointIndex;
  if (index === null || !editorState.selectedId) return;
  const node = doc.nodes[editorState.selectedId];
  if (!node || (node.type !== 'VECTOR' && node.type !== 'BOOLEAN_OPERATION')) return;
  const control = controlPointRefs[index];
  const world = matrices().get(node.id);
  if (!control || !world) return;
  const inverse = invertMatrix(world);
  if (!inverse) return;
  const localPoint = transformPoint(inverse, point);
  const path = node.geometry.svgPaths.paths[control.pathIndex];
  const commands = getCommands(node.id, control.pathIndex, path);
  const updated = updateControlPoint(commands, control, localPoint.x, localPoint.y);
  const serialized = serializeSvgPath(updated);
  node.geometry.svgPaths.paths[control.pathIndex] = serialized;
  setCommands(node.id, control.pathIndex, updated);
  refreshControlPoints(doc, matrices);
}

function findControlPoint(point: { x: number; y: number }): number | null {
  if (editorState.controlPoints.length === 0) return null;
  const radius = 6;
  const radiusSq = radius * radius;
  for (let i = 0; i < editorState.controlPoints.length; i += 1) {
    const control = editorState.controlPoints[i];
    const dx = control.x - point.x;
    const dy = control.y - point.y;
    if (dx * dx + dy * dy <= radiusSq) {
      return i;
    }
  }
  return null;
}

function getCommands(nodeId: string, pathIndex: number, d: string) {
  const key = `${nodeId}:${pathIndex}`;
  const cached = commandCache.get(key);
  if (cached) return cached;
  const parsed = parseSvgPath(d);
  commandCache.set(key, parsed);
  return parsed;
}

function setCommands(nodeId: string, pathIndex: number, commands: ReturnType<typeof parseSvgPath>) {
  const key = `${nodeId}:${pathIndex}`;
  commandCache.set(key, commands);
}

function getPoint(canvas: HTMLCanvasElement, event: PointerEvent) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}
