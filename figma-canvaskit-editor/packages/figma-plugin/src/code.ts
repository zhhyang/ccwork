import type {
  SceneDoc,
  Node as SceneNode,
  Style,
  FillPaint,
  StrokePaint,
  Effect as SceneEffect,
  Geometry,
  RectBounds,
  Matrix2x3,
  WindingRule,
} from './shared/schema';

figma.showUI(__html__, { width: 240, height: 120 });

figma.ui.onmessage = async (msg) => {
  if (msg.type !== 'EXPORT_SELECTION') {
    return;
  }

  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    figma.notify('Select at least one layer to export.');
    return;
  }

  const assets: SceneDoc['assets'] = {
    images: {},
    fonts: [],
  };
  const fontsSet = new Map<string, { family: string; postScriptName: string }>();
  const nodes: Record<string, SceneNode> = {};

  const rootId = 'ROOT';
  const rootBounds = unionBounds(selection.map((node) => getAbsoluteBounds(node)));

  nodes[rootId] = {
    id: rootId,
    name: 'Root',
    type: 'GROUP',
    visible: true,
    opacity: 1,
    relativeTransform: [
      [1, 0, 0],
      [0, 1, 0],
    ],
    size: { width: rootBounds.width, height: rootBounds.height },
    localBounds: { x: 0, y: 0, width: rootBounds.width, height: rootBounds.height },
    absBounds: rootBounds,
    children: selection.map((node) => node.id),
    clipsContent: false,
  };

  for (const node of selection) {
    await exportNode(node, nodes, assets, fontsSet);
  }

  assets.fonts = Array.from(fontsSet.values());

  const scene: SceneDoc = {
    version: 1,
    rootId,
    nodes,
    assets,
  };

  figma.ui.postMessage({ type: 'DOWNLOAD', payload: JSON.stringify(scene, null, 2) });
  figma.notify('Scene exported.');
};

async function exportNode(
  node: SceneNode & SceneNodeMixin,
  nodes: Record<string, SceneNode>,
  assets: SceneDoc['assets'],
  fontsSet: Map<string, { family: string; postScriptName: string }>,
): Promise<void> {
  if (node.type === 'FRAME') {
    nodes[node.id] = {
      ...baseNode(node),
      type: 'FRAME',
      children: node.children.map((child) => child.id),
      clipsContent: node.clipsContent,
      style: buildStyle(node),
    };
  } else if (node.type === 'GROUP') {
    nodes[node.id] = {
      ...baseNode(node),
      type: 'GROUP',
      children: node.children.map((child) => child.id),
      clipsContent: false,
    };
  } else if (node.type === 'RECTANGLE') {
    nodes[node.id] = {
      ...baseNode(node),
      type: 'RECTANGLE',
      cornerRadius: {
        topLeft: node.topLeftRadius,
        topRight: node.topRightRadius,
        bottomRight: node.bottomRightRadius,
        bottomLeft: node.bottomLeftRadius,
      },
      style: buildStyle(node),
    };
  } else if (node.type === 'TEXT') {
    const fontName = node.getRangeFontName(0, 1) as FontName;
    const fontSize = node.getRangeFontSize(0, 1) as number;
    const lineHeight = node.getRangeLineHeight(0, 1) as LineHeight;
    const letterSpacing = node.getRangeLetterSpacing(0, 1) as LetterSpacing;
    const resolvedLineHeight =
      typeof lineHeight === 'symbol' ? fontSize * 1.2 : lineHeight.value;
    const resolvedLetterSpacing =
      typeof letterSpacing === 'symbol' ? 0 : letterSpacing.value;
    fontsSet.set(fontName.postScriptName, {
      family: fontName.family,
      postScriptName: fontName.postScriptName,
    });
    nodes[node.id] = {
      ...baseNode(node),
      type: 'TEXT',
      characters: node.characters,
      font: {
        family: fontName.family,
        postScriptName: fontName.postScriptName,
      },
      fontSize,
      lineHeight: resolvedLineHeight,
      letterSpacing: resolvedLetterSpacing,
      textAlign: node.textAlignHorizontal,
      style: buildStyle(node),
    };
  } else if (node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION') {
    const geometry = await exportGeometry(node);
    nodes[node.id] = {
      ...baseNode(node),
      type: node.type,
      geometry,
      style: buildStyle(node),
    };
  }

  if ('children' in node) {
    for (const child of node.children) {
      await exportNode(child as SceneNode & SceneNodeMixin, nodes, assets, fontsSet);
    }
  }

  await collectImages(node, assets);
}

async function exportGeometry(node: VectorNode | BooleanOperationNode): Promise<Geometry> {
  const svgPaths = node.vectorPaths?.map((path) => ({
    data: path.data,
    windingRule: path.windingRule === 'EVENODD' ? 'EVENODD' : 'NONZERO',
  }));

  if (svgPaths && svgPaths.length > 0 && node.type === 'VECTOR') {
    return {
      svgPaths: {
        paths: svgPaths.map((path) => path.data),
        windingRules: svgPaths.map((path) => path.windingRule),
      },
    };
  }

  const svg = await node.exportAsync({ format: 'SVG' });
  const svgText = new TextDecoder().decode(svg);
  return extractSvgPaths(svgText);
}

function extractSvgPaths(svgText: string): Geometry {
  const paths: string[] = [];
  const windingRules: WindingRule[] = [];
  const pathRegex = /<path[^>]*d="([^"]+)"[^>]*>/g;
  const fillRuleRegex = /fill-rule="(evenodd|nonzero)"/i;
  let match: RegExpExecArray | null;

  while ((match = pathRegex.exec(svgText)) !== null) {
    paths.push(match[1]);
    const fillRuleMatch = fillRuleRegex.exec(match[0]);
    windingRules.push(fillRuleMatch?.[1]?.toLowerCase() === 'evenodd' ? 'EVENODD' : 'NONZERO');
  }

  return {
    svgPaths: {
      paths,
      windingRules,
    },
  };
}

async function collectImages(node: SceneNode & SceneNodeMixin, assets: SceneDoc['assets']) {
  if ('fills' in node) {
    const paints = node.fills as ReadonlyArray<Paint>;
    for (const paint of paints) {
      if (paint.type === 'IMAGE' && paint.imageHash) {
        if (!assets.images[paint.imageHash]) {
          const bytes = await figma.getImageByHash(paint.imageHash)?.getBytesAsync();
          if (bytes) {
            assets.images[paint.imageHash] = figma.base64Encode(bytes);
          }
        }
      }
    }
  }
}

function baseNode(node: SceneNode & SceneNodeMixin) {
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    visible: node.visible,
    opacity: node.opacity ?? 1,
    relativeTransform: node.relativeTransform as Matrix2x3,
    size: { width: node.width, height: node.height },
    localBounds: { x: 0, y: 0, width: node.width, height: node.height },
    absBounds: getAbsoluteBounds(node),
  };
}

function getAbsoluteBounds(node: SceneNode & SceneNodeMixin): RectBounds {
  const bounds = node.absoluteBoundingBox;
  if (bounds) {
    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    };
  }
  return { x: 0, y: 0, width: node.width, height: node.height };
}

function unionBounds(bounds: RectBounds[]): RectBounds {
  const x = Math.min(...bounds.map((b) => b.x));
  const y = Math.min(...bounds.map((b) => b.y));
  const right = Math.max(...bounds.map((b) => b.x + b.width));
  const bottom = Math.max(...bounds.map((b) => b.y + b.height));
  return { x, y, width: right - x, height: bottom - y };
}

function buildStyle(node: SceneNode & SceneNodeMixin): Style {
  const fills = 'fills' in node ? mapPaints(node.fills as ReadonlyArray<Paint>) : [];
  const strokes = 'strokes' in node ? mapStrokes(node.strokes as ReadonlyArray<Paint>, node) : [];
  const effects = 'effects' in node ? mapEffects(node.effects as ReadonlyArray<Effect>) : [];
  return { fills, strokes, effects };
}

function mapPaints(paints: ReadonlyArray<Paint>): FillPaint[] {
  return paints
    .filter((paint) => paint.visible !== false)
    .map((paint) => {
      if (paint.type === 'SOLID') {
        return {
          type: 'SOLID',
          color: { ...paint.color, a: 1 },
          opacity: paint.opacity ?? 1,
        } as FillPaint;
      }
      if (paint.type === 'GRADIENT_LINEAR' || paint.type === 'GRADIENT_RADIAL') {
        return {
          type: paint.type,
          stops: paint.gradientStops.map((stop) => ({
            position: stop.position,
            color: { ...stop.color, a: stop.color.a ?? 1 },
          })),
          transform: paint.gradientTransform as Matrix2x3,
          opacity: paint.opacity ?? 1,
        } as FillPaint;
      }
      if (paint.type === 'IMAGE') {
        return {
          type: 'IMAGE',
          imageId: paint.imageHash ?? '',
          opacity: paint.opacity ?? 1,
        } as FillPaint;
      }
      return {
        type: 'SOLID',
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 1,
      } as FillPaint;
    });
}

function mapStrokes(paints: ReadonlyArray<Paint>, node: SceneNode & SceneNodeMixin): StrokePaint[] {
  return [
    {
      fills: mapPaints(paints),
      width: 'strokeWeight' in node ? node.strokeWeight : 0,
      cap: 'strokeCap' in node ? node.strokeCap : 'BUTT',
      join: 'strokeJoin' in node ? node.strokeJoin : 'MITER',
      dash: 'dashPattern' in node ? node.dashPattern : [],
      opacity: 1,
    },
  ];
}

function mapEffects(effects: ReadonlyArray<Effect>): SceneEffect[] {
  return effects
    .filter((effect) => effect.visible !== false)
    .map((effect) => {
      if (effect.type === 'DROP_SHADOW') {
        return {
          type: 'DROP_SHADOW',
          color: { ...effect.color, a: effect.color.a ?? 1 },
          offsetX: effect.offset.x,
          offsetY: effect.offset.y,
          blur: effect.radius,
          spread: effect.spread ?? 0,
        } as SceneEffect;
      }
      if (effect.type === 'LAYER_BLUR' || effect.type === 'BACKGROUND_BLUR') {
        return {
          type: effect.type,
          radius: effect.radius,
        } as SceneEffect;
      }
      return {
        type: 'LAYER_BLUR',
        radius: 0,
      } as SceneEffect;
    });
}
