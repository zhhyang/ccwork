import type { CanvasKit, Paint, Path, Shader, Paragraph } from 'canvaskit-wasm';

export class RenderCache {
  private pathCache = new Map<string, Path>();
  private paintCache = new Map<string, Paint>();
  private shaderCache = new Map<string, Shader>();
  private paragraphCache = new Map<string, Paragraph>();

  constructor(private CanvasKit: CanvasKit) {}

  getPath(key: string, build: () => Path): Path {
    const cached = this.pathCache.get(key);
    if (cached) return cached;
    const path = build();
    this.pathCache.set(key, path);
    return path;
  }

  getPaint(key: string, build: () => Paint): Paint {
    const cached = this.paintCache.get(key);
    if (cached) return cached;
    const paint = build();
    this.paintCache.set(key, paint);
    return paint;
  }

  getShader(key: string, build: () => Shader): Shader {
    const cached = this.shaderCache.get(key);
    if (cached) return cached;
    const shader = build();
    this.shaderCache.set(key, shader);
    return shader;
  }

  getParagraph(key: string, build: () => Paragraph): Paragraph {
    const cached = this.paragraphCache.get(key);
    if (cached) return cached;
    const paragraph = build();
    this.paragraphCache.set(key, paragraph);
    return paragraph;
  }
}
