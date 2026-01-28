# Figma CanvasKit Editor

This repo contains a Figma plugin and a web CanvasKit runtime that work together to export and render editable vector data.

## Packages

- `packages/figma-plugin`: Export selected layers to `scene.json`.
- `packages/web`: Load `scene.json` and render using CanvasKit.

## Usage

1. Build the Figma plugin.
2. Run the web app and place `canvaskit.js` + `canvaskit.wasm` in `packages/web/public/canvaskit/`.
3. Load `scene.json` in the web UI.

Press `E` to toggle path edit mode and drag control points.
