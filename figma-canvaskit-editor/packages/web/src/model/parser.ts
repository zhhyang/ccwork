import type { SceneDoc } from './schema';

export interface ModelTree {
  doc: SceneDoc;
}

export function parseSceneDoc(data: unknown): ModelTree {
  return { doc: data as SceneDoc };
}
