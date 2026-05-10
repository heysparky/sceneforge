# SceneForge — Roster Scene

## What It Does

GMs curate a list of pre-made PC actors and present them to players for selection. Players browse portraits and descriptions, claim a character, and have their Foundry permissions automatically configured. Characters claimed by others are visible but locked.

The Roster does not create Actors — it references existing world Actors by ID. SceneForge only manages: which actors are in the pool, who claimed what, GM descriptions, and permissions.

---

## GM Workflow

**Config panel — two tabs:**

*Characters tab:*
- Browse/search world actors (PC type filtered by default, toggleable)
- Add to pool, drag to reorder (order = display order for players)
- Remove from pool (only if unclaimed)
- Per-actor description: one sentence, plain text

*Settings tab:*
- Enrollment: Open / Closed toggle
- Other-player permission: None / Limited / Observer (applied to all non-GM, non-owner players on claim)
- Show claimer name vs. just "Taken"

**GM controls overlay** (always visible to GM, never to players):
- Enrollment status badge — clickable to toggle
- "Edit Roster" button
- "Release Character" — lists claimed characters, GM can force-release any

---

## Player Workflow

**Browsing:**
- Portrait grid, 3–4 cards per row
- Each card: portrait (large), name, GM description, status badge ("Yours" / "Taken" / unclaimed)
- Enrollment closed: all cards visible, none clickable, banner shown

**Claiming:**
1. Click unclaimed card → confirmation dialog
2. Socket → GM validates → success or rejection
3. Success: card shows "Yours", all clients update, Actor permissions set
4. Rejection (race condition): toast "just claimed, choose another"

**Releasing:**
1. "Release" button on player's own claimed card (small, not prominent)
2. Confirmation dialog
3. Socket → GM executes → permissions reset, card returns to unclaimed for all clients

---

## Permission Logic

On claim:
```js
actor.ownership[claimingUserId] = 3        // Owner
actor.ownership[everyOtherNonGMUserId] = configuredLevel  // 0/1/2
```

On release:
```js
actor.ownership[previousOwnerId] = configuredLevel  // or 0
// other players unchanged
```

On GM reassignment:
```js
actor.ownership[userA] = configuredLevel
actor.ownership[userB] = 3
```

`permissions.js` never modifies users with GM role.

---

## Edge Cases

| Situation | Behavior |
|---|---|
| Claimed actor deleted from world | Pool entry removed, claim cleared, no error |
| Claiming user removed from world | Orphaned claims detected and cleared on next scene load |
| No GM connected | Claim attempts show "Waiting for GM" — no silent failure |
| Empty pool | GM sees "Add characters to get started", players see "Check back soon" |
| Observer/non-player user | Claim button not rendered |
| Scene deleted | Flags go with it; Actor permissions are NOT auto-reset (documented limitation) |

---

## UI Design Direction

**Player view — atmospheric, not utilitarian:**
- Full canvas area, no PIXI
- Portrait cards feel physical — like postings on a guild board, not SaaS profile cards
- Cards taller than wide, portrait fills most of the card
- Status overlays (Taken/Yours) use both color and text/icon — not color alone
- Claimed state: desaturated portrait + lock icon, not just a color change

**GM config panel — efficient utility:**
- Standard Foundry FormApplication aesthetics are fine here
- Functional over atmospheric

**Shared styling rules:**
- CSS custom properties only — no hardcoded colors
- Reference Foundry's CSS variables (`--color-text-primary`, `--color-bg-option`, etc.) where possible
- SceneForge accent colors defined in `ui/shared.css`
- Web font (if used): loaded only when a SceneForge scene is active, one font only
- Design for 1080p+ with Foundry sidebar open (~1300px canvas width)
- Keyboard navigable: tab to card, enter to claim
- Alt text on all portraits

---

## Out of Scope for v1

- System-specific character info (class, level, etc.) — GM description covers this manually
- Multiple rosters per world
- Roster history / audit log
- Player annotations on characters
