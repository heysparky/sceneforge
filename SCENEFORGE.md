# SceneForge — Project Reference

## What This Is

SceneForge is a Foundry VTT v14 module. GMs create **specialized scenes** — Foundry scenes that render a custom HTML interface instead of a battle map canvas. v1 ships with the SceneForge framework and a Character Roster scene (fully implemented) with a Merchant scene (stubbed to prove the framework).

**Non-negotiable constraints:**
- No external dependencies. Vanilla JS + Foundry APIs only.
- No polling. All updates via Foundry hooks and sockets.
- Lazy loading. Scene type code only loads when that scene type activates.
- One source of truth. All scene state on `scene.flags.sceneforge`. One document write per state change.
- GM is the authority. Players send socket requests; GM client validates and writes.

---

## Folder Structure

```
sceneforge/
├── module.json
├── sceneforge.js                  # Entry point — hooks, bootstrap only
├── core/
│   ├── registry.js                # Scene type registry
│   ├── interceptor.js             # canvasReady hook, hands off to scene types
│   ├── socket.js                  # Socket channel, GM-as-authority pattern
│   ├── permissions.js             # Actor ownership assignment
│   └── gm-controls.js            # GM overlay strip
├── scenes/
│   ├── roster/
│   │   ├── index.js               # Self-registers, dynamic import entry point
│   │   ├── RosterApp.js           # Player-facing Application
│   │   ├── RosterGM.js            # GM config panel
│   │   ├── roster.html
│   │   ├── roster-gm.html
│   │   └── roster.css
│   └── merchant/
│       ├── index.js               # Self-registers, renders placeholder only
│       ├── MerchantApp.js
│       ├── merchant.html
│       └── merchant.css
├── ui/
│   ├── scene-creator.js           # "New SceneForge Scene" dialog
│   ├── scene-creator.html
│   └── shared.css                 # CSS variables shared across scene types
└── lang/
    └── en.json
```

---

## How The Pieces Connect

**Boot** (only what's needed — everything else lazy):
1. `sceneforge.js` fires on `init`
2. Registers socket channel
3. Adds "Create SceneForge Scene" button to Scene controls
4. Registers `canvasReady` hook via `interceptor.js`
5. Statically imports each scene type's tiny `index.js` (registration only — no heavy code yet)

**Scene activation:**
```
GM activates scene
→ canvasReady fires
→ interceptor reads scene.flags.sceneforge.type
→ no type: do nothing, normal Foundry canvas
→ type found: suppress canvas, call registry.loadSceneType(type)
→ dynamic import loads (first time only; cached after)
→ Application renders fullscreen
→ GM controls overlay mounts
```

**Claim flow:**
```
Player clicks portrait → confirmation dialog
→ socket message to GM client {action: "roster.claim", actorId}
→ GM validates (unclaimed? enrollment open?)
→ valid: scene flags updated, permissions.js sets Actor ownership, broadcast success
→ invalid: rejection socket to that player only, toast shown
```

**Teardown:**
```
Scene changes → interceptor calls teardown() on active Application
→ DOM removed, listeners removed, clean slate
```

---

## Registry Pattern

```js
// core/registry.js
const registry = new Map();
export const registerSceneType = (id, loader) => registry.set(id, loader);
export const loadSceneType = (id) => registry.has(id) ? registry.get(id)() : null;

// scenes/roster/index.js — tiny, loaded at boot
import { registerSceneType } from '../../core/registry.js';
registerSceneType('roster', () => import('./RosterApp.js'));
```

**Every scene type Application must implement:**
```js
async render(scene, containerElement) { }
teardown() { }
gmControls() { return []; } // array of { icon, label, onClick }
```

---

## Foundry v14 API Notes

```js
// Module manifest entry point
"esmodules": ["sceneforge.js"]

// Reading/writing scene flags
scene.flags.sceneforge.roster          // read
await scene.setFlag('sceneforge', 'roster', newData)  // write (one atomic update)

// Socket
game.socket.on('module.sceneforge', handler)
game.socket.emit('module.sceneforge', message)

// Actor permissions
await actor.update({ ownership: { [userId]: 3 } })  // 0=None,1=Limited,2=Observer,3=Owner
// Only GM clients can execute this

// Applications
// Config panels: extend FormApplication
// Scene views: extend Application
```

---

## Data Model

```js
// Everything lives here
scene.flags.sceneforge = {
  type: "roster",          // "roster" | "merchant"
  version: "1.0.0",
  roster: {
    config: {
      enrollmentOpen: boolean,
      otherPlayerPermission: number,  // 0/1/2
      showClaimedBy: boolean,
    },
    pool: [
      { actorId: string, description: string, sortOrder: number }
    ],
    claims: {
      [actorId]: userId   // one entry per claimed character
    }
  }
}
```

**Module settings** (game.settings.register):
- `defaultOtherPlayerPermission` — Number, default 1, World scope
- `notifyOnClaim` — Boolean, default true, World scope
- `notifyOnRelease` — Boolean, default true, World scope

**Socket envelope:**
```js
{
  action: "roster.claim" | "roster.claim.success" | "roster.claim.rejected" |
          "roster.release" | "roster.release.success",
  sceneId: string,
  senderId: string,
  payload: { actorId?, userId?, reason? }
}
```

**What does NOT live in flags:** Actor data, user data, Foundry permissions — always read live from `game.actors` and `game.users`.

---

## Common Pitfalls

- Don't statically import scene Application classes at boot — dynamic imports only
- Don't write to multiple documents for one state change — find a way to make it one flag write
- Don't forget `teardown()` — scenes change frequently, memory leaks accumulate
- Don't hardcode colors — CSS custom properties only, reference Foundry variables where possible
- Don't build merchant features — stub only (placeholder UI + clean teardown, nothing else)
- GM users: `permissions.js` never touches users with GM role

---

## Future Scene Types

Possible candidates for post-v1 development. Not stubbed, not architected — just noted.

- **Roster** — v1, fully implemented
- **Merchant** — v1, stubbed; future: reads merchant actor inventory, handles buy/sell with gold transfer, chat feedback for out-of-stock/broke, GM notifications for haggle/steal attempts; system-specific gold/inventory abstraction needed
- **Landing Page** — welcome screen when players connect; could own Foundry's default scene slot
- **Timeline** — campaign history, session recaps, visual chronology
- **Downtime** — structured downtime activity selection and tracking
- **Bastion / Safehouse** — party home base management (D&D 2024 bastions, Blades in the Dark style, etc.)