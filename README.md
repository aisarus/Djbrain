# Djbrain

An interactive Three.js experiment for visualizing a future cognitive system as a navigable procedural brain.

The project is deliberately visual rather than architectural: it explores how regions, state and relationships could be communicated through a spatial interface before a real cognitive backend exists.

## What it demonstrates

- a procedural 3D brain-like form built with Three.js;
- distinct interactive regions with raycasting for mouse and touch input;
- camera rotation, zoom and reset controls;
- animated electrical impulses between regions;
- contextual information panels tied to selected regions;
- responsive interaction across desktop, tablet and mobile;
- a Vite build suitable for static deployment.

## Run locally

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

## Scope

Djbrain is an interface prototype, not a claim that a cognitive architecture has been implemented behind the visualization. The current work is about interaction, spatial legibility and visual state. A future backend could replace the procedural regions with real memory, identity, learning and runtime modules without changing that core interface question.
