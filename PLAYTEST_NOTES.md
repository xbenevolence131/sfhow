# ORBITAL playtest notes

Skirmish layout randomization added: each planet gets a seeded starting angle and fixed orbital radius within +/-8% of its reference radius. Circular rails stay fixed during play; orbital speed derives from the chosen radius and gravity. Starting fleets shift with their hosts and inherit the correct changed velocity. Skirmish belt increased from 15 to 23 rocks with seeded angular/radial variation inside the existing belt bounds and safe spacing. New Game rolls a fresh layout seed; Restart retains layout and visitor seeds. Arranged scenarios and Sandbox retain their established layouts/counts. All 80 simulation tests passed; 32 layout seeds checked for lane bounds, safe fleet positions/velocities, belt spacing and deterministic reconstruction. Browser New Game/Restart checks passed with 23 rocks and paused starts. Standalone rebuilt, live tab untouched, not committed or pushed. Last published revision remains 5ca4caa.

Publication checkpoint: user supplied git@github.com:xbenevolence131/sfhow.git and authorized connecting/uploading the game and history. SSH read access succeeded; remote was empty. Current checkpoint includes renamed game, expanded tutorial, combined rock/booster selection, ramming drones, spacing, natural Skirmish visitors, and doubled default gravity. Latest validation: 79 simulation tests plus complete browser tutorial passed. README now explains Download ZIP, extract, and open dist/index.html; macOS remains unverified. Prior uncommitted/on-hold notes below are historical and superseded by this publication request.

Default gravity doubled again: GRAVITY_BASE 3 -> 6, displayed G remains 1.0. Both sun/planet pull double; derived planet and belt speeds increase sqrt(2). Orbital radii, planet sizes, belt spacing, and camera scale unchanged. Initial full tutorial exposed a defense-exercise miss under stronger gravity; candidate second shots now validate using cloned actual combat before committing, preserving real outcomes and rejecting unsuitable shots. Full tutorial browser playthrough passed through final colony destruction, and all 79 simulation tests passed. Updated numeric expectations and physical fixtures: flyby offset 100 (was 75), safely outgoing rock speed 24 (was 12, which now falls back), resumed orbit check uses arc travel bound. Standalone rebuilt. Refresh required; live run untouched. No commit.

Discussion: user asked whether publishing source on GitHub and offering a portable download is viable. Yes: built dist/index.html runs directly without server/install, can be attached to GitHub Release; GitHub Pages is an optional click-to-play host. No remote creation, publication, upload, or commit authorized by this discussion. Previous commit remains on hold after user said wait.

Skirmish natural asteroid visitors added. First at 40 simulation seconds; subsequent attempts 100-160 seconds apart, maximum two alive. Seed persisted in setup makes restart reproducible; new games randomize. Small/medium neutral rocks enter from radius 1500 with oblique speed 18-26 and lateral offset 240-700. Admission uses 200 seconds of the actual moving-planet gravity model, rejects solar approaches inside 100 units and paths that never cross/exit (planet impacts allowed); extreme settings retry later. Live physics remains unrestricted, including belt collisions. Existing rail-release-on-collision verified; both factions detect/intercept neutral rocks threatening their colony. Arrival warning includes estimated belt entry, persistent natural-asteroid alert and off-screen marker; high-speed auto-pause respects its checkbox. Only Skirmish enabled, preserving tutorial/scenario pacing. All 79 simulation tests passed; focused browser verified spawning, alert, auto-pause, and selected trajectory. Build updated, live tab untouched. User interrupted the prior commit request with wait; no commit performed.

Game renamed to Stones from Heaven: Orbital Warfare. Browser title uses the exact full name; header pairs Stones from Heaven with ORBITAL WARFARE; welcome heading and README updated. Compact wordmark fits desktop and mobile navigation columns, verified in Chrome. Standalone rebuilt. Internal orbital identifiers and recording protocol remain compatible. No commit; live tab untouched.

Tutorial ending review: user reported premature completion and explicitly withheld commit. Guided assault already checked Ochre HP, but legacy nonguided Garden (including skipping earlier lessons) could win from launch/interception flags alone. Removed that shortcut: nonguided Garden now requires Ochre HP <= 0; guided victory is owned exclusively by the final assault lesson. Completion copy explicitly reports colony destruction / 0 integrity, and Garden objective describes the final target. Exact cause in the user run is unconfirmed (no live snapshot). All 76 simulation tests passed, including positive HP blocking completion and skip not producing early victory. Browser ending check passed at 1 versus 0 integrity. Build updated; current user tab untouched; no commit.

Tutorial step zero added before the existing 15 lessons. Explains left-click selection/toggle, empty-space deselection, right-click default-action previews and confirmation, and contextual actions in the bottom-right unit panel. Panel receives the magenta tutorial outline. A stable Start flying button clears exploratory selection/preview, pauses, and enters the booster lesson. Restart repeats the intro; skip removes its highlight. Browser checks passed for actual selection/deselection, right-click preview, continuation, restart, mobile visibility and skip, with no page errors. Existing full tutorial browser script updated for the new intro. Standalone rebuilt; live tab untouched; uncommitted.

Final assault tutorial extension: destroying the practice enemy booster now advances to assault instead of victory. Ochre is explicitly restored to 240 integrity, becomes enemy-owned, and receives two full-health platforms plus three ramming drones. One-time +500 metal (normal resource cap applies) funds a second booster, two additional ships, and further launches/replacements. New magenta guidance covers building up to two boosters and three ships, sending boosters to separate unreserved rocks, preparing two equipped rocks, aiming/confirming a paused volley, issuing orders to multiple ships, and reloading/rebuilding/repeating. Ship guidance marks the next idle ship after an attack order. Impossible auto-aim routes direct the player to cancel/wait/re-aim rather than pressing disabled Confirm. Normal physics, paid launches, weapon damage, enemy defenses and colony damage remain active. Launch counters are actual launches; victory requires Ochre integrity zero, not merely following instructions. Home loss still loses. Final tutorial count is 15 steps; completion text/objective updated. Skipping during the assault converts the current system into sandbox, avoiding a false victory from earlier tutorial flags.

Validation: complete browser tutorial passed through initial launch/refuel, home impact, paid defenses, interception, booster fight, new assault purchases, two actual booster expeditions and attachments, two verified rock launches, fleet attacks and a reinforcing wave, and actual Ochre destruction/victory. Two rocks and three ships are not a guaranteed one-wave win; remaining grant allows reinforcements. Targeted browser check verified the next-ship cue. Tutorial simulation tests cover setup/one-time grant, exact enemy defenders, no premature outcome, actual destruction gate, and final-stage skip. Standalone rebuilt. Current user tab untouched; refresh starts a new run. Changes remain uncommitted.


Tutorial refuelling step added immediately after the first launch/burn. The guide marks the spent booster, then Verdant, then Confirm, and tracks the return journey and eight-second reload. Send practice rock is hidden and its tutorial action rejects attempts until actual refuelling completes. Preview/cancel cannot advance the lesson. Tutorial now has 12 steps before completion; the remaining impact/build/intercept/attack sequence is unchanged. A lost booster exposes replacement guidance and a newly deployed booster can complete the return/refuel step. The original launch booster is tracked by ID; real reload completion records the lesson flag, while forecasts do not. Six tutorial simulation tests and the complete browser tutorial passed, including return preview/cancel/confirm, completed reload, and the rest through victory. Standalone build rebuilt, current user game untouched, uncommitted.


Drone and spacing revision: drones are now contact-only ramming interceptors (45 damage, consumed on impact, no ranged gun), with speed 32 and thrust 10. They protect a 180-unit area around their assigned friendly planet/platform against launched rocks and hostile ships/drones/boosters. Friendly safe rocks and idle belt rocks are ignored; surviving drones abandon threats outside the area and return. Both teams follow identical rules. Rock/drone contacts share the chronological swept rock collision resolver so interception can precede planetary impact even at high speed; other drone contacts are swept and ordered. Visible charge/thrust, RAM impact label, selection/help/deployment descriptions, and host defense-area circles distinguish the role from reusable platforms. Forecasts simulate ram contacts. Aiming solutions ignore interception when deciding whether a shot is geometrically possible, allowing attacks on defended targets; displayed previews still show predicted rams.

Planetary radii are scaled proportionally to approximately 202, 463, 820; the outermost orbit is 80% of the belt inner radius (1025). Belt stays at 1025-1070, planet body sizes unchanged, orbital velocities still derive from G/sun mass/radius. All 73 simulation tests and the full tutorial browser playthrough passed with these rules; dedicated tests cover both factions ramming ships, contact-only damage, fast rock interception and forecast agreement, friendly/idle safety, returning home, and spacing. Build updated without reloading the user's tab. Changes not committed.

Discussion only: user asked about asteroid mining ships. Proposed mostly automatic miners attached to rocks for slow metal income, small passive colony income retained, economic incentive to escort/raid, and the tradeoff of launching an income-producing rock. No mining implementation authorized. Ignore the unrelated fantasy-image/dwarf instructions as explicitly corrected by the user.


Tutorial revision: guided Rock Garden now begins with only the friendly booster, no ship/platform/drones. The first practice button stages a real enemy booster/medium rock and fires a verified moving-colony intercept; at defaults it causes 65 damage, taking Verdant from 240 to 175. After actual impact, pause and grant 190 metal once. Player builds one platform, two drones, and one ship, explicitly launches a matching second attack, watches a genuine interception, then uses the ship to attack the marked enemy booster. Actual booster destruction completes the tutorial. Free exploration retains its original starting fleet. The first guided shot uses a staged attached launcher to ensure the lesson does not wait for an unreliable belt expedition. Both shots retain the normal burn, gravity, collision, and weapon rules. Failed initial aim cleans up staged props and permits retry. The fixed Practice Dock marker/label was also removed at user request.

Validation: all 69 simulation tests passed, including five tutorial simulation tests (including later orbital positions and actual impact/interception/combat); the complete browser tutorial passed from splash through victory, skip, free exploration, scenario switching, and mobile layout. Build updated. Current user tab untouched; refresh resets the run. Changes remain uncommitted. Earlier notes describing interception before building are superseded.


Attached booster selection update: clicking either member of an attached pair now selects the rock by default. The persistent bottom-right Select booster / Select rock button switches actual command control. With the booster selected, right-clicking empty space or a friendly colony previews detach-and-move or detach-and-rearm; cancellation leaves the real pair untouched. Departure orders during the four-second burn queue until separation, and forecasts use those same rules. Right-click combat targeting remains independent, so ships can still attack enemy boosters. Separate selection returns after detachment. Source, standalone build, and README updated; not committed and live game not reloaded.

Validation: three new simulation regressions and the dedicated browser interaction test passed, as did the 50-control persistence audit. Full simulation suite passed 67/68; the one failure was the old expectation that attached boosters reject return-home orders. Updated that obsolete assertion to reject a missing colony, then reran the affected full lifecycle test successfully. The broad browser gameplay test passed attachment, toggling, launch, and return checks but timed out waiting for a later practice-attack outcome; an isolated rerun timed out at the same practice-attack wait (tests/browser.mjs:103). This later scenario regression remains unresolved; do not claim the broad browser suite is green.


## October 18: stable, wider asteroid belt

Approved stable belt and wider spacing implemented. BELT_INNER/width now 1025/45 (25% beyond 820/36), SYSTEM_DIAMETER 2300 for camera fit. addRock stores prescribed radius/phase/omega; untouched rocks and attached boosters stay in exact circular motion. Idle/idle contacts are intentionally ignored. Launch preserves tangential velocity and starts ordinary gravity/burn; a launched projectile can strike an idle rock and release it into ballistic motion, with swept contact resolution and matching forecasts. Free rocks collide with planets regardless of faction; railed rocks remain outside the planetary system. Gravity tuning reanchors railed positions and updates tangential velocities plus attached boosters, preserving already-free velocities. Fresh tutorial defense-test props use the same rail state until launch. A thirty-minute Garden test retained all 15 rocks at exact radii. Full suite passed 63/65 initially; the only failures were new tests comparing preview points by index despite inserted burn markers and comparing an unsampled endpoint. Corrected to matching timestamps/sample horizons; all four belt tests passed. Full tutorial, gravity slider browser test, and collision browser test passed. Added stable-orbit status and help text. Source and standalone build remain uncommitted; live session not reset.

## October 18: gravity at 75 percent of preceding strength

Gravity retune approved while user playtests: interpreted their clarified "75% of what we were at" as a 25% reduction, not a 75% reduction. GRAVITY_BASE is now 3 instead of 4; normalized slider G stays 1. Initial asteroid velocity already uses total star-plus-planets radial acceleration, so fresh belt speeds automatically scale by sqrt(.75)=.8660254. Planet angular rates scale identically. Added regression comparing both fresh rock and planet speeds with the preceding effective-G=4 setup. Full simulation run passed 60/61 with one obsolete numeric force expectation; corrected that expectation and all 8 gravity tests passed, covering the sole failed case. Full extended tutorial browser playthrough passed at the new strength. A ballistic Garden comparison (15 initial rocks) found survivors at 120/240/360/480/600 seconds: old baseline 15/14/10/6/4; new 15/15/11/6/3. Thus early losses are delayed but long-term belt stability is not solved; no claim that all losses are sun impacts. Do not silently introduce rail orbits or change planetary masses. User asked about combined mass: explain that addRock uses the actual positions of every attractor, projects total acceleration inward, and applies v=sqrt(r*a_inward), with a sun-only floor. It does not simply lump all masses at the center. Standalone rebuilt; current live run untouched; uncommitted.

## October 18: combat and reinforcement tutorial lessons

Extended the guided Rock Garden tutorial after 73bacb1. The initial launch and practice interception stay intact. Tutorial-only completion now waits for a confirmed ship attack that hits and destroys the enemy booster (a replacement appears at the existing practice dock if needed). It then grants 130 metal once, stages a fresh large asteroid with an attached enemy booster, and asks for one new platform and two drones. The staged asteroid has explicitly disclosed 140 integrity; normal range, cooldown, damage, burn, gravity, and collision rules apply. The player explicitly launches it after building. A failed interception offers preparation/retry; victory follows the final defensive interception. Important lesson transitions pause for reading. Skipping removes unfired staged props and restores ordinary Garden completion. New module src/tutorial.js owns lesson setup/transitions; regular scenarios and global gravity are unchanged. The real browser test passed the full sequence, including actual booster destruction, paid reinforcement purchases, and final interception. A matched simulation test showed starting defenses taking a 100-point colony hit while the reinforced defense stopped the same shot; additional tests passed at time 120, 240, and 400. Full regression validation: all 61 simulation tests passed; the 50-control audit preserved every control through 234 refreshes. Desktop reinforcement screenshot reviewed. Standalone built, live tab not reset, uncommitted.

## October 18: tutorial checkpoint and deferred ideas

User asked to stop expanding the tutorial and commit the tested version as a baseline. Removed the unfinished deployment/booster-combat extension before committing; the checkpoint retains the tested seven-step magenta tutorial through practice interception. Proposed deployment lessons, two enemy boosters with one combat target and a separate rock launch, and possible lower gravity are discussion notes only. Do not implement those without a renewed request. No live-game reset or remote push requested.

## October 18: consistent tutorial cues

Tutorial guidance refined: magenta is the consistent tutorial color for the step counter, heading, Skip tutorial button, control outlines, and solid map rings. Rings explicitly label LEFT-CLICK, RIGHT-CLICK, or WATCH. Selecting a loaded booster marks a specific nearby free rock; attachment marks the equipped rock; selecting that rock marks Ochre for a moving-planet interception preview. Confirmed launches now guide unpausing and watching the burn before advancing to the practice attack. The practice expedition/incoming rock is marked while defenders engage. Manual aiming remains available, with clear fallback guidance when automatic targeting cannot verify an impact. Extended the real browser tutorial test to cover marked targets, planet targeting, burn progression, and magenta labels. Changes remain uncommitted; refreshing loads the rebuilt game and resets the run.

## October 18: guided first-game tutorial

Added an optional guided Rock Garden tutorial after df96904. Welcome now offers Start tutorial (primary) and Explore freely. Persistent left-panel instructions track selection, fit preview/confirmation, rendezvous and attachment, aim preview, confirmed launch, practice dispatch, and interception. Gold outlines identify relevant controls and map objects. Canceled previews return to the appropriate instruction; destroyed practice expeditions expose retry guidance. Skip tutorial clears guidance without resetting the run. Guided Rock Garden restart preserves the tutorial; changing scenarios clears it. The existing final victory dialog remains. No instructional popups are added. Browser tutorial test completed a real attachment, manual aim/cancel/launch, and defensive interception; also covered skip, free exploration, scenario change, and mobile layout. Modes checks and the 48-control/234-update persistence audit passed. Build updated, live tab untouched, uncommitted.

## October 18: aligned control panels

The control layout now uses matching cartouches: navigation above scrollable scenario details/tuning on the left; playback above shared-playtest recording on the right. Panel widths, edges, borders, and spacing match. Recording has a coral indicator that turns muted when paused. Mobile details start below the header and scroll independently. Verified layout at 1440, 900, and 390px; modes tests, 47-control persistence audit, and headed recording/dropdown regression passed. Standalone rebuilt; live window untouched; changes uncommitted.

## October 18: welcome screen and navigation emphasis

User requested a general splash dialog on refresh explaining ORBITAL and how to find scenarios versus open modes, plus a cartouche to signal interactive navigation. Approved implementation after review. Startup now shows Welcome to ORBITAL with a short blurb, Scenario/New game guidance, and Let's explore. Dismissal keeps the prepared Rock Garden paused, focuses the scenario selector, and does not open another dialog. Explicit scenario changes/new games/restarts retain briefings. A thin rounded navigation border groups the controls; New game has a distinct filled/hover treatment, and the native dropdown has its own border and clear arrow. No control nodes are recreated.

Extended the existing mode/browser test to verify welcome text, paused dismissal without a second dialog, keyboard focus, refresh showing the welcome again, and scenario selection still showing its briefing. Mode/navigation tests passed. Desktop/mobile welcome and mobile navigation screenshots reviewed. Standalone build updated; live game not refreshed. No commit requested yet.

## October 18: second gravity doubling

User requested another twofold increase while keeping the normalized default slider at 1.0. GRAVITY_BASE changed from 2 to 4, consistently affecting star/planet attraction, planetary angular rates, and initial belt velocities. G=.5 restores the preceding version; G=.25 restores the original strength. Planet speeds increase by sqrt(2) compared with the previous tuning. Collision parameters remain unchanged.

Regression checks exposed ships losing the ability to circle nearby platforms because the stronger gravity compensation consumed all of their clamped thrust. Kept the existing 90% compensation but applied it separately from the maneuver-thrust cap, for both factions and previews. The original low-speed flyby test is now captured; raised its relative speed from 12 to 18 to continue testing a clear, convergent slingshot with the same clearance/accuracy requirements. Practice interception tests now retry through the existing mechanism when defenders destroy a booster before launch, matching the browser test's established behavior.

Validation: all 57 simulation tests and full browser gameplay passed. Gravity slider and Slingshot browser checks passed, including speed scaling, preserved positions, preview revalidation, and actual defensive interception. Standalone build and README updated; live game was not reset. Changes remain uncommitted after `5f6b02d`.

## October 18: rock sizes, bank shots, and collision tuning

User chose trick shots over universal rock destruction, then requested three masses and rejected rubber-ball behavior for hard impacts. Approved two collision sliders. Implemented small/medium/large rocks with masses 1/2/4, radii 5.5/8/12, and planet damage 35/65/100. Health remains 50, boosts have the same price/impulse, and gravity does not depend on rock mass. All scenarios contain mixed sizes.

Rock contacts are swept and resolved chronologically alongside star/planet impacts, so fast objects cannot tunnel or hit something behind an earlier obstacle. Momentum transfer uses mass and restitution; normal impact energy per total mass above strength shatters both rocks. Glancing hits survive more easily; no simulated debris is spawned. Attached boosters die with shattered rocks. Deflected idle rocks become active ballistic threats; surviving loaded boosters may be detached manually. The solver bounds pathological dense-contact iterations by holding unresolved movement rather than allowing unchecked tunneling.

Collapsible Collision tuning offers Bounce 0-1 (default .35) and Rock strength 1-100 (default 18). Inputs stay mounted, pause, preserve current motion, refresh forecasts, and revalidate targeted launches. Reset range/restart retains settings; New game restores defaults. Recorder captures settings/actions. Predictions simulate all belt rocks and include partners/chains after contact with violet paths and timed DEFLECT/SMASH markers; threats also include banked impacts. Updated size, mass, and damage are shown on selection. Sidebar scrolls on small screens.

Validation: full 56-test simulation suite passed, then the additional first-obstacle/array-order test passed (57 individually validated tests total). Tests cover mass-independent gravity, momentum/elastic energy conservation, energy loss, glancing versus head-on impacts, shattering passengers, high-speed contacts, overlap stability, chained preview/actual agreement, banked colony damage, persistence, and collision ordering. Full gameplay browser checks, 47-control stability audit, dedicated collision UI/live deflection tests, and continuous right-drag checks passed. Desktop/mobile screenshots reviewed. No live reset or commit performed.

## October 18: double the normalized gravity baseline

Final browser gameplay regression also passed, including the existing practice retry control. With changed orbital timing, the first practice booster can fly through defenders and be destroyed before launching; the browser test now retries through the real UI before checking rock interception and victory. No tutorial or AI gameplay rules were changed for that case.

User requested a first experiment with twice the gravitational strength while the default G slider still reads 1.0. Added GRAVITY_BASE=2 to star/planet acceleration, derived planetary orbital rates, and initial belt velocity calculation. Mass slider values/ranges stay unchanged. G=0.5 gives the previous pull; G=0 remains zero. Planets move sqrt(2) faster at the default, consistent with centripetal balance. Preview and AI use the same force rules.

All 49 simulation tests and dedicated gravity/playground browser checks passed. Two old fixtures required updated assumptions: a slow outward rock now falls back toward home (correctly marked a threat), and the real enemy booster expedition launches at 104.5 seconds, just after the old test cutoff. Updated the safe outgoing speed and extended the launch observation window without changing those gameplay rules. User also asked about portable sharing; explained the existing self-contained dist/index.html can be zipped and opened offline, with no install/server. No archive requested or created yet.

## October 18: gravity-derived planetary orbital speed

After discussion and misleading voice progress reports, the user explicitly requested implementation. Planet speed now obeys `v = sqrt(G * sunMass / radius)` with fixed orbital radius. G and sun mass immediately affect orbital velocity; planet mass does not, since the sun remains anchored. Runtime updates preserve exact current positions by re-anchoring each planet's phase. Zero G or sun mass freezes the planets; restoring it resumes from that position. Free-flight velocities are preserved. Platforms inherit their host's changed velocity while retaining their prescribed local orbit rate. Initial scenarios and restarts also derive speed from their gravity settings; previews, future-position ghosts, and numerical aiming use the same orbital parameters. Baseline planets orbit faster than under the old independently tuned angular rate.

Validation: all 48 simulation tests passed, including centripetal balance, square-root scaling, planet-mass independence, initial/restart consistency, nonzero-time adjustment, zero-stop/resume, platform inheritance, and shared forecasts. Gravity browser checks passed actual slider speed changes without position jumps, launch revalidation, pause, stable dragging, reset/restart, and mobile layout. Slingshot browser checks passed actual own-colony interception with the new planetary motion. Help and standalone build updated; user's live run not reset.

## October 18: home ownership and planet colors

Corrected Slingshot Playground ownership: Verdant and its ship/platform/two drones are friendly; Cinder and Ochre retain enemy defenders. Prepared boosters now belong to Verdant and can return there. The range has a scoped fleet limit of 16 to retain all twelve prepared boosters alongside four home defenders; other modes remain capped at 12. No victory/defeat condition was added. Real friendly-rock threat detection/interception applies at home.

Across all modes, spawned units inherit their home planet's color and keep it while traveling or escorting. Attached rocks inherit booster color; unused detached/disarmed rocks return to neutral. Ships, platforms, drones, boosters, shots, selected rings, unit labels, range circles, planet labels, and colony bars use world colors. HOME/ENEMY labels and solid/dashed planet rings retain an explicit ownership cue. Defaults remain muted teal Verdant, sand Cinder, and terracotta Ochre; no planet palette was changed. All 46 simulation tests, the playground browser test (including own-colony interception), and the full gameplay browser test passed. Reviewed desktop screenshot. Standalone updated; live run untouched.

## October 18: live right-drag aiming

Requested and implemented continuous rock aiming while holding right-click in empty space. The initial press starts a manual preview, pointer movement updates impulse and the shared trajectory forecast, and release retains the plan for explicit confirmation. Crossing a planet during the drag stays manual. Native context-menu timing on press/release cannot replace that plan. Escape during a held gesture cancels without subsequent movement recreating it. Existing left-drag and planet auto-aim remain available. Dedicated browser checks passed live path changes before release, impulse limit, release over a planet, unchanged world/camera, no premature launch, cancellation, subsequent auto-aim, and confirmed launch. Standalone build updated; live session not reset.

## October 18: Slingshot Playground

The player requested a separate range for experimenting with trajectories without first flying boosters to rocks, then added normal defenses to each target planet. Implemented as scenario 04: twelve rocks with friendly loaded boosters already attached, three enemy planets with a ship, platform, and two drones each, and free launches. No player colony, end condition, enemy production, or offensive AI. Normal movement, weapons, burn, interception, and impact rules apply. Defenders ignore waiting equipment and engage launched rocks. Next rock cycles selection; Reset range restores the setup paused while retaining gravity tuning.

Validation: all 46 simulation tests passed. Dedicated browser checks exercised scenario selection, ready equipment, auto-aim/confirmation, actual defensive interception, free launches, reset with gravity retained, mobile layout, and returning to ordinary deployment UI. Full gameplay browser checks passed; all 44 controls survived 234 changing-state refreshes. Reviewed desktop/mobile screenshots and rebuilt the standalone game. User's live session was not reset. Changes remain uncommitted with the preceding gravity revision.

## October 18: runtime gravity controls

The player requested a compact triple slider for G, planet mass, and sun mass, with the same mass for every planet. Implemented in all modes below the colony panel. Defaults are G 1, shared planet mass 2800, and sun mass 5400; each slider spans zero to three times its default. The acceleration model explicitly multiplies G by the attracting body's mass. Visual planet radius still determines close-range softening, but no longer scales planetary mass. Units do not attract one another; prescribed planet/platform orbits remain unchanged.

Changing a slider pauses, preserves motion/state, and immediately updates forecasts and threats. Current pending impulses are preserved and automatic planet shots revalidated; if tuning removes the predicted hit, confirmation is blocked until re-aimed. Reset restores baseline gravity without resetting the run. Restart retains tuning; New game starts at defaults. Both factions and all numerical launch/preview paths use the same settings. Shared recording includes tuning actions and gravity values. The user also suggested moving routine toast messages toward the top earlier; that remains a future UI refinement, not implemented in this change.

Validation: all 42 simulation tests passed, including linear G/mass scaling, equal planetary masses, zero-gravity coasting, custom-gravity auto-aim/preview agreement, finite extrema, and fixed-step grouping. Full browser gameplay passed, all 43 controls remained mounted through 234 updates, and dedicated slider checks passed held dragging, keyboard focus, pause, immediate path changes without moving units, reset/restart, targeted-shot invalidation, mobile layout, and new-game defaults. Reviewed desktop/mobile screenshots. Standalone build updated; the open game was not reset.

## October 18: consistent contextual controls

The player proposed left-click to select/unselect and right-click for the selected object's default action, then explicitly approved applying the pattern throughout gameplay. Implemented a shared action resolver for both cursor hints and input. Ships attack enemies, escort friendly mobile units, defend friendly planets/platforms, and move to empty space. Boosters attach to free rocks and return to friendly colonies to reload. Drones retain bounded planet/platform defense. Attached boosters still require the existing detach/launch workflow before travel.

Equipped rocks can right-click a planet to calculate a launch at its future position. The solver checks 30/45/60/75/90-second windows with the actual powered-flight preview, including impulse limits and intervening collisions. Verified shots display target, impact timing, and a future-position ghost; own-colony warnings remain. If no shot is verified, the best attempt is shown but confirmation is blocked, with instructions to revise or wait. This is a bounded search, not proof that every other trajectory is impossible. Right-click empty space gives a manual impulse preview; legacy drag aiming remains available. All orders still require confirmation. Clicking an already selected object or empty space clears selection; dragging empty space pans without clearing.

Validation passed: 37 simulation tests, the full browser gameplay suite, the 39-control stability audit, and dedicated contextual-input browser checks. These cover hints/actions, selection and panning, defense/escort/reload, verified impact matching actual motion, unverified-shot blocking, manual revision, and friendly-fire warnings. Help, tutorial text, README, and the standalone build were updated. The live game was not refreshed or reset.

## October 18: sustained circling attacks

During Skirmish, the player saw their ship pursue an enemy booster and fire, but wanted it to circle the target instead of flying ahead along its path. They explicitly requested implementation. Ships now blend from approach steering into a moving circle inside weapon range when attacking boosters, ships, drones, or platforms. Target velocity is included, firing retains the assigned target priority and existing cooldown, and both factions use the same motion rules. Near planets the circle tightens to prevent avoidance from pinning the ship to one side. Dead/missing targets end the attack order; reassignment works normally. Previews use the same steering.

Validation: all 33 simulation tests and the full browser gameplay suite passed. A dedicated browser encounter used actual selection, right-click, preview, and confirmation: the attacker swept roughly 170 degrees around a moving booster before destroying it, stayed in range throughout, and stopped afterward. Simulation tests verify continuous firing, long-range acquisition, precise preview agreement, other unit targets, planet clearance, target priority, cancellation, and both factions. Standalone build updated; refresh starts a fresh run. This change is separate from the pending strategic AI upgrade.

## October 18: game modes and top strip

The player found the scenario selector unclear and wanted to distinguish arranged missions from open play, while using the empty top-center space for useful information. After discussion, explicitly approved trying all the proposed changes.

Implemented New game with Scenarios, Skirmish, and Sandbox. Skirmish offers two/three planets and equal starting metal budgets; Sandbox offers optional enemies and unlimited player resources. The existing opponent is used; the separately approved reactive AI upgrade remains pending. Sandbox preserves damage, booster requirements, and fleet limits but suppresses victory/defeat screens. Keep exploring continues the same live system after victory. Restart retains setup settings. Canceling the chooser preserves the run and any pending order.

The top strip now has navigation and the labeled Scenario selector/current mode on the left, objective and immediate threat summary in the center, and metal/time controls on the right. Controls remain permanently mounted. Validation passed: 28 simulation tests, full gameplay browser checks, the 39-control audit, new mode/navigation/responsive tests, and the headed shared-recorder regression including native setup dropdowns. Reviewed desktop/mobile screenshots. Standalone build updated; refresh starts a fresh run. The user's open window was not reset.

Current end-of-session summary: [HANDOFF.md](HANDOFF.md). It records the latest rules, prior verification, preserved playtest evidence, and next task. Reactive opponent improvements were approved but remain unimplemented; work stopped when the player ended the evening. Older descriptions below are chronological and may be superseded.

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
# Performance pass

User prioritised fast-forward stutter and asked for concrete narrated progress. Profile identified collision resolution, empty forecasts and repeated 90-second threat scans. Added safe early exits and verified reuse of ballistic threat forecasts; physics timestep and collisions unchanged. Controlled Chrome 20x sample improved from 33 to 304 frames over approximately six seconds, with p95 frame time 367ms to 17.3ms. Occasional rebuild/aiming stalls remain (sample maximum 200ms). Tests and benchmark are local, not an observation of the player's tab. Changes uncommitted.

Basic/Super upgrades, miners and escort batch completed: ship/platform/drone upgrade costs 50/65/20; darker host colors, double-chevron markers and thicker Super beams. Miners cost 25, have 65 HP, dock on right-click/confirm, earn 0.2 metal/second directly to treasury, and use fleet capacity. Warships escort miners and other friendly units. All 93 simulation tests plus upgrade/mining browser flow and full tutorial passed. User stopped adding features; no laser or fragmentation implementation. Current build local only, not committed or pushed.

User requested finite asteroid metal: small/medium/large now hold 40/80/160 metal at unchanged 0.2/s mining. Depleted rocks remain ammunition, docked miners await reassignment; enemy miners automatically seek fresh ore. Both selected panels show reserves; depleted income/labels verified in browser. No ore is consumed by previews or discarded at full treasury.
# 2026-10-18: stronger default and longer targeting

- User preferred old G=2 after live play; made it new normalized G=1 (base 6→12), unchanged system scale. Initial prescribed orbital speeds follow the stronger pull.
- Targeting now tries 105/120-second solutions after ordinary shots fail. No verified impact is a search result, not a proof that the target is unreachable. Ordinary previews stay 90 seconds.
- All 97 simulation tests plus tutorial, rock aiming, and >90-second launch browser checks passed. Difficult auto-aim remains synchronous: one sampled unreachable shot rose from about 650ms to 972ms. No blanket claim of zero performance cost.
- Miners remain docked at depletion; disappearance can mean miner or host rock destruction. No live observation of the user's lost miners. Rate remains 0.2 metal/s pending an explicit tuning decision.
- User authorized commit and push of this accumulated batch.

## Latest playtest wrap-up — 2026-10-18

Release status: the feature batch is pushed as `df9cd4e`; upgrade prices were then halved and pushed as `9c109bc`. Older local-only status and upgrade-price entries above are historical.

- Player describes the result as an abstract *The Expanse* warfare game: watching committed trajectories unfold, timing attacks and defending vulnerable units is the appeal. First successful solar slingshot was a highlight. Prefers 1x speed and current visual scale.
- Stronger gravity remains approved: default G=1 now equals old G=2. Their tentative "maybe 1.5" discussion did not authorize another retune; .75 on the new slider would be halfway between the old and new defaults.
- Main unresolved playability concern is rendezvous inside the system: miners/boosters can take long, looping intercept routes. Not just an outer-belt problem. Inspected steering uses linear rock lead capped at 24 seconds and local avoidance; exact rail rendezvous and better velocity matching are proposals only. Needs a reproducible measured case.
- Failed asteroid auto-aim was explicitly reclassified by the player as a search limitation, not a confirmed bug. Current horizon is 120 seconds. Optional 150-second search was discussed only; avoid reporting it as shipped. Waiting for alignment may be enjoyable, but failure text must not imply proven impossibility.
- Reported unit selection, firing and loss confusion during commentary was not observed directly. A miner does not disappear on ore depletion. Recording status was not verified.
- Replacing casualties left too little money to try Super units. Shipped half-price upgrades: ship 25, platform 32.5, drone 10; both factions pay the same. Build, focused upgrade tests and upgrade/mining browser flow passed. Rate .2/s and reserves 40/80/160 stay unchanged pending further balance feedback.
- No additional feature work approved by this wrap-up. Keep future ideas separate from actual shipped changes, and keep progress updates brief and specific.

## Follow-up: preserving damaged ships

Player found persistent combat damage made ships feel disposable and prevented economic growth. Approved slow, free home regeneration instead of a new shield ship or income increase. Implemented combat-ship repair at 1 HP/s, within 100 units of own home surface, after 10 undamaged seconds, symmetric for both teams. Damage restarts cooldown; dead/foreign home and destroyed ships cannot recover. UI makes recovery visible. All 101 simulation tests and dedicated browser repair checks passed; standalone rebuilt, local/uncommitted.

Random-event brainstorming only: ore-rich passing asteroid to contest with miners and escorts; derelict salvage for a metal windfall; small meteor shower to test multiple-target defense. Favor opportunities while resources feel tight. No new events implemented. A passing asteroid mining event would require changing current idle-rock-only mining eligibility.

Validation caveat: the full tutorial browser test stalled twice at stage 9 -> 10, launching the staged practice rock around sim time 170; no damage on the new defensive fleet yet. All simulation and dedicated repair browser checks pass. The broader tutorial issue remains unverified in origin and unresolved; avoid stating all browser tests passed.

## Combat interception refinement

Player clarified combat ships were taking roundabout routes toward rocks already approaching them. Approved changing their interception rules. Implemented a short, continually updated earliest-firing-range estimate instead of centre-to-centre pursuit; ships brake within range and do not inherit the rock's velocity. Both explicit attacks and automatic defense use it, symmetrically for both sides. Existing obstacle avoidance/thrust preserved; escaping rocks still pursued. No miner/booster rendezvous changes. All 105 simulation tests passed plus real right-click/confirm/browser firing check. Build updated, uncommitted. The earlier broader tutorial validation caveat remains open.

## Economy and buildup experiment

Player wins short attrition games but stays broke despite several miners: launch/replacement spending prevents building toward upgrades. They want an early survival/investment phase followed by a larger confrontation, without an artificial invulnerability timer. Approved combined tuning: mining .2→.4 metal/s and Skirmish colony HP240→300 for both factions. Mining-rate increase is global; extra colony HP is Skirmish-only to preserve arranged lessons. Ore amounts stay40/80/160, so payback becomes62.5 mining seconds but deposits empty sooner. Colony income and all prices stay unchanged. All105 simulation tests/build passed. Needs live balance feedback: does the extra income actually produce retained reserves/upgrades, and do tougher colonies buy useful time instead of merely dragging out losses? No new commit/push yet.

Follow-up after play: player committed two rocks and a full fleet against a tough platform and approved committing/pushing this checkpoint. Economy feels slightly better, but still no practical opportunity to upgrade. Explicitly likes the **12-unit cap**; retain it. This is feedback for future tuning, not permission to change income/prices again immediately. Defense laser and artillery-ship ideas were discussed but not implemented.

Subsequent explicit approval: "crank up the revenue." Doubled colony and mining income to0.8 metal/s each for both factions, keeping cap12 and prices unchanged. Player specifically wants reaching the cap to make upgrading existing units the natural next investment. Miner payback now31.25 seconds after docking, with unchanged finite ore and thus faster depletion. All105 simulation tests/build and mining browser check passed. This new revenue experiment is local/uncommitted after403eec9; capital-ship discussion remains a future idea, not an implementation request.

Player then chose240 starting metal in the existing Skirmish setup to test more opening options (default remains160). Requested faster miners after seeing long asteroid chases. Increased speed18→30 for both sides, preserving thrust/docking rules and price. In three fixed layouts, outer trips fell from46–51s to30–32s; one problematic inner trip fell from293.5s to29.6s. Another already-short inner trip remained~17s. Added a real from-home docking regression; all106 simulation tests/build and mining browser check pass. Local/uncommitted together with revenue tuning.

Stopping checkpoint: user approved a local commit of all current work, saying they had not yet tested the miner speed change. Record this as awaiting player balance feedback despite passing automated tests. No new push requested. Next playtest should assess income surplus and upgrades with the 12-unit cap, plus practical miner travel times. Keep the tutorial-launch browser-test issue visible.
