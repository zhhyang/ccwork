export type Matrix2x3 = [[number, number, number], [number, number, number]];

export type WindingRule = 'NONZERO' | 'EVENODD';
export type NodeType = 'FRAME' | 'GROUP' | 'RECTANGLE' | 'TEXT' | 'VECTOR' | 'BOOLEAN_OPERATION';

export interface RectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GradientStop {
  position: number;
  color: RGBA;
}

export interface GradientFill {
  type: 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL';
  stops: GradientStop[];
  transform: Matrix2x3;
  opacity: number;
}

export interface SolidFill {
  type: 'SOLID';
  color: RGBA;
  opacity: number;
}

export interface ImageFill {
  type: 'IMAGE';
  imageId: string;
  opacity: number;
}

export type FillPaint = SolidFill | GradientFill | ImageFill;

export interface StrokePaint {
  fills: FillPaint[];
  width: number;
  cap: 'BUTT' | 'ROUND' | 'SQUARE';
  join: 'MITER' | 'ROUND' | 'BEVEL';
  dash: number[];
  opacity: number;
}

export interface DropShadowEffect {
  type: 'DROP_SHADOW';
  color: RGBA;
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
}

export interface BlurEffect {
  type: 'LAYER_BLUR' | 'BACKGROUND_BLUR';
  radius: number;
}

export type Effect = DropShadowEffect | BlurEffect;

export interface Style {
  fills: FillPaint[];
  strokes: StrokePaint[];
  effects: Effect[];
}

export interface Geometry {
  svgPaths: {
    paths: string[];
    windingRules: WindingRule[];
  };
}

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface BaseNode {
  id: string;
  name: string;
  type: NodeType;
  visible: boolean;
  opacity: number;
  relativeTransform: Matrix2x3;
  size: {
    width: number;
    height: number;
  };
  localBounds: RectBounds;
  absBounds: RectBounds;
}

export interface ContainerNode extends BaseNode {
  children: string[];
  clipsContent: boolean;
}

export interface FrameNode extends ContainerNode {
  type: 'FRAME';
  style: Style;
}

export interface GroupNode extends ContainerNode {
  type: 'GROUP';
}

export interface RectangleNode extends BaseNode {
  type: 'RECTANGLE';
  cornerRadius: {
    topLeft: number;
    topRight: number;
    bottomRight: number;
    bottomLeft: number;
  };
  style: Style;
}

export interface TextNode extends BaseNode {
  type: 'TEXT';
  characters: string;
  font: {
    family: string;
    postScriptName: string;
  };
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  textAlign: 'LEFT' | 'RIGHT' | 'CENTER' | 'JUSTIFIED';
  style: Style;
}

export interface VectorNode extends BaseNode {
  type: 'VECTOR' | 'BOOLEAN_OPERATION';
  geometry: Geometry;
  style: Style;
}

export type Node = FrameNode | GroupNode | RectangleNode | TextNode | VectorNode;

export interface SceneAssets {
  images: Record<string, string>;
  fonts: Array<{ family: string; postScriptName: string }>;
}

export interface SceneDoc {
  version: number;
  rootId: string;
  nodes: Record<string, Node>;
  assets: SceneAssets;
}
