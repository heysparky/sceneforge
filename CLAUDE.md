# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SceneForge is a Foundry VTT v14 module. GMs create **specialized scenes** that render a custom HTML interface instead of a battle map canvas. v1 ships a Character Roster scene (fully implemented) and a Merchant scene (stubbed to prove the framework).

**Non-negotiable constraints:**
- No external dependencies — vanilla JS + Foundry APIs only. No npm, no build step.
- No polling — all updates via Foundry hooks and sockets.
- Lazy loading — scene type Application classes load only on first activation (dynamic import).
- One source of truth — all scene state in `scene.flags.sceneforge`. One document write per state change.
- GM is the authority — players send socket requests; GM client validates and writes.

## Development Workflow

No build process. Edit `.js`, `.html`, and `.css` files directly, then reload the module in Foundry (Module Management → Reload) or do a full F5 to pick up JS changes.

**Testing** happens in a running Foundry v14 instance. Exit criteria for each milestone are defined in `MILESTONES.md`. Two simultaneous browser sessions are required to test multiplayer flows (claim race conditions, socket communication).

**Console discipline:** zero console errors is a hard requirement for each milestone exit. Check the browser console after every flow.

## Architecture

See `SCENEFORGE.md` for the full technical reference. Key flow summary:

**Boot** (lightweight — no heavy code loaded):
1. `sceneforge.js` fires on Foundry `init`
2. Registers socket channel, scene controls button, `canvasReady` hook
3. Statically imports each scene type's tiny `index.js` (registers the type, no Application code)

**Scene activation:**
- `canvasReady` → interceptor reads `scene.flags.sceneforge.type`
- If a type is found: suppress canvas → `registry.loadSceneType(type)` (dynamic import, cached after first call) → Application renders fullscreen → GM controls overlay mounts
- If no type: normal Foundry canvas

**Claim flow** (Roster):
- Player clicks → socket `roster.claim` → GM validates → flag write + `permissions.js` sets Actor ownership → broadcast success to all clients
- Race condition: first write wins; second caller receives `roster.claim.rejected`

**Teardown:** scene change → interceptor calls `teardown()` on active Application → DOM removed, listeners removed.

## Registry Pattern

Every scene type follows this pattern:

```js
// scenes/roster/index.js — loaded at boot, tiny
import { registerSceneType } from '../../core/registry.js';
registerSceneType('roster', () => import('./RosterApp.js'));
```

Every scene type Application must implement:
```js
async render(scene, containerElement) { }
teardown() { }
gmControls() { return []; } // array of { icon, label, onClick }
```

## Key Foundry v14 APIs

```js
// Module entry point in module.json
"esmodules": ["sceneforge.js"]

// Flags
scene.flags.sceneforge.roster          // read
await scene.setFlag('sceneforge', 'roster', newData)  // write

// Socket
game.socket.on('module.sceneforge', handler)
game.socket.emit('module.sceneforge', message)

// Actor ownership (GM clients only)
await actor.update({ ownership: { [userId]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER } })
// Levels: 0=None, 1=Limited, 2=Observer, 3=Owner

// Config panels extend FormApplication; scene views extend Application
```

## Data Model

```js
scene.flags.sceneforge = {
  type: "roster",       // "roster" | "merchant"
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
      [actorId]: userId
    }
  }
}
```

Actor data, user data, and Foundry permissions are **never** stored in flags — always read live from `game.actors` / `game.users`.

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

**Module settings** (registered via `game.settings.register`, World scope):
- `defaultOtherPlayerPermission` — Number, default 1
- `notifyOnClaim` — Boolean, default true
- `notifyOnRelease` — Boolean, default true

## Common Pitfalls

- **Never statically import Application classes** at boot — dynamic imports only (breaks lazy loading)
- **Never write multiple documents for one state change** — batch into a single flag write
- **Always implement `teardown()`** — scenes change frequently; leaks accumulate fast
- **Never hardcode colors** — CSS custom properties only; use Foundry variables (`--color-text-primary`, etc.) where possible; SceneForge accent colors live in `ui/shared.css`
- **Merchant is a stub only** — placeholder UI + clean teardown, nothing else; do not build merchant features
- **`permissions.js` never touches GM-role users**

## Styling Rules

- CSS custom properties only — no hardcoded colors
- Design target: 1080p+ with Foundry sidebar open (~1300px canvas width)
- Player view is atmospheric (guild board aesthetic, portrait-dominant cards); GM config is standard Foundry FormApplication aesthetics
- Status overlays use both color and text/icon — never color alone
- Keyboard navigable: tab to card, enter to claim; alt text on all portraits
- If a web font is used: load only when a SceneForge scene is active, one font maximum

## Current Development Status

Greenfield — documentation only, no code yet. Follow milestones in `MILESTONES.md` (Milestone 0 = Skeleton through Milestone 5 = Release Candidate). A feature is done when its exit criteria pass in a running Foundry v14 instance, not when the code looks right.
