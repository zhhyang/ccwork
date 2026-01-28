export type EditorMode = 'select' | 'editPath';

export interface EditorState {
  selectedId: string | null;
  mode: EditorMode;
  dragging: boolean;
  dragStart: { x: number; y: number } | null;
  controlPoints: Array<{ x: number; y: number; kind: 'anchor' | 'control' }>;
  activeControlPointIndex: number | null;
}

export const editorState: EditorState = {
  selectedId: null,
  mode: 'select',
  dragging: false,
  dragStart: null,
  controlPoints: [],
  activeControlPointIndex: null,
};
