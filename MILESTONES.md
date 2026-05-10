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
- [ ] Module loads in Foundry v14, no console errors
- [ ] GM can create a Roster scene and a Merchant scene via the creator dialog
- [ ] Activating either scene suppresses the canvas and shows placeholder text
- [ ] Activating a normal scene shows a normal map
- [ ] Switching between scenes leaves no console errors, no orphaned DOM

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
- [ ] GM can add/remove actors, write descriptions, reorder pool
- [ ] GM can toggle enrollment and set permission level
- [ ] All config persists across page refresh
- [ ] GM preview renders portraits and descriptions correctly
- [ ] GM overlay visible to GM, invisible to players

---

## Milestone 2 — Player Claim Flow

**Scope:** Players can see and claim characters.

- `core/socket.js` — channel registered, GM-as-authority pattern
- `scenes/roster/RosterApp.js` — full player view
  - Portrait grid, names, descriptions, status badges
  - Enrollment closed state with banner
- Claim flow: click → confirm → socket → GM validates → flags update → permissions set → all clients re-render
- Race condition: first write wins, second gets rejection toast

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

- Player release: "Release" button on own card → confirm → socket → permissions reset → all clients update
- GM force-release: from GM controls overlay
- GM reassignment: move claim from one player to another, permissions update
- Edge case cleanup: deleted actor, removed user

**Exit criteria:**
- [ ] Player can release their character with confirmation
- [ ] After release: character unclaimed for all clients, permissions reset
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
