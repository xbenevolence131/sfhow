# ORBITAL session handoff

Updated October 18, 2026 after the contextual-controls revision.

## Resume here

Latest approved change: consistent left-click selection/clearing and right-click contextual orders. `src/orders.js` is the shared mapping for input and cursor hints; `build.mjs` now includes it. Ships attack/escort/defend/move by target; boosters attach/reload/move; drones retain bounded defense. Equipped rocks right-click planets for numerically verified moving-target shots or empty space for manual aim. `planRockTarget` searches five arrival windows up to 90 seconds, respects impulse limits, and validates actual preview impacts. Unverified automatic aims cannot be confirmed; manual revision clears that restriction. Legacy drag aiming remains. All orders still use preview/confirmation. Clicking empty space clears selection; dragging pans without clearing. All 37 simulation tests, browser gameplay, the 39-control audit, and `node tests/orders-browser.mjs` passed. Build and notes updated; changes remain uncommitted after `52b59cc`. The existing shared game was not reset for this revision.

Newest change, after the modes checkpoint `52b59cc`: the player approved ships circling targeted enemy units while firing continuously on cooldown. Implemented shared approach/circle steering for both factions, tighter circles near planets, and Stop after target destruction. Preview uses the same movement rules; selected-object and plan text explain the behavior. All 33 simulation tests, full browser gameplay checks, and `node tests/pursuit-browser.mjs` passed. Changes are in the working tree and rebuilt standalone game. No strategic AI upgrade was included.

The October 17 session was archived in local Git on `main`: gameplay checkpoint `1bc0f20`, notes checkpoint `262476d`. No remote is wanted. The user returned October 18 and approved implementing New game modes and a clearer top strip. That revision is now in the working tree and standalone build. This handoff is the current summary; older entries in PLAYTEST_NOTES.md include superseded mechanics.

Latest delivered revision: New game offers Scenarios, Skirmish, and Sandbox. Open games support two/three planets and 160/240/400 starting metal. Sandbox can include enemies and unlimited player metal; no win/loss screens, but damage and fleet limits remain. Skirmish uses the existing opponent and normal costs. The top strip holds navigation/mode, objective/threats, and resources/time. Keep exploring continues a won run as a sandbox. The chooser preserves current orders if canceled; restart keeps setup choices. Simulation tests (28), gameplay browser checks, mode/browser checks, and the 39-control audit passed. The recorder now includes mode/setup and the New game dialog in snapshots; the headed recording regression passed, including new setup dropdowns during capture.

**Next authorized task: improve the opponent AI.** The user approved reactive colony defense, booster escorts, hunting exposed player boosters, and choosing when to commit fleets. Existing AI was inspected, but no AI changes have been implemented or tested. Do not claim the upgrade is done. Existing scheduled enemy production, booster expeditions, escorts, and colony raids still work.

Suggested implementation: periodic simulation-time tactical decisions, persistent orders, reserve a home guard, escort active booster expeditions, intercept exposed opposing boosters, recall ships for imminent colony threats, and make restrained purchases through the existing resource/cap rules. Announce offensive commitments clearly. Preserve the forgiving tutorial and spaced Hold the Orbit encounter. Test defense, escort/hunt behavior, costs, stable orders, and scenario winnability.

## Current playable rules

- Three scenarios: Rock Garden training, Hold the Orbit (survive four minutes), Neighbors (destroy rival colony).
- Booster ships physically rendezvous with moving rocks, attach over six seconds, and stay attached. The approach preview ends at attachment.
- Confirming a launch applies the selected velocity change over a four-second burn, then automatically detaches the booster. It waits for player orders. Return home is manual; rearming takes eight seconds and is free. A launch consumes one charge and costs 35 metal (training is free). Pre-launch manual detachment retains the charge.
- Launched rocks can damage any planet, including yours. Both sides intercept friendly rocks forecast to hit their own colony; safe outbound rocks are left alone. Ship weapons still avoid friendly fire.
- Wider system: planet orbit radii 170/390/690, smaller planet bodies, belt around 820-856. Stronger planetary gravity makes flybys visibly curve. Sun strength unchanged; launch impulse cap 26.
- Continuous softened inverse-square gravity from star and planets, fixed 0.05-second semi-implicit Euler. Planets and platforms use prescribed orbits. Rocks feel gravity before launch, initialized with approximately circular sideways velocity. No programmed orbital decay. Ships have steering and planet avoidance; the user likes that avoidance.
- Preview and flight share motion rules, including burns and moving planets. Future combat and AI decisions are excluded from previews.

## Verification already completed

Last gameplay revision passed all 24 simulation tests, browser gameplay checks, and the 28-control audit. A representative planetary flyby bends about 40 degrees; halving the timestep changed its endpoint by less than one world unit. Initial booster rendezvous plus attachment takes about 32 seconds. These are prior validation results, not newly run tests for this documentation checkpoint.

## Open notes and collaboration preferences

- Add a conspicuous red recording indicator beside the recorder button: requested as a note only, not implemented.
- Rocks are central to the fun. Fleets should contest booster missions, escort, intercept, and defend, not just rush colonies.
- Explain unexpected gameplay before changing it; obtain approval unless the user explicitly requests implementation. Keep spoken explanations concise and give concrete progress updates while working.
- The user wants to play while development continues. Do not reset, reload, or close their live game without authorization. A source rebuild does not update an already-open tab; refreshing starts a fresh run.
- Avoid claims of continuous observation. The shared helper records locally; the assistant inspects screenshots/state/event logs on demand.
- UI buttons and dropdowns must remain mounted. Replacing interactive markup during refresh caused hover blinking and missed clicks. Native Windows Chrome dropdowns were also disrupted by Playwright screenshot preparation: use direct CDP Page.captureScreenshot as the helper now does.

## Files and local commands

- Simulation, AI, physics, combat: `src/simulation.js`; scenarios: `src/scenarios.js`; drawing: `src/render.js`; controls: `src/input.js`; UI/game loop: `src/main.js`.
- UI structure: `index.html`, `style.css`. Build output: `dist/index.html`, standalone and offline-capable.
- `build.mjs` concatenates modules into one scope; avoid duplicate top-level declarations between modules.
- PowerShell: use `npm.cmd run build`, `npm.cmd test`, `npm.cmd run test:browser`, `npm.cmd run test:controls`.
- Shared game: `npm.cmd run playtest`. Inspect: `npm.cmd run playtest:inspect`. Recorder regression: `node tests/playtest.mjs --headed`.
- Chrome is installed at `C:/Program Files/Google/Chrome/Application/chrome.exe`. Helper normally listens on localhost:9333. Launch hidden helper processes with Start-Process -WindowStyle Hidden.
- Git has no remote. Initial commit used per-command author Codex <codex@localhost>; do not change global identity.

## Preserved playtest evidence

An end-of-session live snapshot, screenshot, metadata, and recent interaction history were copied outside the rolling buffer to:

`.orbital-playtest/archives/session-end-2026-10-18T06-16-11-763Z/`

This directory is intentionally ignored by Git but retained locally. Original recording sessions and marked moments remain under `.orbital-playtest/sessions/`. The snapshot is diagnostic game-state evidence; there is no implemented save-game import/resume feature. The development state can be restored from Git, while a normal launch starts a fresh scenario. The recording window was not reset or closed during this archive.
