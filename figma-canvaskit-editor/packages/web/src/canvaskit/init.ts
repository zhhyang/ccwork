import type { CanvasKit } from 'canvaskit-wasm';
import CanvasKitInit from 'canvaskit-wasm';

export interface CanvasKitContext {
  CanvasKit: CanvasKit;
  surface: ReturnType<CanvasKit['MakeCanvasSurface']>;
  canvas: HTMLCanvasElement;
}

export async function initCanvasKit(canvas: HTMLCanvasElement): Promise<CanvasKitContext> {
  const CanvasKit = await CanvasKitInit();

  const surface = CanvasKit.MakeCanvasSurface(canvas);
  if (!surface) {
    throw new Error('Failed to create CanvasKit surface');
  }

  return { CanvasKit, surface, canvas };
}
