import type { CanvasKit } from 'canvaskit-wasm';

export interface CanvasKitContext {
  CanvasKit: CanvasKit;
  surface: ReturnType<CanvasKit['MakeCanvasSurface']>;
  canvas: HTMLCanvasElement;
}

export async function initCanvasKit(canvas: HTMLCanvasElement): Promise<CanvasKitContext> {
  const CanvasKitInit = (await import('/canvaskit/canvaskit.js')).default as (
    settings: { locateFile: (file: string) => string },
  ) => Promise<CanvasKit>;

  const CanvasKit = await CanvasKitInit({
    locateFile: (file) => `/canvaskit/${file}`,
  });

  const surface = CanvasKit.MakeCanvasSurface(canvas);
  if (!surface) {
    throw new Error('Failed to create CanvasKit surface');
  }

  return { CanvasKit, surface, canvas };
}
