
# TODO-NEXT (written at wrap-up)

Build: python3 build.py (also regenerates assets/skymask.png, assets/lamps.json via gen_skymask.py). Tests: test/{smoke,ambient,v4,v5,v6,pantry,v9}.js, parity.py/.mjs. Run with NODE_PATH=$(npm root -g) node test/X.js.

## DONE and tested
- **PRIORITY 1 standing/navigation fix completed:** measured floor-contact polygons in `tools/room-layout.json`, generated padded floor in `assets/navigation.json`, grid A* and traffic clearance for every walk (including Trader/Boss and fill/printer trips), 5 distinct desk assignments, station work/idle screenshots. `test/navigation.js` checks all floor nodes/edges and runs a 120-second, 100ms-sampled soak. See `docs/NAVIGATION-VERIFICATION.md` and `docs/shots/navigation-{floor,stations}.png`.
- Chat-partner reservation, POI facing + spots, stuck-actor watchdog + tag gap (stall false positive was a test bug; fixed in test).
- Desk stations (STATIONS in ui.js), Trader->Boss stop, tag shifts retuned (boss -40%, portfolio 32%, risk 26%).
- Pantry props (assets/pantry.json inlined as PANTRY), coffee/printer/snack routines, PM slip trip after fill (test/pantry.js; the slip-trip check was flaky once: it needs QF_AMBIENT and a real fill via Approve then /next; re-verify).
- Sky mask (assets/skymask.png, mask-image on .sky/.skyfx, thin rain, haze, slower back window). Debug overlay gen/skymask-overlay.png. Lamp bbox coverage cannot be <3% for diagonal bars (glass inside the bbox), so the test measures coverage inside the lamp polygons (LAMPS global).

## NOT DONE
1. Night light map (G): replace flat multiply (.roomlight) with darkness canvas (multiply, masked to ROOM_HEX; destination-out soft holes under both lamp bars, monitor clusters cool-blue, near door; lamps on ~20% dark in pools, ~55% far corners) + glow canvas (screen/plus-lighter: warm lamp cones alpha .18-.25, diffuser cores ~.85 from LAMPS.diff polygons, cool #9fd0ff ~.2 in front of working monitor clusters). Actor filter brightness 1.0 in pools / 0.8 in dark corners from feet position. Lights on 18:00-06:30, ~60% dim in cloudy/rain/dong by day, off on clear day. Lightning flash brightens masked sky + room slightly. Switch-on flicker ~0.6 s two flickers (not under reduced motion). GOD key "lights":"auto"|"on"|"off" (add to the GOD block, keep other keys); chat /lights on|off|auto (den bat|tat); player command beats GOD until auto. Tags/bubbles/HUD untinted; monitor flicker visible. Tests: 22:00 floor luminance under lamp >= 2x far corner and >= 1.6x old flat tint; diffusers bright; lights off dark. Screens: night lights on, night dong lights on, dusk switch-on, 400px night.
2. Sunless room image (H): gen_sunless.py exists (WIP, never run to completion; first run was killed; not wired into build.py). Needs: detect sun patches (lum > 1.18x local shadow level via ~60 px 30th percentile + warm shift) on floor/counter/right wall, inside room silhouette, outside glass; open/close + feather 3-4 px; debug overlay (view it); hand include/exclude polygons (lamps, monitors, whiteboard excluded); second webp scaled to the surrounding shadow level keeping wood texture; stack over the room image with opacity 0 clear day, 1 dusk-dawn, 0.6-0.85 cloudy/rain/dong by day, smooth at dawn/dusk. Tests: at 22:00 beam areas mean luminance within 8% of adjacent shadow floor; at 10:00 clear the beams untouched. Screens: day clear vs night same framing, day rain.
3. Station close-ups and 5-seat working/idle/animation checks are now in `test/navigation.js`; reviewed montage in `docs/shots/navigation-stations.png`.
4. Ambient cooldown test fixed: inspect routine state instead of treating the normal desk status "xem màn hình" as a new outing. Shortest-path animation test observes a longer walk so that all 4 animation frames can occur.

## Standing-position bugs reported by the owner (2026-11-13 21:44) — PRIORITY 1, RESOLVED

Seen in screenshots after the station fix:
- Portfolio Manager (Ray Dalio, station `left@35.4,67.5`, spot [36.1, 63.5]) stands INSIDE the Boss's desk pair while idle ("nhìn quanh") — his feet are between/under the desks, overlapping the Boss's desk and the Boss.
- The Boss and Portfolio stations share the same desk pair, so they collide; the Boss "xem màn hình" while Ray stands right in front of the Boss's monitors.
- Actors walking (e.g. Boss "sang chỗ Ed Thorp") cut close to desk corners.

Original acceptance criteria (implemented and checked):
1. Build a walkable floor mask at build time: room floor polygon minus every desk/counter/cooler footprint (footprint = the object's floor contact quad, measured on a zoomed grid screenshot, padded by ~0.6 tile). Save a debug overlay PNG and check it.
2. Give each of the 5 seats its OWN desk (6 desks exist: rear 31.4,64.8 · left 35.4,67.5 · rear 42.4,50.4 · left 46.7,53.0 · left 62.6,76.0 · right 55.4,78.7). Station spot = a walkable point on the keyboard/screen side, just outside the footprint; look-at = monitor cluster centre. No two stations within 1.5 tiles.
3. Every spot (stations, POI spots, Trader stop beside Boss, chat meeting points) must lie in the walkable mask; every graph edge sampled every 0.25 tile must stay in the mask. Regenerate the waypoint graph from the mask (grid A* or visibility graph) instead of hand nodes.
4. Idle/"nhìn quanh" at home happens AT the station spot, never elsewhere.
5. Test: soak 120 s with QF_AMBIENT and speed fast; every 100 ms assert every actor's feet are in the walkable mask and no two actors' feet are closer than 0.8 tile (except chat partners at ≥ 0.8). Close-up screenshot of each station with its actor working and idle; look at each one.
