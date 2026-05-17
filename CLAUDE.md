# CLAUDE.md

## Project

SceneForge is a Foundry VTT v14 module. See `FOUNDRY_V14_MODULE_GUIDE.md` for verified v14 API patterns, pitfalls, and conventions — read it before writing any module code.

## Non-negotiable constraints

- No external dependencies — vanilla JS + Foundry APIs only. No npm, no build step.
- No polling — all updates via Foundry hooks and sockets.
- One source of truth — all scene state in `scene.flags.sceneforge`. One document write per state change.
- GM is the authority — players send socket requests; GM client validates and writes.
- SceneForge scenes occupy an adjustable inner canvas rectangle. Bounds are stored as percentages in the `sceneforge.sceneBounds` client setting (default: 25% inset on all sides). GMs can drag the edge handles to reposition — a toggle button in the top-left corner of the scene reveals them.

## Development workflow

Edit `.js`, `.html`, and `.css` files directly, then reload the module in Foundry (Module Management → Reload) or F5 for JS changes. No build step.

Testing happens in a running Foundry v14 instance. Zero console errors is a hard requirement.

## File layout

```
sceneforge.js       <- entry point: hook registration only
core/
  settings.js       <- game.settings registration
  socket.js         <- GM-authority socket handler
lang/
  en.json
```

## Before release

- Change `manifest` in `module.json` from the raw GitHub URL back to the release URL:
  `https://github.com/heysparky/sceneforge/releases/latest/download/module.json`
- Create a GitHub Release with `module.json` and a zipped build attached

## Socket envelope

```js
{ action: 'namespace.verb', sceneId, senderId: game.user.id, payload: {} }
```
