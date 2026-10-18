# ORBITAL playtest notes

These observations come from the first play session on October 17, 2026. Approved fixes are marked below; remaining proposals are a backlog for later discussion.

## Friendly rocks and colony collisions

The player launched a rock toward their own planet and saw it pass through. This looked like a collision failure.

Current behavior: friendly fire is disabled by skipping collisions between launched rocks and planets of the same faction. Player rocks therefore pass through Verdant without damage.

Follow up: explain this rule where the player aims or reviews a launch. Consider whether a harmless visible impact would be easier to understand, but discuss that change with the player first. The assistant proposed this alternative; the player did not approve it. No collision changes were made.

## Why defenders ignored the rock

The player expected their defenses to engage a rock they had aimed through their own planet. No units fired because player-launched rocks remain friendly, regardless of their trajectory.

Follow up: make rock ownership and interception eligibility clearer in selection details and launch feedback. Explain that defenders attack hostile rocks only. In Rock Garden, the Send practice rock button creates the hostile incoming rock needed to demonstrate interception.

## Scenario objectives and planet identity

The player understood rock aiming and unit orders but did not understand the objective, asking whether they should hit the red planet.

Current objectives:

- Rock Garden: launch any rock, then intercept a hostile practice rock. Hitting Ochre is optional.
- Hold the Orbit: keep Verdant alive for four simulation minutes.
- Neighbors: destroy the enemy colony on Cinder while protecting Verdant.

The rusty-red planet, Ochre, is an uninhabited practice target. Cinder, the rival colony, is pale and has coral faction markings. Planet surface color alone does not identify ownership.

Follow up: make each scenario's immediate objective and intended target more obvious during play. Distinguish neutral practice targets, the home colony, and rival colonies without relying on surface color.

## Training sequence

The explanation in conversation was necessary to connect launching a friendly rock with the separate hostile interception exercise.

Follow up: improve the in-game sequence so it explicitly teaches: launch your own rock, send a hostile practice rock, unpause, and watch defenders engage when it enters range. Make clear that aiming your own rock at home does not initiate the defense exercise.

### Leaving the sandbox

After completing training and choosing Keep exploring, the player could not find how to advance to another scenario. The scenario title in the upper-left corner is a dropdown, but this was not obvious. Follow up: discuss making scenario navigation and the next mission clearer after training. No navigation redesign has been approved.

## Development feedback

### Practice button flicker and missed clicks

The player reported that clicking Send practice rock makes it blink rapidly and appears to do nothing.

Confirmed in a browser against the delivered standalone build: the UI replaces the entire lesson section, including the button, every 150 milliseconds. Replacing the button between mouse-down and mouse-up loses the click. A 250-millisecond click launched no rock; a quick click launched one. Repeated replacement also resets the button's visual interaction state.

Once a click registers, the rock is launched but remains stationary while the game is paused. Clear launch feedback and an unpause hint should distinguish this state from a missed click.

Fixed with the player's approval: the practice button remains mounted across UI refreshes, and only changing lesson text is updated. The paused launch message now explicitly says to press Space to unpause. Rebuilt the standalone game and verified held clicks spanning multiple refreshes, keyboard focus retention, prevention of duplicate practice launches, and the browser gameplay checks. Relaunched the updated game.

### Setup messages

The player asked about initial Failed messages. Those came from Windows blocking the npm PowerShell shortcut and checking a folder without a Git repository; they were not game failures. Using npm.cmd resolved the command issue.

Follow up: keep environment diagnostics understandable and distinguish setup failures from failures in the game.

### Order button flicker and full control audit

The player reported the same flicker and missed clicks on Defend home and Stop, then explicitly requested auditing and fixing every affected control.

Confirmed cause: the selected-object panel replaced all its markup when health or arrival information changed. Drone text also contains an ampersand, which the browser serializes as &amp;, making the HTML comparison fail even when paused and unchanged.

Fixed with approval: every button, input, and dropdown is now permanently mounted in the initial HTML. Selection and lesson refreshes update text, visibility, and state without replacing controls. The audit also fixed Select home colony doing nothing after the selected unit disappears. Remaining HTML replacements contain display text only, not controls.

Verification: all 24 controls remained connected through 219 refreshes across all three scenarios and selection types, including changing health and forecasts. Browser checks exercised held clicks on every button, live ship/drone orders, keyboard focus, deployment, toggles, scenario selection, modal actions, and the complete gameplay loop. Rebuilt and relaunched the standalone game.

### Progress during voice conversations

The player could not see that work was happening during voice conversation and asked for status. Give brief spoken checkpoints for changes, testing, and relaunch. Explain that an already-open game tab retains the previous version until it is refreshed or reopened.

## Booster ship gameplay

The player likes the orbiting planets, fixed orbit sizes, ships, and platforms, and emphasized that rocks are a central attraction. They want fleets to contest the ability to launch rocks instead of allowing arbitrary remote pushes. Do not demote rocks to an incidental feature.

Approved and implemented: unarmed booster ships must physically rendezvous with an asteroid and attach a booster before it can be launched. Ships carry one booster, attach over six seconds, then return home to rearm over eight seconds. Combat ships can escort friendly boosters or intercept enemy expeditions. Each starting friendly fleet includes a booster; replacements cost 50 metal and count toward the fleet cap. The existing 35-metal launch cost remains. Both factions require attachment, including the training attack from the practice dock.

The tutorial, selection panels, launch gating, countdown visuals, and enemy behavior now follow this sequence. The existing stable-control approach is preserved for the new deployment and Send booster buttons.

Verification: 17 simulation tests passed, including a complete rearming cycle and stopping an enemy launch by destroying its booster. Browser checks completed actual booster dispatch, travel, attachment, launch, and practice interception. All 26 controls persisted across 234 changing-state refreshes and passed held-click checks. Rebuilt and opened the standalone game.

## Shared playtesting visibility

The player asked whether the assistant could see their cursor, clicks, and game state while they play so they can debug together, then explicitly approved a shared window and recorder.

Implemented a dedicated Chrome playtest window with an opt-in recorder. It captures game-only screenshots with cursor position, interaction history, accepted/rejected actions, feedback, and game-state snapshots. A rolling history retains up to two minutes. Mark moment (M) preserves the lead-up; Pause recording stops new capture. Inspection uses the same player session without controlling it. Normal game tabs remain separate and unrecorded.

Verified the recorder in browser tests, including immediately pausing after marking a moment, reload continuity, and refusing to capture a tab navigated away from the game. Launched the visible shared session and successfully inspected its actual briefing screen, cursor, and game state through the localhost helper.

When the player reports an issue in that window, run `npm run playtest:inspect`, view the returned screenshot, and inspect the recent actions/state before drawing conclusions. Earlier moments can be retrieved using `--ago=10`; preserved markers are under the session's marks directory. Do not claim to watch continuously: the assistant inspects snapshots and logs during conversation, while the local helper records between turns. Any gameplay changes still require the player's instruction or approval.

## Collaboration preference

### Shared-window scenario dropdown report

The player reports that the scenario dropdown opens and immediately closes, preventing departure from Rock Garden. The shared interaction log confirms repeated clicks on the enabled scenario selector without a selection-change event. The selector remains permanently mounted; no scenario reload was recorded. Capture interference is a hypothesis, not confirmed: a separate headless browser check kept a native select open through a screenshot. Next diagnostic: have the player pause recording and retry the dropdown in the visible shared window. No fix applied yet.

Confirmed subsequently: pausing the actual recorder restored the dropdown. With the player's approval, reproduced the issue in a separate visible Windows Chrome window: Playwright page.screenshot closed a native select popup; direct Page.captureScreenshot left it open. Updated the helper to capture the existing browser surface directly without Playwright screenshot preparation or a viewport clip. Headless testing alone had missed this browser-specific behavior.

Verification: `node tests/playtest.mjs --headed` passed. All three scenarios were selected through the real popup after repeated captures; focus and viewport stayed unchanged. Stop, Defend home, Colony, and Confirm accepted held clicks during concurrent captures. Existing history, bookmarks, pause/resume, reload, and opt-in isolation checks passed. The currently running helper still uses the old code; activating the fix requires restarting the shared window, which resets its current run. Await the player's go-ahead for that reset.

The player approved reopening and resetting the run. Launched the updated shared window and verified that its new helper is ready, recording frames, and reporting no capture errors. The fix is now active.

Player verified that scenario selection works again with recording active. Requested a note for later: make active recording more obvious with a conspicuous red recording symbol beside the recording control, like a familiar camera/VCR recording indicator. This is a recorded UI request, not implemented yet.

Player reported a confusing up/down/back trajectory when previewing Booster 05 fitting Rock 15 in Neighbors. Inspected the shared screenshot and pending order. The forecast draws the complete 90-second flight including attachment and automatic return/rearming as one undifferentiated dotted line. Explain that return leg; consider marking the attachment point and distinguishing or hiding the return leg in a future approved UI change. No gameplay change applied.

## Manual booster attachment (supersedes the delivery-ship behavior above)

### Rock friendly fire — current behavior

The player said a self-inflicted asteroid impact should be their responsibility and explicitly approved enabling it, with defenses intercepting friendly rocks that threaten home. Launched rocks now collide with every planet regardless of faction. Weapons otherwise continue to avoid friendly ships and colonies. Both factions use a forecast of launched rocks to identify threats to their own colonies; safe outgoing and unlaunched friendly rocks are not targeted. The scan uses the same powered-burn/gravity integrator at fixed simulation-time intervals.

Pre-launch previews prominently warn when a shot would hit the player's colony. Own incoming rocks appear in the threat list and trajectory display, with an impact estimate and the existing optional high-speed automatic pause. Warning events are deduplicated. Self damage and interception of one's own rocks do not count as practice accomplishments. The enemy also avoids intentionally aiming a launch through its own colony.

Validation: all 23 simulation tests passed, including forecast/actual self-impact agreement and both factions intercepting dangerous friendly rocks while preserving safe launches. The browser gameplay loop passed, including pre-launch colony warnings, friendly-rock alerts, automatic threat pause, and actual friendly interception without colony damage. Rebuilt dist/index.html; refresh the open game to load the change. Gravity strength and ship avoidance were not changed.

### Powered launch revision — current behavior

The player subsequently requested and approved a short acceleration phase after confirming launch, followed by automatic detachment. Implemented a four-second burn: the selected velocity change is delivered gradually while gravity continues, with a visible BURN countdown and simple exhaust. The booster stays attached during firing, then separates with the rock's velocity and waits for further player orders. It does not automatically return home. Manual detachment remains available before launch; the burn completes automatically once committed. Destroying the booster during firing cuts thrust and leaves the rock coasting with the velocity accumulated so far.

The trajectory preview and actual simulation use the same burn integrator. The powered segment is distinguished from the coast and marked COAST at completion. Enemy aim accounts for the finite burn; enemy boosters obey the same burn and separation rules, then the opponent explicitly orders them home. Gravity strength is unchanged; the stronger-gravity request remains a note for later.

Validation: 21 simulation tests passed, including gradual thrust, exact preview agreement, separation timing, interrupted burns, swept impacts while firing, and enemy targeting. Browser gameplay checks passed the real countdown/automatic separation and manual return controls alongside the full scenario loop. The standalone build is updated; refresh the open tab to load it.

### Gravity tuning observation — requested note only

The player finds rock trajectories too straight across most of the system; significant deflection appears to require passing very close to the sun. They want somewhat stronger gravity so orbital curvature is visible farther out. Explore stronger gravity relative to launch speeds, keeping trajectories readable and previews consistent with simulation. This is a tuning note for later, not authorization to change physics now.

### Wider system and planetary gravity — approved first tuning pass

The player subsequently proposed smaller-looking planets, larger orbital radii and wider gaps, combined with stronger planetary pull for hook shots and slingshots, and asked to keep talking while implementation proceeded. Implemented that first pass: orbital radii are now 170 / 390 / 690 (previously 155 / 285 / 420), bodies are smaller, and the belt is around 820–856. Planetary gravity is stronger and scales with planet radius; the sun's strength, inverse-square model, softened close-range force, and fixed timestep are unchanged. The camera fits the larger system. Ship/booster cruising speeds and thrust were increased modestly, the launch impulse cap is 26, and initial belt velocities account for the stronger radial pull.

A representative clear planetary flyby bends roughly 40 degrees compared with about 3 degrees using the earlier weak planetary gravity. Its preview matches the actual path; halving the physics timestep changes the endpoint by less than one world unit. The initial booster rendezvous and attachment takes approximately 32 seconds. All 24 simulation tests, browser gameplay checks (including friendly-rock warnings/interception), and the 28-control audit passed. Reviewed the desktop screenshot for map fit and planet spacing. The standalone build is ready; refresh the shared tab to load it, starting a fresh run.

The player clarified that their surprise about ships avoiding moving planets was appreciation, not a complaint. Keep the current avoidance behavior. They also asked how gravity works: continuous inverse-square pull from the star and all planets, softened close in; planets/platforms use prescribed orbits, and ships use steering assistance. Explain directly while continuing approved work.

The player clarified that the order should only fly to a rock and attach. Any detachment or later travel should be their decision, and explicitly approved implementation.

Implemented: a booster remains physically attached and follows the rock's velocity until manually detached. Its flight preview stops at an ATTACH marker. Attached ships show permanent Aim rock and Detach controls; departure orders require detachment first. Detach is previewed and confirmed, and can be canceled without changing the live ship. Detaching before firing retains the charge and removes launch authorization from the rock. Launch spends the charge but leaves the ship attached; the player can detach afterward and explicitly order Return home to reload. Destroying an attached booster prevents an unlaunched rock from firing; destruction/impact of the rock also destroys its attached ship. The opponent explicitly issues its own detach and return orders after launching.

Validation: all 19 simulation tests passed, including exact preview agreement up to attachment, persistent attachment, manual detachment/rearming, and destruction cases. Browser gameplay tests passed real dispatch, attachment, detach/cancel/reattach, Aim rock, launch, manual return, practice interception, victory, and restart. All 28 controls stayed mounted through 234 changing-state updates. The shared recorder's visible-Chrome dropdown/capture regression also passed. Rebuilt dist/index.html; an already-open game tab needs refresh to load this version (refresh starts a fresh scenario).

When the player describes unexpected behavior or asks how something works, explain it first. Ask before implementing a behavioral change unless they explicitly request the fix. Do not treat a playtest observation as automatic authorization to change the game.

The player initially requested notes for later fixes, then explicitly approved the practice-button fix, a subsequent audit and fix of all affected controls, the booster-ship mechanic, and shared playtest instrumentation. Other proposed changes still require discussion before implementation.
