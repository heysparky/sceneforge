# CLAUDE.md

## Project

SceneForge is a Foundry VTT v14 module. See `FOUNDRY_V14_MODULE_GUIDE.md` for verified v14 API patterns, pitfalls, and conventions — read it before writing any module code.

## Non-negotiable constraints

- No external dependencies — vanilla JS + Foundry APIs only. No npm, no build step.
- No polling — all updates via Foundry hooks and sockets.
- One source of truth — all scene state in `scene.flags.sceneforge`. One document write per state change.
- GM is the authority — players send socket requests; GM client validates and writes.

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

## Socket envelope

```js
{ action: 'namespace.verb', sceneId, senderId: game.user.id, payload: {} }
```
