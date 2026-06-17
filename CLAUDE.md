# CLAUDE.md

## Project

SceneForge is a Foundry VTT v14 module. See `FOUNDRY_V14_MODULE_GUIDE.md` for verified v14 API patterns, pitfalls, and conventions — read it before writing any module code.

## Non-negotiable constraints

- No external dependencies — vanilla JS + Foundry APIs only. No npm, no build step.
- No polling — all updates via Foundry hooks and sockets.
- One source of truth — all scene state in `scene.flags.sceneforge`. One document write per state change.
- GM is the authority — players send socket requests; GM client validates and writes.
- SceneForge scenes occupy an adjustable inner canvas rectangle. Bounds are stored as percentages in `scene.flags.sceneforge.sceneBounds` (default: 25% inset on all sides). GMs can drag the edge handles to reposition — a toggle button in the top-left corner of the scene reveals them. Writing to the scene flag broadcasts the new bounds to all clients via `updateScene`.

## Development workflow

Edit `.js`, `.html`, and `.css` files directly, then reload the module in Foundry (Module Management → Reload) or F5 for JS changes. No build step.

Testing happens in a running Foundry v14 instance. Zero console errors is a hard requirement.

## File layout

```
sceneforge.js           <- entry point: hook registration only
sceneforge.css          <- all styles
core/
  settings.js           <- game.settings registration (currently empty — sceneBounds moved to scene flag)
  socket.js             <- GM-authority socket handler (claim / release / color sync / user.character sync)
  registry.js           <- scene type registry + dynamic loader
  renderer.js           <- canvasReady → mount/teardown SceneForge apps; resize listener; enforces 460px min height
  handles.js            <- draggable edge handle injection for GMs
lang/
  en.json
scenes/
  SceneForgeScene.js    <- ApplicationV2 base class for all scene types
  picker/
    SceneTypePicker.js  <- "Create Scene" dialog; pre-fills name from type label; two-step roster config (folders → actors); ＋ buttons create Actor folders inline
    picker.html
  roster/
    RosterScene.js      <- full M2 UI: tile grid, claim/release/lock, live sync
    RosterConfig.js     <- pickRosterTemplates(excludeIds, folderId) actor picker dialog
    RosterCharManager.js <- "Edit Characters" ApplicationV2 dialog: reorder, remove, add
    RosterCharEdit.js   <- per-character dossier editor (DialogV2)
    TokenPlacer.js      <- cursor-stack token placement; ghost cursor; prompts GM to activate scene after last token
    charManager.html    <- character manager list template
    roster.html         <- tile grid template
```

## Scene data model

`scene.flags.sceneforge.sceneBounds` (all scene types):
```js
{ top: number, left: number, right: number, bottom: number }  // percentages of viewport
```
Written by GM drag handles; read by `renderer.js _getBounds()` on every `_applyBounds` call.

`scene.flags.sceneforge.roster` (roster scenes):
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
- `sceneforge.dossier`   — GM-configured dossier fields (see below)

Roster tile dossier — configured per-character via "Edit Characters → Dossier":
```js
actor.flags.sceneforge.dossier = {
  showConcept: bool, concept: string,     // character concept / archetype
  showLevel:   bool, level:  string,
  showXp:      bool, xp:     string,      // defaults true; falls back to actor.system.xp
  showBackground: bool, background: string, // falls back to actor.system.biography
  showQuote:   bool, quote:  string,
  custom: string,                          // always shown if non-empty (no toggle)
}
```
`sceneforge.role` and `sceneforge.specialties` remain as legacy display metadata alongside the dossier system.

On claim: GM sets `user.color` to the character's token ring color (Dice So Nice) and `user.character` to the clone actor ID (shows in Player Configuration).
On release/kick: `user.character` is cleared to null.

To add system-specific fields or customize the dossier, edit `#toViewModel` in `scenes/roster/RosterScene.js` and the dossier block in `scenes/roster/roster.html`.

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
