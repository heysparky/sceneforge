# Foundry VTT v14 Module Development Reference

This document captures verified best practices for Foundry VTT v14 (tested against v14.361).
Intended as a foundation document for any new module — feed it to Claude Code at the start of a session.

---

## Starting Points

- **League of Foundry Developers module template**: https://github.com/League-of-Foundry-Developers/FoundryVTT-Module-Template
  The community-endorsed scaffold. Provides `module.json`, CI/CD release automation, and conventional file layout.
- **Official module development article**: https://foundryvtt.com/article/module-development
- **Official API docs**: https://foundryvtt.com/api/ (version-specific; make sure you're reading v14)

---

## module.json Essentials

```json
{
  "id": "your-module-id",
  "title": "Human Readable Title",
  "description": "What it does.",
  "version": "1.0.0",
  "compatibility": {
    "minimum": "14",
    "verified": "14.361"
  },
  "authors": [{ "name": "Your Name" }],
  "esmodules": ["your-module.js"],
  "styles": ["your-module.css"],
  "languages": [{ "lang": "en", "name": "English", "path": "lang/en.json" }],
  "url": "https://github.com/you/your-module",
  "manifest": "https://github.com/you/your-module/releases/latest/download/module.json",
  "download": "https://github.com/you/your-module/releases/download/{{version}}/module.zip"
}
```

- `id` must be lowercase and hyphenated — this is your namespace everywhere
- Do NOT use `/latest` in `manifest` URL when submitting to the official package directory; use a versioned release URL
- `esmodules` is the v14 way to declare JS entry points (not `scripts`)

---

## Conventional File Layout

```
your-module/
  module.json
  your-module.js        <- entry point (imports and hook registration only)
  lang/
    en.json
  core/
    settings.js         <- game.settings registration
    socket.js           <- socket channel and GM-authority handler
    hooks.js            <- hook registrations (optional, if large)
  ui/
    MyApp.js            <- ApplicationV2 subclasses
    my-app.html         <- Handlebars templates
    my-app.css
  templates/            <- alternative location for .html templates
```

Separate concerns into files: hooks, socket, settings, UI. A monolithic entry point becomes unmaintainable fast.

---

## v14 API — What to Use

### Application UI

ALL custom UIs must use `ApplicationV2`:

```js
const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

class MyPanel extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'my-panel',
    window: { title: 'My Panel' },
    position: { width: 500, height: 400 },
  };

  static PARTS = {
    main: { template: 'modules/your-module/ui/my-panel.html' },
  };

  async _prepareContext(_options) {
    return { /* data passed to template */ };
  }

  _onRender(_context, _options) {
    // use this.element (HTMLElement), NOT the html argument
    this.element.querySelector('.my-btn').addEventListener('click', () => { });
  }
}
```

### Dialogs

```js
const result = await DialogV2.wait({
  window: { title: 'Confirm' },
  content: '<p>Are you sure?</p>',
  buttons: [
    { action: 'ok', label: 'OK', default: true, callback: (_e, _b, dialog) => dialog.element.querySelector('input')?.value },
    { action: 'cancel', label: 'Cancel' },
  ],
  rejectClose: false,  // resolves null on Escape instead of throwing
});
```

### Templates

```js
const html = await foundry.applications.handlebars.renderTemplate(
  'modules/your-module/templates/my-template.html',
  data
);
```

### Flags

```js
// Read (synchronous, no await)
const value = scene.flags?.yourmodule?.someKey;
// or
const value = scene.getFlag('yourmodule', 'someKey');

// Write
await scene.setFlag('yourmodule', 'someKey', newValue);
```

### Module Settings

```js
// Registration (in 'init' hook)
game.settings.register('yourmodule', 'settingKey', {
  name: 'Setting Name',
  scope: 'world',    // 'world' syncs to all clients; 'client' is local only
  config: true,      // appears in module settings UI
  type: Boolean,
  default: true,
  onChange: value => Hooks.callAll('yourmodule:settingsChanged', value),
});

// Read / write
game.settings.get('yourmodule', 'settingKey');
await game.settings.set('yourmodule', 'settingKey', newValue);
```

World-scope settings sync to all clients automatically on write.

### Actor Ownership / Permissions

```js
// GM clients only — players must request via socket
await actor.update({
  ownership: { [userId]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER }
});
// NONE=0  LIMITED=1  OBSERVER=2  OWNER=3
```

Never modify GM-role users' ownership entries.

### Useful Utilities

```js
foundry.utils.deepClone(obj)            // deep-clone plain objects
game.actors / game.users / game.scenes  // live world collections
game.user.isGM                          // boolean
game.i18n.localize('KEY')               // i18n lookup
```

---

## v14 API — What Is Deprecated (Never Use)

| Deprecated | Use instead |
|---|---|
| `Application` / `FormApplication` | `ApplicationV2` + `HandlebarsApplicationMixin` |
| `Dialog` | `foundry.applications.api.DialogV2` |
| `renderTemplate(path, data)` (global) | `foundry.applications.handlebars.renderTemplate` |
| `getData()` override | `_prepareContext(_options)` |
| `activateListeners(html)` override | `_onRender(_context, _options)` — use `this.element` |
| `scripts` in module.json | `esmodules` |

---

## Hooks — Lifecycle and Conventions

```js
// Module init — safe for: settings registration, hook registration
Hooks.once('init', () => { });

// World ready — safe for: socket init, reading game.actors/users/scenes, anything needing world data
Hooks.once('ready', () => { });

// Scene activated and canvas rendered
Hooks.on('canvasReady', () => { });
// ⚠️ v14 verified: canvasReady fires BEFORE ready on hard reload.
// If you register a canvasReady handler inside ready, it will miss the
// initial fire. Always guard with an immediate check:
//
//   export function init() {
//     Hooks.on('canvasReady', handler);
//     if (canvas?.ready) handler();  // already fired — call now
//   }

// Scene directory rendered — html is HTMLElement in v14 (not jQuery)
Hooks.on('renderSceneDirectory', (_app, html) => {
  const el = html.querySelector ? html : html[0];  // guard for compat
});

// Document updated — fires on all clients when a document write produces a non-empty diff
Hooks.on('updateScene', (scene, diff, options, userId) => { });
Hooks.on('updateActor', (actor, diff, options, userId) => { });

// Custom hooks — broadcast your own events for extensibility
Hooks.callAll('yourmodule:somethingHappened', payload);
Hooks.on('yourmodule:somethingHappened', handler);
```

---

## Socket Pattern (GM as Authority)

Register in `ready`, not `init` — `game.socket` is not available at `init`.

```js
const CHANNEL = 'module.yourmodule';

// In ready hook:
game.socket.on(CHANNEL, msg => {
  if (game.user.isGM) handleGM(msg).catch(console.error);
  else handlePlayer(msg);
});

function emit(msg) {
  game.socket.emit(CHANNEL, msg);
}
```

Standard envelope:
```js
{ action: 'namespace.verb', sceneId, senderId: game.user.id, payload: { } }
```

**Critical:** GMs do not receive their own socket emits. If a GM initiates an action (button click in their own UI), call the handler function directly — never emit to yourself and wait for it back.

Players emit -> GM receives and validates -> GM writes document -> `updateScene`/`updateActor` fires on all clients -> all clients re-render.

---

## Flag Writes — The Most Important Pitfall

**Never delete a key from a nested flags object:**

```js
// WRONG — produces empty diff, write is silently skipped, updateScene never fires
delete roster.claims[actorId];
await scene.setFlag('yourmodule', 'roster', roster);
```

Foundry's `diffObject` only iterates the *new* object's keys. A deleted key is invisible to it -> empty diff -> Foundry skips the write entirely.

**Use null-sentinel instead:**

```js
// CORRECT — mergeObject applies null values, updateScene fires
const claims = { ...roster.claims };
claims[actorId] = null;
await scene.setFlag('yourmodule', 'roster', { ...roster, claims });
// Treat null as "absent" everywhere you read claims
```

Or use Foundry's deletion marker (actually removes the key):

```js
await scene.update({ [`flags.yourmodule.roster.claims.-=${actorId}`]: null });
```

**Always spread before mutating** — never mutate the live flag object directly.

**Belt-and-suspenders for borderline diffs:** add `_v: Date.now()` to any flag write where the mutation might otherwise be a no-op (e.g. value was already null). Guarantees a non-empty diff.

---

## updateScene and Re-rendering

`updateScene` fires on all clients when a flag write produces a non-empty diff. Wire re-renders to it:

```js
Hooks.on('updateScene', (scene, diff) => {
  if (scene.id !== myActiveSceneId) return;
  if (!diff?.flags?.yourmodule) return;
  myApp.rerender();
});
```

The GM client may not receive `updateScene` for its own write (Foundry sometimes doesn't broadcast back to the sender). Two safe patterns:

```js
// Pattern A: re-render locally after the await
await scene.setFlag(...);
myApp.rerender();  // GM only; others get it via updateScene

// Pattern B: custom hook
await scene.setFlag(...);
Hooks.callAll('yourmodule:dataChanged', scene.id);
// listen to this hook in your app instead of (or in addition to) updateScene
```

---

## Canvas Suppression (Full-Screen Custom UI)

For modules that replace the canvas entirely with custom HTML on certain scenes:

```js
// canvasReady fires when a scene is activated and the canvas is rendered
Hooks.on('canvasReady', () => {
  const shouldSuppress = /* check scene flag */;
  if (!shouldSuppress) return;

  // Measure chrome BEFORE hiding — elementFromPoint needs a live #board
  measureChrome();

  // Hide canvas and HUD with inline style (removeProperty restores correctly)
  document.getElementById('board')?.style.setProperty('display', 'none');
  document.getElementById('hud')?.style.setProperty('display', 'none');

  // Append your container to body, position it in the chrome gap
  const container = document.createElement('div');
  container.id = 'yourmodule-container';
  document.body.appendChild(container);
});

// Teardown — call when scene changes
function teardown() {
  document.getElementById('board')?.style.removeProperty('display');
  document.getElementById('hud')?.style.removeProperty('display');
  document.getElementById('yourmodule-container')?.remove();
}
```

**Bounds tracking** (keeping your container inside Foundry's chrome):

SceneForge scenes occupy the inner canvas rectangle — the area not covered by any Foundry chrome. Measure all four edges before hiding `#board`:

| Edge   | Element           | Measurement                                  |
|--------|-------------------|----------------------------------------------|
| top    | `#navigation`     | `getBoundingClientRect().bottom`             |
| left   | `#scene-controls` | `getBoundingClientRect().right`              |
| right  | `#sidebar`        | `window.innerWidth - getBoundingClientRect().left` |
| bottom | `#hotbar`         | `window.innerHeight - getBoundingClientRect().top` |

- Measure once at activation (chrome is live when `canvasReady` fires)
- For dynamic updates: `ResizeObserver` on `#sidebar` and `#hotbar`, listen to `collapseSidebar` hook and `window resize`
- Teardown: `observer.disconnect()`, `Hooks.off('collapseSidebar', fn)`, `window.removeEventListener('resize', fn)`

---

## Data Model Discipline

- **One source of truth** in flags. Never duplicate data derivable from `game.actors` / `game.users`.
- **One document write per state change** — batch all mutations into a single `setFlag` or `update` call.
- **Never store** actor data, user data, or Foundry permissions in flags — always read live from collections.
- **Never statically import** ApplicationV2 subclasses at boot if they're only needed sometimes — use dynamic imports, cached after first load.

Lazy loading pattern:

```js
// index.js — loaded at boot, tiny
import { registry } from '../../core/registry.js';
registry.set('mytype', () => import('./MyApp.js'));

// registry.js
const registry = new Map();
export { registry };
export const load = (id) => registry.get(id)?.();
```

---

## Teardown Contract

Any component that attaches to the DOM, registers hooks, or adds event listeners must implement a `teardown()` method that undoes all of it. `canvasReady` fires every time a scene is activated — leaked listeners and DOM nodes compound fast.

Checklist:
- Remove appended DOM nodes
- `Hooks.off('hookName', fn)` for every `Hooks.on`
- `observer.disconnect()` for every `ResizeObserver` / `MutationObserver`
- `window.removeEventListener` for every `window.addEventListener`
- Null out references so GC can collect

---

## Styling Conventions

- CSS custom properties only — no hardcoded colors
- Use Foundry's own variables where available: `--color-text-primary`, `--color-border`, `--font-primary`, etc.
- Design target: 1080p+ with Foundry sidebar open (~1300px effective canvas width)
- Status indicators: always use both color AND text/icon — never color alone (accessibility)
- If you load a web font: only load it when your UI is active, one font maximum

---

## Common Pitfalls Summary

| Pitfall | Fix |
|---|---|
| `delete obj[key]` before `setFlag` | Use null-sentinel or `-=` deletion marker |
| Static import of ApplicationV2 subclass at boot | Dynamic import, cached |
| Socket handler registered in `init` | Move to `ready` |
| GM emits to socket and waits for response | Call handler directly |
| Multiple `setFlag` calls for one state change | Batch into one write |
| Hardcoded colors in CSS | CSS custom properties |
| `renderSceneDirectory` html treated as jQuery | Guard: `html.querySelector ? html : html[0]` |
| `updateScene` not firing | Check diff is non-empty; use null-sentinel or `_v` bump |
| GM client missing its own `updateScene` | Re-render locally after `await setFlag` |
| `canvasReady` handler registered in `ready` misses hard-reload | `canvasReady` fires before `ready` in v14 — also call handler immediately if `canvas?.ready` |
| Suppressing `#board` before `canvasReady` | Prevents PIXI from initialising; `canvasReady` never fires. Suppress only inside your `canvasReady` handler. |
