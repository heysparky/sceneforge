# SceneForge — Milestones

A feature is done when its exit criteria pass in a running Foundry v14 instance — not when the code looks right.

---

## Milestone 0 — Skeleton

**Scope:** Module loads. Framework hands off to scene types. Both scene types render placeholders. Clean teardown.

- `module.json`, `sceneforge.js` entry point
- `core/registry.js` — scene type map
- `core/interceptor.js` — `canvasReady` hook, canvas suppression, handoff
- `ui/scene-creator.js` — GM creates a new SceneForge scene, picks type
- `scenes/roster/index.js` — registers type, renders placeholder div
- `scenes/merchant/index.js` — registers type, renders placeholder div
- Merchant stub: placeholder UI only. No inventory, no config, no interaction.

**Exit criteria:**
- [x] Module loads in Foundry v14, no console errors
- [x] GM can create a Roster scene and a Merchant scene via the creator dialog
- [x] Activating either scene suppresses the canvas and shows placeholder text
- [x] Activating a normal scene shows a normal map 
- [ ] Switching between scenes leaves no console errors, no orphaned DOM (PARTIAL FAIL: you cannot View a sceneforge scene, things get weird)

---

## Milestone 1 — Roster GM Tools

**Scope:** GMs can build and configure a roster. No player interaction yet.

- `core/permissions.js` — `setActorPermissions()` implemented (not yet called)
- `core/gm-controls.js` — GM overlay strip renders for GM users
- `scenes/roster/RosterGM.js` + templates
  - Actor pool: browse world actors, add, remove (if unclaimed), drag to reorder
  - Per-actor description field
  - Config: enrollment toggle, other-player permission selector
- GM preview: see the roster as players will

**Exit criteria:**
- [x] GM can add/remove actors, write descriptions, reorder pool
- [x] GM can toggle enrollment and set permission level
- [x] All config persists across page refresh
- [x] GM preview renders portraits and descriptions correctly
- [x] GM overlay visible to GM, invisible to players

---

## Milestone 2 — Player Claim Flow

**Scope:** Players can see and claim characters.

- `core/socket.js` — channel registered, GM-as-authority pattern
- `scenes/roster/RosterApp.js` — full player view
  - Portrait grid, names, descriptions, status badges
  - Enrollment closed state with banner
- Claim flow: click → confirm → socket → GM validates → flags update → permissions set → all clients re-render
- Race condition: first write wins, second gets rejection toast

**Implemented (not yet fully exit-tested):**
- Claim button per card (explicit button, not card-click)
- Duplicate-actor model: claimed character creates a player-owned copy
- Race condition guard: per-user server-side check + client-side optimistic disable
- Stale claim cleanup: on scene load, on deleteUser, on deleteActor hooks
- `updateScene` triggers re-render; enrollment toggle broadcasts via settings hook

**Exit criteria:**
- [ ] Players see the roster when the scene is active
- [ ] Players cannot see GM controls
- [ ] Player can claim an unclaimed character
- [ ] Claimed character immediately locks for all connected clients
- [ ] Second player claiming same character gets a clear rejection
- [ ] After claim: player has Owner permission, others have configured level
- [ ] Enrollment closed: roster visible, no claiming possible
- [ ] Tested with two simultaneous browser sessions

---

## Milestone 3 — Release and Reassignment

**Scope:** Characters can return to the roster.

- Player release: "Release" button on own card → socket → duplicate actor deleted → claim cleared → all clients update
- GM force-release: Release button visible to GM on any claimed card
- GM reassignment: move claim from one player to another, permissions update
- Edge case cleanup: deleted actor, removed user

**Known blocker — Foundry flag mutation (2026-05-15):**
Foundry's `diffObject` only iterates new-object keys, so `delete claims[actorId]` produces an empty diff and the write is silently skipped. Adding `_v: Date.now()` forces a non-empty diff (updateScene now fires) but `mergeObject` still preserves the deleted key in the local document — the claim survives the merge.

**Fix required:** Replace `delete claims[actorId]` with `claims[actorId] = null` throughout `socket.js` and `cleanup.js`. Update `#renderContent` to treat null claims as unclaimed. This converts a key deletion (invisible to Foundry's diff) into a key update (detectable and applied correctly by mergeObject).

**Exit criteria:**
- [ ] Player can release their character
- [ ] After release: character unclaimed for all clients, duplicate actor deleted
- [ ] GM can force-release any claimed character
- [ ] GM can reassign a claim to a different player
- [ ] Deleting a claimed actor produces no errors or stuck state
- [ ] All flows tested with multiple connected clients

---

## Milestone 4 — Polish and Hardening

**Scope:** Ready for real tables.

- Visual polish pass (see ROSTER.md design direction)
- GM notifications on claim and release
- "Waiting for GM" state when no GM is connected
- Module settings page (default permission, notification prefs)
- `lang/en.json` complete — all user-facing strings
- Zero console errors on all tested flows
- Verified on Foundry v14 stable (note exact version)

**Exit criteria:**
- [ ] No console errors on any tested flow
- [ ] GM notified on player claim and release
- [ ] "Waiting for GM" displays when no GM connected
- [ ] A stranger can set up and use a roster without reading docs
- [ ] Tested on Foundry v14 stable

---

## Milestone 5 — Release Candidate

- `README.md` for non-developers
- `module.json` complete for package submission
- Known limitations documented
- No TODO comments in shipped code
- Package submitted or ready to submit
