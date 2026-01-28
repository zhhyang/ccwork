import { initCanvasKit } from './canvaskit/init';
import { parseSceneDoc } from './model/parser';
import { Renderer } from './runtime/renderer';
import { attachInteraction } from './editor/interaction';
import { editorState } from './editor/state';

let renderer: Renderer | null = null;

async function boot() {
  const canvas = document.getElementById('stage') as HTMLCanvasElement | null;
  const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
  if (!canvas || !fileInput) {
    return;
  }

  const { CanvasKit, surface } = await initCanvasKit(canvas);
  renderer = new Renderer(CanvasKit, surface);

  window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'e') {
      editorState.mode = editorState.mode === 'select' ? 'editPath' : 'select';
    }
  });

  fileInput.addEventListener('change', async (event) => {
    const target = event.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;
    const file = target.files[0];
    const doc = await loadSceneDoc(file);
    if (!renderer) return;
    renderer.setScene(doc);
    attachInteraction(CanvasKit, canvas, doc, () => renderer.worldMatrices, renderer.getCache());
  });

  const loop = () => {
    renderer?.render({
      selectedId: editorState.selectedId,
      controlPoints: editorState.mode === 'editPath' ? editorState.controlPoints : [],
    });
    requestAnimationFrame(loop);
  };

  requestAnimationFrame(loop);
}

export async function loadSceneDoc(file: File) {
  const text = await file.text();
  const json = JSON.parse(text);
  return parseSceneDoc(json).doc;
}

boot();
