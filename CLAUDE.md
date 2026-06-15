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
sceneforge.js           <- entry point: hook registration only
sceneforge.css          <- all styles
core/
  settings.js           <- game.settings registration
  socket.js             <- GM-authority socket handler (claim / release implemented)
  registry.js           <- scene type registry + dynamic loader
  renderer.js           <- canvasReady → mount/teardown SceneForge apps
  handles.js            <- draggable edge handle injection for GMs
lang/
  en.json
scenes/
  SceneForgeScene.js    <- ApplicationV2 base class for all scene types
  picker/
    SceneTypePicker.js  <- "Create Scene" dialog; two-step roster config (folders → actors)
    picker.html
  roster/
    RosterScene.js      <- full M2 UI: tile grid, claim/release/lock, live sync
    RosterConfig.js     <- pickRosterTemplates(excludeIds, folderId) actor picker dialog
    roster.html         <- tile grid template
```

## Roster scene data model

`scene.flags.sceneforge.roster`:
```js
{
  templates:    string[],   // actor IDs on the roster
  sourceFolder: string|null, // Actor folder ID templates were drawn from
  destFolder:   string|null, // Actor folder ID where player clones are placed on claim
}
```

Per-template flags (on the Actor document itself):
- `sceneforge.claimedBy` — userId of the claiming player (null = unclaimed)
- `sceneforge.cloneId`   — id of the player's cloned actor
- `sceneforge.locked`    — GM-only lock (boolean)
- `sceneforge.role`, `sceneforge.specialties` — display metadata

## Before release

- Change `manifest` in `module.json` from the raw GitHub URL back to the release URL:
  `https://github.com/heysparky/sceneforge/releases/latest/download/module.json`
- Create a GitHub Release with `module.json` and a zipped build attached

## Socket envelope

```js
{ action: 'namespace.verb', sceneId, senderId: game.user.id, payload: {} }
```

Current implemented actions: `claim`, `release` (no namespace prefix — kept flat for simplicity).

**Critical:** `module.json` must declare `"socket": true` or the Foundry server silently drops all emissions. Requires a full server restart (not just F5) to take effect after changing module.json.
