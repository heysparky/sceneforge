# CLAUDE.md

## Project

SceneForge is a Foundry VTT v14 module. See `FOUNDRY_V14_MODULE_GUIDE.md` for verified v14 API patterns, pitfalls, and conventions — read it before writing any module code.

## Non-negotiable constraints

- No external dependencies — vanilla JS + Foundry APIs only. No npm, no build step.
- No polling — all updates via Foundry hooks and sockets.
- One source of truth — all scene state in `scene.flags.sceneforge`. One document write per state change.
- GM is the authority — players send socket requests; GM client validates and writes.
- SceneForge scenes occupy an adjustable inner canvas rectangle. Bounds are stored as percentages in `scene.flags.sceneforge.sceneBounds` (no flag = a centered 1140×890px box, `DEFAULT_SIZE` in `core/renderer.js`, shrunk to fit small windows; sized so six roster characters show without scrolling). GMs can drag the edge handles to reposition — a move-icon toggle in the bottom-right corner of the scene reveals them. Writing to the scene flag broadcasts the new bounds to all clients via `updateScene`.

## Development workflow

Edit `.js`, `.html`, and `.css` files directly, then reload the module in Foundry (Module Management → Reload) or F5 for JS changes. No build step.

Testing happens in a running Foundry v14 instance. Zero console errors is a hard requirement.

**Git:** The user makes all commits. Never run `git commit` (or `push`, `tag`, or create releases) — leave changes uncommitted and summarize what changed so the user can commit it.

## File layout

```
sceneforge.js           <- entry point: hook registration only
sceneforge.css          <- all styles
core/
  settings.js           <- world settings: which roster panel sections show (rosterShow*) and the class field path (rosterClassPath)
  socket.js             <- GM-authority socket handler (claim / release / color sync / user.character sync)
  registry.js           <- scene type registry + dynamic loader
  renderer.js           <- canvasReady → mount/teardown SceneForge apps; re-renders on updateActor/updateUser/userConnected (once per frame); resize listener; enforces 460px min height
  handles.js            <- draggable edge handle injection for GMs
lang/
  en.json
scenes/
  SceneForgeScene.js    <- ApplicationV2 base class for all scene types
  picker/
    SceneTypePicker.js  <- "Create Scene" dialog (only available types shown); pre-fills name from type label; two-step roster config (folders → actors); folder-plus buttons create Actor folders inline
    picker.html
  roster/
    RosterScene.js      <- roster UI: portrait grid + focused-character panel, party bar, claim/release/assign/lock, Begin Session (scene thumbnail picker)
    RosterConfig.js     <- pickRosterTemplates(excludeIds, folderId) actor picker dialog
    RosterCharManager.js <- "Edit Roster" ApplicationV2: drag (or arrow) reorder, remove/add characters, folders, theme; DOM rows are the working order, synced to state before re-render
    sheetSummary.js     <- sheetSummary(actor): what the panel shows, read live from the actor (biography, XP; Roll for Shoes skills/inventory/statuses)
    TokenPlacer.js      <- cursor-stack token placement; ghost cursor; prompts GM to activate scene after last token
    charManager.html    <- Edit Roster template (folder selects side-by-side + character list)
    roster.html         <- tile grid template
```

## Scene data model

`scene.flags.sceneforge.sceneBounds` (all scene types):
```js
{ top: number, left: number, right: number, bottom: number }  // percentages of viewport
```
Written by GM drag handles; read by `renderer.js _getBounds()` on every `_applyBounds` call.

`scene.flags.sceneforge.theme` (roster scenes): preset key, one of `default | ledger | file | night` (set in Edit Roster). Rendered as `data-sf-theme` on `.sf-roster`; each preset is a block of `--sf-*` token overrides in `sceneforge.css`.

`scene.flags.sceneforge.roster` (roster scenes):
```js
{
  templates:    string[],   // actor IDs on the roster
  sourceFolder: string|null, // Actor folder ID templates were drawn from (must differ from destFolder)
  destFolder:   string|null, // Actor folder ID where player clones are placed on claim (must differ from sourceFolder)
  dossiers:     { … },        // obsolete: older scenes may still carry it; nothing reads it
  claims:       { [actorId]: { claimedBy: string|null, cloneId: string|null } }, // per-scene claim state
  locks:        { [actorId]: boolean },     // per-scene GM lock; locked characters can't be claimed in this roster
}
```

Character details in the roster panel come only from the actor (`sheetSummary.js`), so the roster always matches the character sheet. Which sections show (class, XP, biography, skills, inventory, statuses) is a world setting. Class has no core Foundry meaning: it's auto-detected (class items, then `system.class`, `system.details.class`, `system.concept`, `system.archetype`…) unless the GM sets an explicit actor path. There is no per-scene dossier anymore; edit the sheet instead.

Per-template flags (on the Actor document itself):
- `sceneforge.locked`    — obsolete (locks were global); nothing reads it. Locks now live in `roster.locks`.

Per-clone flags (on the cloned Actor document):
- `sceneforge.isClone = true` — set at creation; filters clones out of the template picker

Claim state is **per-scene**, stored in `scene.flags.sceneforge.roster.claims`:
```js
{ [templateActorId]: { claimedBy: userId | null, cloneId: actorId | null } }
```
The same template actor can be claimed independently in different roster scenes.

On claim: GM sets `user.color` to the character's token ring color (Dice So Nice) and `user.character` to the clone actor ID (shows in Player Configuration).
On release/kick/clone deletion: `user.character` is cleared to null. Deleting a clone actor from the sidebar triggers `deleteActor` hook → searches all scenes' `roster.claims` for the cloneId → `applyRelease` on the GM client.

Folder guard: `sourceFolder` and `destFolder` must be different (enforced at scene creation and in Edit Scene save). If the same folder is selected, an error toast fires and the operation is aborted.

To show more system-specific fields, extend `sheetSummary()` in `scenes/roster/sheetSummary.js` and the panel block in `scenes/roster/roster.html`.

## Before release

- Change `manifest` in `module.json` from the raw GitHub URL to the release URL (only when ready to share broadly — the release URL 404s until a release exists):
  `https://github.com/heysparky/sceneforge/releases/latest/download/module.json`
- Create a GitHub Release tagged exactly with the `version` (e.g. `0.1.0`, no `v` prefix), with `module.json` and `module.zip` attached
- After the release is published, confirm the README's install URL works and remove the TODO comment above it in `README.md`
- For each later release: bump `version` and the version in the `download` URL together

## Socket envelope

```js
{ action: 'namespace.verb', sceneId, senderId: game.user.id, payload: {} }
```

Current implemented actions: `claim`, `release` (no namespace prefix — kept flat for simplicity).

**Critical:** `module.json` must declare `"socket": true` or the Foundry server silently drops all emissions. Requires a full server restart (not just F5) to take effect after changing module.json.

## Strings

All user-facing text lives in `lang/en.json` (scene type labels are i18n keys too). For text interpolated into DialogV2 HTML, escape with `Handlebars.escapeExpression`.
