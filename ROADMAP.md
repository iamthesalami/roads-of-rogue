# Roads of Rogue — Endgame Roadmap

> The village sim is built. This doc is where it goes next: the hermit's little colony of
> kidnappees turns into a cult, then a militia, then a conquest of a small fictional country.
> Same dark-comedy engine as "kidnap people, make them live here" — just turned up.

---

## The pitch

You've spent the early game dragging people home and keeping them fed. Once the village is
big enough it curdles into a **cult**. You build a **headquarters**, **brainwash** the
villagers into believers, **arm** them with weapons looted on combat runs, and **raid**
cities one at a time — each raid is about destroying that city's ruling faction (a themed
squad of powerful AI-generated enemies) and holding its town square. Beaten cities become
territory you manage. Keep going until you control the country. Everything gets harder as
you go.

---

## The three currencies

Right now cash has no real job. This fixes that by splitting the economy into three clean
layers:

| Currency | Source | Spent on |
|---|---|---|
| **Materials** (wood, stone, dirt, sand, clay, sticks) | chopping, mining, digging, farm/logger/miner output | building the village — walls, floors, paths, beds, the HQ |
| **Research** (`village.stores.research`) | scholars at the Study | tech unlocks (plow, sawmill, paving, …) and eventually raid/combat upgrades |
| **Cash** (`money`) | killing enemies on runs, tribute from captured cities | **people and territory** — arming villagers, ammo, defector bribes, raid signing bonuses, and keeping captured cities from revolting |

Rule of thumb: **materials = things you physically build. Cash = anything transactional with
a person or a place.**

---

## Phase 0 — where we are (done)

Village zone, villagers with jobs/housing/food/mood, the urge→kidnap loop, combat runs to a
procedurally-generated city, the AI roster generator (`tools/generate.mjs`), live Ollama
villager dialogue, quirks/relationships, research, the weapon-dump, prestige counter,
room/roof flood-fill validation.

---

## Phase 1 — The Cult

> **Status (2026-09-06): Phase 1 COMPLETE & verified.** Cult threshold, HQ validation, and
> the weapon-dump → armoury pivot are all in.

**Trigger:** village reaches **10 villagers** (or a prestige threshold — tune in play). A
one-time beat fires: "…they're looking at you differently now."

**Built:** `checkCult()` flips `village.cult` at `CULT_THRESHOLD` (10) — hooked into
`completeUrge` (kidnap), `debugSpawnNPC`, `villageDayTick`, and `enterZone`. It fires a flash
and calls `registerCultBuild()`, which pushes the **Altar** recipe + build piece (HOME
category, deferred-registration like `registerPaths`). `checkHQ()` re-derives HQ validity from
`village.roofs` (the existing flood-fill) on every build/prop edit and on homecoming: an
enclosed room ≥ `HQ_MIN_TILES` (20) interior tiles containing **1 altar + 3 beds + 1 study**.
First valid → consecration flash + sticky `village.hqDone` (the Phase 3 map gate). A `#hq` HUD
panel lists what's still missing until it's valid. Tunables: `CULT_THRESHOLD`, `HQ_MIN_TILES`,
`HQ_REQ` near the top of the CULT section in `index.html`.

**The pivot — stop dumping weapons.** Pre-cult, returning from a run forces you to fling all
combat weapons onto the junk heap (too paranoid to reuse "sullied" gear). Post-cult that
stops.

**Built:** once `village.cult`, the homecoming hand-off in `enterZone` routes combat loot to
`village.armory` (an id list, cap 120) instead of `village.dump`. A fireside **armoury rack**
(`drawArmory` at `ARMORY_POS`, `_dl` kind 7, mirrors the tool-stash pattern — no prop) shows
the leaned weapons; walk up + E takes a best-kit loadout back (`armoryLoadout`: guns first,
then by damage). `#armStat` in VILLAGE STORES shows the count once cult. First haul fires a
one-time explanatory flash (`village.armorySeen`). The far junk heap stays as pre-cult lore.

**Cult HQ.** A new build validation, reusing the existing enclosed-room flood-fill
(`recomputeRoofs`):
- must enclose a room of at least **N tiles**
- must contain required objects: an **altar** (new build piece), **≥ 3 beds**, a **Study**,
  the **armory** within a few tiles
- when valid, the HQ "consecrates" — unlocks the campaign map (Phase 3) and the brainwashing
  minigame (Phase 6)

**New this phase:** cult trigger + one-time event, armory (repurpose `dump`), `altar` build
piece, HQ validation function, an HQ status panel (valid / what's missing).

**Reuses:** roof/room flood-fill, `village.dump`, build/craft system, `village.prestige`.

---

## Phase 2 — The Militia (villager combat AI)

> **Status (2026-09-06): first cut BUILT & verified on a normal city run.** Follow / engage /
> rout / permadeath / muster all working. Morale is HP-based for now — the devotion gate
> (undevoted won't march; half-devoted flee sooner) wires in from Phase 6.

**Built:**
- **Muster** — `G` in the village (cult only) toggles the squad. Musters the ≤6 nearest
  villagers, arms each from `village.armory` (weapon stored on `v.armed`), and they follow you
  everywhere — including out through the signpost. `G` again stands them down and returns the
  weapons to the rack. `village.squad` = the mustered id list (persisted).
- **`updateSoldier`** (dispatched from `updateEnemy` before the villager branch): no threat →
  hold a loose slot around the player; threat in range (`nearestFoe`, skips civilians/
  villagers) → close and melee, or kite at ~190px with a gun; **rout** below 30% HP (flee to
  the player, rally at >55% near you). `team: 'player'`, `maxhp` 64, patched up on each
  homecoming.
- **2026-09-11 tuning** — squad was too strong (swarmed raids) and got wedged in buildings.
  Base speed 190 → **160** (a march, below the player's 210 walk); the old ×1.2 combat-chase
  and ×1.6 catch-up boosts are gone — catch-up is capped at 205 (250 when really trailing) and
  **never applies while a foe is engaged**, so they close at a jog and enemies get their hits
  in. Pathing: new `squadAvoid` multi-whisker (fans ±0.7…±2.6 rad off the heading, takes the
  first clear ray, else backs out), the follow-slot falls back to the player's own cell when it
  lands in a wall, and a post-move stuck check (real displacement, not velocity) does a
  per-frame corner-crawl at `_stuckT > 0.8` and a sight-line pop to open ground at `> 2.5`.
  Verified: 4/4 soldiers route around a 448×288 building with zero pops.
- **Hostiles retarget** — `enemyTarget` picks the nearest of player / living squad, so enemies
  actually fight the militia instead of ignoring them.
- **`attack()` / bullets** — friendly-fire filtered both ways (player & squad hit only
  hostiles; hostiles hit player & squad).
- **Permadeath** — a soldier at 0 HP is struck from `village.villagers` and `village.squad`
  in `killActor` (no game-over, no bounty). Their issued weapon dies with them.
- **`spawnSquad`** spawns the squad around the player on city entry; survivors re-promote on
  return home.
- **Squad HUD** (`#squad`, green) — name, weapon, live HP bar per member; `#help-muster` hint.

**Still to do:** devotion/brainwashing gate on who can be mustered and how fast they rout
(Phase 6); squad presence currently trips `WANTED` as soon as they swing (fine for now).

**Reuses:** `updateEnemy`, `attack()`, `damage()`, `killActor`, weapon system, the armoury,
`spawnOneVillager`.

---

## Phase 3 — The Map

> **Status (2026-09-06): BUILT & verified.** Country generation, map screen, node-gated
> travel, raid-on-return, capital win. Full "capture" (order meters / tribute) is Phase 5 —
> for now a survived run just flips a node to `raided`.

**Built:**
- `genCountry()` — deterministic from `village.seed`: 9 regional nodes (`REGION_THEMES`,
  tiers 1–4) + a tier-5 **capital**, laid out left→right by tier, each linked to its 2–3
  nearest, plus `border` = the tier-1 nodes that touch the village. Stored on
  `village.country = { name, nodes[], border }`; generated when the HQ first consecrates.
- **Campaign map** — an SVG node graph in the `#map` overlay, opened from a new row on the
  signpost (`buildTravelUI`, shown when `village.hqDone`). Nodes are colour-coded: gold =
  held, glowing white = open (bordering the village or a raided node), dim = out of reach.
  Click an open node → `_raidNode` → `enterZone('city')`.
- `mission` carries `node` / `tier` / `region`; `mission.town` is the node's name. `nextWave`
  budget scales `×(1 + (tier−1)·0.32)`.
- A clean extraction (exit strip or voluntary leave, **not** death) sets `_raidWon`; the next
  homecoming flips `node.raided`, widening the frontier. Capital raided → `village.conquered`
  + a victory flash (sandbox keeps running).

**Deferred to Phase 4/5:** the real raid objective (ruling faction + hold the square) and
captured-city management (order/tribute/governors). `raided` is the seam they'll build on.

**Reuses:** the travel signpost, `enterZone` / mission plumbing, `nextWave`.

---

### Aside — research rate (2026-09-06)

Scholar output was `base·0.6` (~1–2/day) — far too slow. Now `base·1.5` **plus** a
`0.15·villagers.length` community trickle whenever there's at least one scholar, so population
nudges it and a second scholar roughly doubles it. Tunable in `villageDayTick`.

---

## Phase 4 — Raids

> **Status (2026-09-06): BUILT & verified.** Faction spawn, two-phase objective, boss
> yield/capture/execute, retreat, spoils screen, boss→recruit all working. Themed factions
> are hand-authored (`FACTIONS`) — Phase 7 layers AI-gen on top.

**Built** — entering a city from the campaign map (`mission.node` set) is now a raid:
- **`spawnRaidFaction()`** — a themed ruling faction (`FACTIONS[theme]`: name, boss title,
  elite type, palette) at a **town square** deep in from the entry edge: `4 + tier (+1 if
  previously repelled)` elites, capped 9, + one tanky **boss** (`e.boss`, `_name` = the title,
  200 + tier·44 HP). `mission.raid = { fname, square{x,y,r}, phase, holdT, holdNeed, bossOutcome, losses }`.
- **Two phases** (`raidTick`): `fight` → break the whole faction (kill, or boss yields/is
  captured) → `hold` → stand in the square `20 + tier·3` s while stragglers trickle in → `won`.
  During `fight` the ambient street waves are suppressed — the faction *is* the fight.
- **The boss** drops below 24% HP → **yields** (dazed): `E` within range takes them alive,
  another hit executes them. Captured → `village._raidCapture` → on homecoming a pre-armed
  recruit joins with `v.fromBoss = true` + `v.wasBoss` (Phase 6 reads `fromBoss` for
  "resists harder"). Killed → `+600` bounty, no recruit. Escaped (you left them) → nothing.
- **Retreat** — leaving before `won` (exit strip or travel menu) is a repulse, not a capture:
  `node.repelled++` (bumps next attempt's elite count / wave multiplier), no `_raidWon`.
- **Spoils screen** (`#spoils`, `showSpoils`) back home: city fell, faction broken, boss
  outcome, squad losses, recruit's weapon. Phase 7 will add the generated unlocks here.
- HUD: raid objective banner + hold-timer bar + "get into the square" nudge; town-square ring
  in the world (`drawRaidSquare`) and on the minimap; boss / faction / squad colour-coded on
  the minimap; boss name tag + "E take them alive" prompt.
- Squad (Phase 2) fights alongside; a fallen squad member is logged in `losses`.

**Deferred:** civilians still spawn as the normal city crowd (not yet a distinct "cowering
populace"); the AI-generated faction/roster is Phase 7.

**Reuses:** city generation, combat, `killActor`, the exit-strip mechanic, Phase 2's squad,
the daze/`isTarget` capture pattern.

---

## Phase 5 — Empire management (what cash is for)

> **Status (2026-09-06): BUILT & verified.** Order decay + empire drag, tribute, governors,
> revolts, the city panel, and revolt re-raids all working. Cash finally has a job.

**Built** — every held city carries `order` (0–100), `governor`, `revolt`:
- **`countryTick()`** (in `villageDayTick`): each held city's order decays
  `(2.4 + tier·0.9) × drag`, where `drag = 1 + (heldCount−1)·0.12` — every extra city speeds
  the rot. A governor cuts decay to ~38%. Order ≥ 25 → daily **tribute** (food + wood + stone
  + cash, scaled by order·tier); order > 68 has a chance of a **convert** walking in. Order
  hits 0 → **revolt**: `raided → false`, `revolt → true`, tribute stops, governor sent home.
  `reportCountryTick()` flashes the recap.
- **City panel** (`#city`, `openCity` from a held node on the map): order bar + decay/tribute
  readout + **Pay off the residents** ($50 → +22), **Repair the damage** ($28 + 8 wood →
  +16), **Assign / Recall governor** (picks any villager — devotion gate comes with Phase 6;
  a governor is fully seconded: moved into `village.governors`, out of the labour pool, no
  longer spawns at home).
- **Map** now shows held nodes with an order arc + colour (green/amber/red), a `✶` revolt
  marker, and a "N held, tribute ≈ $X/day" subtitle. Held nodes are clickable → the panel.
- **Revolt re-raid** — attacking a revolted city spawns "the uprising" / "the Ringleader":
  ~55% of the elites, a 60%-HP boss, a shorter hold. Winning restores it at order 44 (a fresh
  conquest starts at 60).

**Deferred:** governor selection isn't devotion-gated yet (Phase 6); "send a squad to crush
the uprising" without the player is not a thing — you re-raid it yourself.

**Reuses:** `villageDayTick`, `village.stores` / `money` / `player.res`, `randPerson`,
`spawnRaidFaction`, the campaign map.

---

## Phase 6 — Brainwashing (the sit-down)

> **Status (2026-09-07): v1 shipped; being redesigned before it's a keeper.** The *economy*
> around it stays exactly as built (the `village.conviction` rate-gate, `villagerDevotion` /
> tiers, the muster-refusal / rout-threshold / governor gates, per-villager beliefs as data,
> `fromBoss` recruits resisting harder). The *interaction* — a 1-of-3 ideology-rebuttal quiz
> voiced by Ollama — is replaced with the design below. Ollama drops to optional flavour.

**Why the rework:** the rebuttal picker plays like a quiz, not a manipulation; the feedback is
abstract (belief IDs flipping); and on a box where Ollama times out you only ever meet the
fallback. The fix: make **the target's face the interface**, and make **village life the
ammunition**.

### The dossier — what you know about each villager

You build a file on every villager by **overhearing them**.

- **Ambient capture (always on, pre-cult too).** Villagers already throw bark lines and run
  routines. If you're **within earshot** when one fires it's captured — an "overheard"
  speech-bubble toast slides in, then flips into that villager's dossier card. Walking the
  village naturally fills files; no standing-around grind. Two villagers **talking to each
  other** near you is the richest source — that's where gossip about a *third* person comes
  from.
- **Two tiers of fact:**
  - *Surface* (pre-cult): job, mood, quirk type, loose gossip.
  - *Deep* (post-cult): the wound — the grief, who left them, the thing they don't say.
    Pulled by an **active "listen in"** focus action — hold near them for a beat.
- **Hitting cult status** unlocks the Dossier screen and **back-fills it** with everything you
  passively caught up to that point — a "you've been paying attention this whole time" beat —
  and switches on deep listening. Cult status unlocks *using and deepening* the file, not the
  noticing.

### Facts vs rumours (visible risk)

- **Confirmed fact** — clean index card, firm border, wax-seal / check mark. Character facts
  (the wound, the history) are true and stable.
- **Rumour** — dog-eared torn card, dashed/frayed edge, slightly translucent, in quotes with a
  **"— per Dara"** source line and an *unverified* stamp. In the sit-down the card keeps a
  "hearsay" tell so you always know you're taking a risk, not bluffing by accident.
  - A rumour from someone with a **rival** quirk toward the subject shows as a *bitter source*
    (probably poison).
  - Hear the same thing from a second unrelated villager, or catch the subject half-confirm
    it, and the rumour **upgrades to a fact** — the card re-flips, the seal appears.
  - Playing a **false** rumour in the sit-down doesn't just fail — it counts **extra** toward
    their wariness ("now you're just making things up").

### The face

A procedural pixel **bust**, built from the villager's existing appearance data
(skin / hair / gender / shirt) plus an **expression rig**: brow angle, eyelid, gaze, mouth
shape, jaw tension, tear, flush, pallor — tweened between named states:

> Guarded → Defiant → Rattled → Pleading → Cracking → Weeping → **Serene** (convert-calm)

Only ever instantiated for a conversation. When you sit someone down the world dims, a
vignette irises in, their overworld sprite scales up and the detailed face resolves over it;
pull back out when it's done.

> **Status (2026-09-07): the face itself is BUILT (M2).** `drawFace` + a 9-state rig
> (`FACE_STATES`, `makeFace`/`faceTo`/`faceTick`), previewable via `faceDemo()`, already
> wired into the dossier header portrait. What's left for M3 is the animated *scene* around
> it — push-in, per-exchange expression changes, the card UI.

**The conversation scene is a reusable component.** The same framed close-up is used for the
sit-down AND for the personal-quest / gift conversations (see Additions below). It takes a
**backdrop** chosen from where the villager was standing when talking started:

- **Indoors** (their position is inside a `village.roofs` interior rect) — a dark firelit
  wood-plank wall, warm lamp glow, a shelf silhouette, floorboards. Heavily vignetted.
- **Outdoors** — a dim painterly suggestion of grass and blurred tree silhouettes under a
  low sky, a hint of campfire warmth. Heavily vignetted.

Both are procedurally drawn, cheap, and dark enough that the face stays the focus.

### The sit-down

> **Status (2026-09-07): M3 BUILT & verified.** Full-screen canvas scene above the HUD
> (indoor/outdoor backdrop + push-in animated `drawFace` + tell whispers + leverage / pressure
> / dashed-hearsay cards + resolve meter + patience). Win → all beliefs flip, face lands on
> Serene. Fail → `wary++`, `fails++`, `_willFlee` at 5 (M4 acts on it). False rumour backfires
> (+resolve, −2 patience, card removed). Verified clean. Left for M4: the flee walk-out, the
> quick group sermon.

1. **Push in.** Dim, iris, face resolves — Guarded.
2. **They open** with a resistance tied to one of their core beliefs, delivered
   **deadpan-absurd** ("I can't — it's a Tuesday" / "my mother would never forgive me for the
   curtains"). Your side stays coldly sincere. The joke and the menace run through the same
   moment.
3. **3–5 exchanges.** Your hand = **leverage cards** drawn from their dossier + generic
   **pressure cards** (Comfort, Threaten, Flatter, Isolate, Sow Doubt). Each turn a
   micro-expression flickers toward the wound that's *live this turn* — a beat of grief, eyes
   down. Play the matching card: big resolve drop, the face **cracks**. Mismatch: it barely
   moves and the face **hardens** a notch.
4. **Break** — resolve hits zero, the absurd surface gives way to real tears, they convert
   (devotion set high, face lands on Serene). You found the wound under the joke and pressed
   it.
5. **Or fail** — conviction / patience runs out before they break.

**Ollama's job now:** voice the spoken line from fact + card. Fallback: templated lines per
belief/card pair. Never load-bearing.

### Failing

> **Status (2026-09-07): M4 BUILT & verified.**

- Resolve doesn't break → they **harden**: `d.wary++`, resting face gets colder
  (Guarded → Defiant → Contemptuous), shown as "· LEAVING SOON" on the dossier and "· one foot
  out the door" on the walk-up menu. A sit-down **win clears `_willFlee`** — you got to them
  in time.
- **Five failures → `_willFlee`.** On the next day tick they walk out; a **crush** who isn't
  devoted goes with them; `village.conviction −1` (it shakes your own certainty); their dossier
  file is wiped. `village.defections` climbs, and `spawnRaidFaction` adds up to +3 elites once
  it passes 3 ("they know about your deserters").

### Two modes

- **Private sit-down** — the whole face scene above. Breaks one person deeply. −1 conviction,
  once/day.
- **Group sermon** — **E at the Altar**. No face scene. −1 conviction, once/day (separate limit
  — you can do both). Flips **one belief for every non-devoted villager**; a 3-belief villager
  needs ~2 rallies (or one sit-down) to go fully devoted. Shallow but broad — the sit-down
  stays the fast track for holdouts. `devotionTier` is now belief-count based (any flip =
  wavering, all = devoted).

### Carries over from v1 (unchanged)

`villagerDevotion` / tiers, the muster refusal + rout-threshold + governor (≥ 50% devoted)
gates, per-villager beliefs as the pool the resistances are drawn from, `fromBoss` recruits
resisting harder. **Conviction regen is reworked** — see "Conviction via gratitude" in
Additions; the old +1/rest and +1/city stay but stop being the main source.

**Reuses:** the villager bark / routine / `assignDailyNarrative` system (the capture hook),
quirks & relationships (leverage cards + rumour sourcing), `randPerson`, the walk-up assign
menu, the `#city` / `#map` overlay pattern, the `generateVillageScripts` Ollama box.

**Left for later (Design 4):** free-typed conversation — an Ollama-played villager, Ollama-
judged — as an optional mode for players with a strong local model.

---

## Phase 7 — Post-raid AI generation

> **Status (2026-09-06): BUILT & verified. THE ROADMAP IS COMPLETE.**

**Built** — a won raid yields themed content, generated names flowing straight into the
existing `discover*` pipelines (which classify → validate → compile → persist
deterministically):
- **`generateSpoils(theme, town, tier)`** — an Ollama call (30s timeout, JSON schema
  `{enemy:{name,behavior}, weapons:[name×1-2], decor:name}`) → `spoilsFallback(theme)` on
  failure, from `SPOILS_FALLBACK` (a hand-authored pool per region theme). Fired the instant
  the raid is won (`beginSpoilsGen`) so it runs during the walk home.
- **`applySpoils`** wires the result:
  - enemy → `registerRaidEnemy` (`classifyNPC` look + behavior → `validateActor` →
    `ROSTER.enemies` / `ROSTER_ENEMY`); persisted in `village.raidEnemies`, re-registered on
    load. Roams on future runs via the normal `rollSpawnType` / `MIX_RATIO` pool.
  - weapons → `discoverWeapon` (into `WEAPONS` + weapon codex) + `addWeaponRecipe` (a real
    craftable recipe, `entry.craftable = true` so `loadRaidRoster` re-adds it on load).
  - décor → `discoverMaterial` (a craftable themed wall/floor build piece).
- **Spoils screen** (`renderSpoils`) shows a "sifting the ruins…" line, then fills in the
  three finds when the call resolves. "Onward" carries on immediately — a late result arrives
  as a flash.
- `wipeSave` and `loadRaidRoster` clear/restore the `raid-*` roster entries and `wpn-*`
  recipes.

**Reuses:** the entire AI-content pipeline (`classifyNPC` / `classifyWeapon` /
`classifyMaterial` / `validateActor` / `compileActorSpec` / `discoverWeapon` /
`discoverMaterial`), the `generateVillageScripts` Ollama box, the roster/codex
register-and-persist pattern.

---

## Additions (2026-09-07)

> **Status: BOTH BUILT & verified (M5).**

Two threads that came out of playtesting the Phase 6 rework. They reinforce each other:
**steal an object → give it as a gift → gain conviction AND a shrine to your generosity.**

### Loot display furniture

`village.hoard` already collects the objects you bring home from errand / grocery / object
urges, but there is nowhere to put them — they sit on the ground by the fire.

- New build pieces (same system as beds / the altar — `BUILD_ITEMS` with `prop`, non-solid):
  **side table**, **long table**, **display stand / plinth**, **wall shelf**.
- Walk up to a placed piece with an object in hand (or from the hoard) → set it on top. The
  object renders on the surface at a small scale (reuse the object's existing prop/icon art).
- Each piece holds 1–4 objects depending on size. Purely cosmetic — it's your creepy little
  museum of other people's things.
- A villager's **gift** (below) auto-places on the nearest display piece in *their* corner
  (near their bed), so loyalty is visible around the village.

### Conviction via gratitude

Conviction regen was thin (only +1 per rest with the HQ, +1 per city taken). This makes
**buying loyalty with stuff** the main source — exactly how the leader of this thing operates.

- A villager occasionally **wants a specific possession**, themed to their wound (the
  caretaker wants something to tend; the one afraid of *smallness* wants something grand; the
  *unmourned* one wants a keepsake). Surfaced as a want on their record + a small icon over
  their head.
- You fulfil it — hand over a matching object from your pack or the hoard, or bring one back
  from a run.
- On the handover: a short **face close-up conversation** (the reusable scene — indoor or
  outdoor backdrop per where they're standing) → gratitude → **+1 conviction**, plus a free
  dossier fragment ("they open up to you a little"), plus a small devotion nudge.
- **Rate-limited**: one gratitude-conviction per villager per want; a villager won't want
  another thing for several days.
- The gift becomes *their* object and auto-displays on furniture near their bed.

**Will the AI contribute?** Yes — same deal as everywhere else. Ollama voices the villager's
lines (how they ask for the thing, what they say when you give it), themed to their persona +
wound, with a **hand-authored fallback** that always fires cleanly (and does fire on this box,
where qwen3:14b usually times out). The *want* itself and the *+1 conviction* are
deterministic — the AI only colours the words, never load-bearing.

**Build order:** the reusable conversation scene lands in **M3** (the sit-down needs it).
Display furniture is self-contained and can slot in any time. Gratitude/wants land in **M4**
alongside the fail/flee work, since they share the conviction economy.

---

## Where this leaves the game

All 8 build-order steps are in and browser-verified. The full loop runs end to end:

**kidnap villagers → cult at 10 → build & consecrate the HQ → the campaign map opens →
brainwash villagers at the altar → muster & arm a squad from the fireside armoury → raid a
city (break the ruling faction, hold the town square, spare or execute the boss) → the fallen
city yields a themed enemy + craftable weapons + décor → govern it with cash and a devoted
villager for daily tribute → push the frontier city by city → take the capital.**

Remaining polish / stretch ideas, none blocking: civilians as a distinct "cowering populace"
during raids; "send a squad" to crush a revolt without the player; player-chosen ideology
tenets; balance passes on tier scaling, conviction regen, and tribute vs. order-upkeep economics.

---

## M6 — combat diversity (in progress)

Playtest note: "always the same bunch of villains in each city using the same weapons."
Goal — *much* more variety and unpredictability. Tone ≈ **80% gonzo** (Streets of Rogue +
Worms: wacky weapons with strange side effects). Once fully seeded, the procedural generator
can **replace the AI-generated roster**; `tools/generate.mjs` stays as an optional offline
seed step.

- **M6a — enemy traits. DONE & verified.** `ENEMY_TRAITS` (12 stackable modifiers:
  armored/swift/glass/volatile/teeming/knitting/frenzied/draining/rooted/shielded/twitchy/
  whistling), rolled 0–2 per city spawn scaled by tier/wave (~45% at tier 1), with a readable
  feet-aura + short tag over the head. Hooks: `tick` / `onHurt` / `onDeal` / `onDie`. Also
  applied to raid-faction elites.
- **M6b — the arsenal. DONE & verified.** Hazard system (`HAZ`: fire / gas / glue / oil /
  web / peel / singularity — each ticks dps or a status on anyone standing in it, fades, and
  can `end()` with a payload). Status primitives on every actor: `rootT`, `encT` (bubble),
  `slipT`, `slowT`, `_marked`, `_noDashT` — wired through `moveActor` / `updatePlayer` /
  `updateEnemy` / `attack` / `damage`. 17 new weapons via `Object.assign(WEAPONS, …)`:
  melee sledge/spear/whip(pull)/springfist(launch)/katana/prod(long stun)/trout(slip);
  guns shotgun/nailgun(pin-to-wall)/bubblegun(encase)/flaregun(mark+fire)/gluegun(glue pool);
  thrown molotov/gasgren/bolas(root)/sheeplauncher(walk-then-boom)/singularity. Grenades get
  real arc physics (`throwGrenade` → `updateGrenades` → `wp.land()`), player thrown-weapons
  carry an `_ammo` pool topped off on pickup. Built-in enemy weapon pools (thug/bruiser/
  gunner) widened to draw from the new melee/gun/thrown sets.
- **M6c — behaviour archetypes. DONE & verified.** `COMBAT_AI` table of 8 fight patterns —
  **rusher** (straight in), **skirmisher** (dart in / hit / bounce out), **flanker** (orbit to
  their back before committing, re-flank after each blow), **lobber** (hold mid-range, arc
  thrown weapons — AI throws now range-scale to the target), **shielder** (slow planted
  advance, always facing you, `_braced` cuts knockback ×0.38, draws a guard arc), **support**
  (hangs back, rallies + patches nearby allies, avoids you — the natural home for the
  `caller` trait), **ambusher** (lurks dead still with its aura hidden until you're ~130px,
  then pounces), plus **shooter** (the old ranged kite). `pickCombat(e)` assigns one per
  spawn, weapon-driven; the single `updateEnemy` melee/ranged block now just dispatches
  through it. Crowd separation lightened + capped for chargers so they can wedge into a mob.
- **M6d — faction generator. DONE & verified.** `FACTION_THEME` (per-region seed: palette,
  boss-title pool, elite type, grunt weapon pool + signature, trait bias, combat-archetype
  weights) + `FACTION_ADJ`/`FACTION_NOUN` name parts + `FACTION_GIMMICKS` (8 signatures —
  zealots / turtles / firebugs / pack / sappers / press-gang / sharps / bulwark, each an
  `elite`(+`boss`) hook that tweaks stats **and** forces a matching `_combat`).
  `genFaction(theme, tier, seed)` composes a kit (seeded LCG, one grunt dropped so cities of a
  theme still differ); stored as pure data on each country node in `genCountry` (+ lazy
  `factionForNode` / a load-time backfill for old saves). `spawnRaidFaction` now pulls the
  name/boss/weapons/traits(`applyTraits(e,n,biasIds)` ×4 weight)/combat(`pickCombat(e,weights)`)
  /gimmick from the kit; `nextWave` leans role odds by the faction's elite type;
  `spawnEnemy` gives ~45% of street enemies a faction grunt weapon + the faction trait/combat
  bias — the whole city reads as one org. Map + city panel show the faction name. Verified:
  all 10 nodes generate clean, live raid = 1 boss + 5 elites with themed arms/tactics, 0 errors.
- **M6e — de-AI pass. DONE & verified.** `AI_OLLAMA = ''` (was the localhost URL) — the game
  no longer calls a runtime model for anything. `generateSpoils` is now `genSpoils` (sync,
  procedural): a role pool (`SPOILS_ROLE`) + expanded per-theme weapon/décor pools
  (`SPOILS_FALLBACK`, ×3–5) + the ruling faction's name → one roaming enemy + 1–2 craftable
  weapons + a décor material, straight into the `discover*` pipelines as before (no 30 s fetch
  wait on the spoils screen). `generateVillageScripts` / `generateSermon` keep their `fetch`
  code but are gated behind `AI_OLLAMA` (flip it back to `'http://127.0.0.1:11434'` to
  re-enable the optional dialogue flavour); both already have full canned coverage.
  `tools/generate.mjs` stays as the optional offline roster-seed step.

---

## Later — end-game & meta progression

- **Capital win screen / credits. DONE & verified.** `#winscreen` — a distinct purple/gold
  modal (own palette from the amber spoils screen) chained in right after the capital raid's
  own spoils recap is dismissed (`Onward`/Escape both chain it; `village._winSeen` gates it to
  once). One of 6 flavour lines + a stats recap built entirely from existing village state (no
  new counters): days as a cult, souls in the fold, true believers (devotion ≥0.8), ex-bosses
  converted, cities under your banner, weapons/materials discovered, deserters along the way.
  `Continue` unpauses back into the sandbox — no reset, matches the design ("sandbox keeps
  running"). Added `winOpen` to the pause-watchdog and the Escape-key chain so it can't leave
  the game silently paused or get skipped. Verified: stats compute correctly, chains from the
  spoils screen, Escape-dismiss works, player moves freely after, 0 console errors.
- **Player modifiers as roguelite unlocks. DONE & verified.** `PLAYER_TRAITS` — 14 perks
  (Vampire, Ninja, Zombie, Berserker, Juggernaut, Glass Cannon, Pyromaniac, Lucky, Scavenger,
  Executioner, Cult Leader's Voice, Thick Skinned, Adrenaline, Second Wind), same hook shape as
  M6a's `ENEMY_TRAITS` (`onHurt`/`onDeal`/`tick`) plus two new ones added generically to
  `damage()`/`killActor()`: `onKill` (fires on the killer, not just `onDie` on the victim) and
  `cheatDeath` (intercepted right before `killActor` — Second Wind). `onDeal`'s return value is
  now consumed as a damage multiplier exactly like `onHurt`'s already was (backward-compatible —
  existing enemy traits don't return a number, so their behaviour is unchanged), which is what
  lets Ninja/Berserker/Glass Cannon/Executioner/Pyromaniac scale damage dynamically per hit.
  **Currency:** Legacy Points, earned from a city falling (`2+tier`), a revolt put down (`1`), or
  the capital falling (`15+tier`) — banked in their own save slot (`ror_legacy`) that `wipeSave`
  never touches, so unlocked perks and points **survive a New Game** (verified: wiped
  `ror_village`/`ror_player`, `ror_legacy` untouched). Traits are unlocked permanently with
  points, then equipped/unequipped freely into 2 (+2 buyable) slots via a new `L` panel — home
  only, no mid-raid respec. `applyPlayerPerks()` recomputes the equipped set any time it
  changes; HP-affecting perks (Juggernaut +40, Zombie +20, Glass Cannon −25) are tracked as a
  delta (`_traitHpBonus`) so re-equipping never compounds — verified idempotent across repeated
  re-application. Speed/attack-rate perks (Zombie/Ninja/Juggernaut `speedMul`, Adrenaline
  `rateMul`) are read live at point of use (`updatePlayer`'s move speed, `attack()`'s cooldown),
  never baked into a base stat. All 14 perks individually verified against exact expected
  numbers (dodge/drop rates checked statistically over 200–500 trials); 0 new console errors.
- **Perk active abilities. DONE & verified.** User: "the vampire should be able to turn into a
  bat and fly over buildings... the ninja should be able to turn invisible... the zombie can
  turn others into zombies." 13 of the 14 perks (all but Second Wind, whose identity is the
  passive safety net) got a signature `active:{cd, use(p)}` on top of their passive — **Q fires
  the first equipped perk with one, F the second** (equip order = binding order; a perk past
  slot 2 still contributes its passive, just no keypress). `usePlayerActive(slotIdx)` tracks
  per-perk cooldowns in `player._activeCD`, decremented in `updatePlayer`; on cooldown it flashes
  the remaining seconds instead of silently doing nothing.
  - **Vampire — Wing Out**: 2.2s as mist, flies straight through walls/props (new `a.noclip` flag
    checked at the top of the shared `moveActor`, bypassing collision entirely) at a fixed
    380px/s. Lands safely — nudges out of any wall it ended up inside via the existing
    `solidBoxHit`-retry idiom used elsewhere for spawn placement.
  - **Ninja — Vanish**: 4s invisible to anything past 70px. No sprite change (avoiding a real
    alpha-compositing rabbit hole through `drawActor`'s many internal `globalAlpha` resets) —
    instead reuses the enemy-trait aura ring `drawActor` already draws, via `_traitAura` set
    directly on the player. `updateEnemy`'s engage gate (`invisGate`) blocks *new* aggro past
    70px and gives already-`mad` enemies a `dt*0.5`/s chance to give up and go back to
    wandering; point-blank still gets you spotted (no cheese).
  - **Zombie — Outbreak**: up to 2 nearby non-boss/civ/villager enemies flip to
    `soldier:true, team:'player', _thrall:true` (green re-tint) — full reuse of the just-tuned
    soldier AI/pathing for free. `killActor` gained a `t.soldier && t._thrall` branch *before*
    the real-follower one so a dead thrall is just a corpse, not a village-roster mutation (and
    — the bug this specifically guards against — never falls through to the final `else` that
    means *player* death).
  - **Berserker — Bloodlust** (5s +60% dmg/+25% spd), **Juggernaut — Bulwark** (3s ~90% dmg+
    knockback resist, generalised the knockback-resist math in `damage()` into a per-trait
    `knockR` so Thick Skinned's constant 50% and Bulwark's temporary 92% share one code path),
    **Glass Cannon — Overcharge** (3s +150% dealt/+60% taken), **Pyromaniac — Immolate** (a fire
    ring via the existing `addHazard` — zero new mechanics), **Lucky — Coin Flip** (50/50 full
    heal or −22% maxhp, floored at 1hp so it can never itself kill you), **Scavenger — Scrounge**
    (pulls every pickup within 260px via the existing `collectPickup`), **Executioner — Execute**
    (near-lethal `damage()` call on the weakest nearby non-boss foe — real hooks fire, nothing
    duplicated), **Cult Leader's Voice — Rally Cry** (a bigger, on-demand version of its own
    passive), **Thick Skinned — Taunt** (new `e._tauntT`, checked first in `enemyTarget()`, forces
    nearby enemies onto the player regardless of distance — a real taunt, not just re-aggro),
    **Adrenaline — Overdrive** (3s attacks in 0.4× the time).
  - Verified individually with exact numbers: Wing Out crosses a solid cell then lands outside
    every wall; Vanish blocks aggro >70px / allows it <70px (confirmed with a tight same-call
    tick loop — spacing `tick()` calls across separate tool round-trips inflates `dt` and is
    *not* a valid way to test frame-scale timing here); Outbreak's convert is
    `soldier/team/_thrall` all correct with no `village.villagers` mutation; Bloodlust/Overcharge
    damage multiplied exactly (16 and 25/80); Bulwark's damage (10 vs 100 raw) and knockback
    (16 vs 200 raw, i.e. exactly ×0.08) matched the 0.1/0.92 formulas; Coin Flip ~50/50 over 100
    trials; Rally Cry healed a soldier by exactly 35% of max; Taunt forced `enemyTarget()` onto
    the player and applied the 50% shield; Overdrive's `atkCd` was exactly ×0.4. 0 console
    errors across a 600-tick mixed-enemy stress fight plus natural death/recovery back home.
- **Three more perks (17 total). DONE & verified.** User asked for these by name/mechanic
  rather than picking from the brainstorm list:
  - **Time Bender** — dash recharges 30% faster (new `player.dashMul`, wired into the Space-dash
    cooldown). ACTIVE **Time Stop**: every `team:'enemy'` actor gets `_frozenT = 4` — checked
    right after the dead/soldier dispatch in `updateEnemy`, a frozen actor skips its AI and
    movement entirely (a frosty particle sparkle is the only tell) while the player and squad
    move and fight completely freely. Verified: two enemies given 200 ticks while frozen moved
    0px total; `_frozenT` counts down and clears velocity cleanly on expiry.
  - **Necromancer** — passive: a killing blow has a 25% chance to raise the victim as a
    temporary skeleton (`raiseSkeleton()`). ACTIVE **Raise Dead**: summons 3 at once for 10s.
    Skeletons reuse the Zombie thrall machinery wholesale (`soldier:true,team:'player',
    _thrall:true` → the tuned soldier AI fights for free) but add a NEW `_thrallT` lifespan,
    decremented in `updateSoldier`, that quietly marks them dead when it runs out — no bounty,
    no `killActor` roster fuss, just a corpse puff. Verified: 3 summoned with the right stats/
    colour, and a forced-expiry killed one cleanly with 0 errors and no village-roster changes.
  - **Plague Doctor** — passive: 15% chance per hit to infect the target. ACTIVE **Outbreak
    Vial**: infects everything within 150px at once. An infected enemy (`_plagueT>0`, handled in
    its own branch in `updateEnemy`, checked after the freeze/dazed branches) takes ~3.5% max hp
    every 0.5s, turns "berserk" — picks the single nearest actor of ANY team (player, squad, or
    other enemies) and attacks it — and spreads to any uninfected, non-boss, non-civ/villager
    enemy within 26px, propagating the same `_plagueFrom` attribution down the whole chain so
    kills still credit the player. Bosses are immune (mirrors Executioner's same guardrail).
    Verified: stays inert at 200px, catches everything once in the 150px active radius, ticks
    real DoT damage, and — isolated from the AoE — a single infected enemy visibly spread to an
    uninfected one standing 20px away purely through the berserk contact rule, 0 errors either
    way. **Zombie's Outbreak tuned to match the contrast the user drew against Plague Doctor**:
    thralls now also move at ×0.7 speed (a proper green shamble) and it's now explicit in the
    code comment that they carry no DoT/decay — they're a stable ally until actually killed,
    unlike Plague Doctor's wasting-away infected.
- **The rest of the brainstormed roster (28 perks total). DONE & verified.** Only two new
  engine touch-points needed for all 11 — everything else is `onHurt`/`onDeal`/`onKill`/`tick`
  plus `damage()`/`collectPickup()`/`lineBlocked()`/the thrall-soldier machinery, same as before:
  a `player.knockMul` consumed at the melee hit in `attack()` (Ogre deals extra knockback), and
  `player.knockMul`/`dashMul` folded into `applyPlayerPerks()` alongside the existing `speedMul`/
  `rateMul`. A `_fearT` branch in `updateEnemy` (next to the freeze/plague ones) makes a spooked
  enemy flee instead of fight — Hypnotist's passive proc.
  - **Ghost** — 40% less damage while moving fast (`Math.hypot(vx,vy)>150`). ACTIVE **Haunt**:
    an instant 220px phase-dash along your facing that damages every enemy it passes through
    (a 16-step sweep, not a multi-frame dash — multi-frame was tried first and dropped: the
    normal WASD-input velocity blend in `updatePlayer` runs *after* the trait tick hook and
    would fight/overwrite any velocity a tick sets, so anything that needs to travel a fixed
    path this turn does it as one instant sweep instead of over several frames).
  - **Ogre** — +30 max HP, deals 80% more knockback, resists 40% of incoming knockback (folded
    into the existing per-trait `knockR` max in `damage()`). ACTIVE **Ground Pound**: a radial
    shockwave, knockback falling off with distance, staggers anyone caught in it.
  - **Storm Caller** — a kill has a 35% chance to zap the nearest other enemy. ACTIVE **Chain
    Lightning**: walks nearest-neighbour through up to 5 enemies, hitting each.
  - **Puppeteer** — taking a hit has a 40% chance to rally nearby soldiers. ACTIVE **Strings
    Attached**: teleports your whole squad to your side, wherever they were.
  - **Hypnotist** — 12% chance on hit to send a non-boss enemy fleeing (new `_fearT`). ACTIVE
    **Mesmerize**: charms the nearest non-boss enemy into a timed thrall (reuses `_thrallT`,
    same expiry machinery as Necromancer's skeletons) — unlike Zombie/Necromancer this works on
    tougher single targets (gunners, bruisers), not a small mob at once.
  - **Cannibal** — standing near a corpse <8s old slowly heals you. ACTIVE **Feast**: consumes
    the nearest corpse (fades it out via `corpseT=999`, the same field that already drives
    corpse fade-alpha) for a big heal + a temporary +30% damage buff.
  - **Gambler** — a kill has a 30% chance to pay a small cash bonus directly. ACTIVE **Jackpot**:
    burns 25% of max HP for a guaranteed, larger cash payout — a resource *lever*, distinct from
    Lucky's symmetric 50/50 coin flip.
  - **Hoarder** — the fuller your backpack, the less damage you take (up to 50% at ~17 items).
    ACTIVE **Fortify Nest**: a temporary extra shield scaled by the SAME pack-size stat, so the
    passive and active reinforce rather than compete (an earlier draft had the active *empty*
    the pack for the buff — dropped as needlessly punishing; carrying a lot is the reward, not
    a resource you spend).
  - **Brawler** — consecutive hits on the *same* target (tracked by object reference) stack up
    to +40% damage; switching targets resets the combo. ACTIVE **One-Two Punch**: a short-range
    frontal arc that always staggers, no windup.
  - **Marksman** — damage scales with the distance between you and the target when it lands
    (works for melee too, it just rarely triggers), up to +60% at 500px+. ACTIVE **Called
    Shot**: an instant narrow-beam piercing shot down your facing line — and, as a nice emergent
    side effect, its own flat damage is ALSO scaled by the passive, so a called shot on a
    far target hits harder than one up close, reinforcing the character's whole identity.
  - **Mole** — a hit over 18 damage has a 25% chance to "duck under" for 70% reduction + a
    flash of invuln. ACTIVE **Tunnel**: an instant 180px blink (walks back from the target point
    in 20px steps until it finds open ground, so it never strands you in a wall).
  - Every one of the 11 verified with exact numbers in a clean, isolated call (not spaced across
    separate tool round-trips, which reintroduces the dt-inflation problem noted above): Ghost's
    40%, Ogre's knockback ×1.8 dealt / ×0.6 taken exactly, Storm Caller's chain hit 4/4 nearby
    enemies for exactly 26 each, Puppeteer's rally + teleport, Hypnotist's flee behaviour (40px
    → 433px over 120 ticks) and Mesmerize's thrall conversion, Cannibal's heal + 1.3× buff,
    Gambler's exact HP-for-cash formula, Hoarder's 0.85×0.5 stacked reduction, Brawler's stepped
    +0.08 combo multipliers, Marksman's 1.1×/1.6× distance scaling (and its called shot
    demonstrably compounding with its own passive), Mole's dodge-and-blink. Two full 900-tick
    mixed-enemy stress fights (one per half of the new roster, cycling actives on Q/F, including
    a live re-equip mid-fight to stress `applyPlayerPerks()`) — 0 console errors, player
    survived both. **Roster is now 28 perks**, 27 with a signature active.
- **Explosion / fire / slime graphics, and spreadable fire. DONE & verified.**
  - **New `fx` array** — a tiny, purely-cosmetic overlay system (`updateFx`/`drawFx`, wired
    into the main loop next to hazards) for one-off animated shapes that don't belong in
    `parts` (single-pixel sprites) or `hazards` (persistent, gameplay-affecting areas). Today
    it only knows `{t:'shock', ...}` — an expanding, fading ring — but it's a reusable slot for
    any future "big moment" effect.
  - **`explode()` rewritten**: a white-hot flash light + a second wider dim one, two `fx`
    shockwave rings (one bright, one tight-white), a layered burst (white-hot core → mid
    fireball → outer flame → ember flecks, instead of one flat two-colour spray), 14 slow-rising
    smoke particles that actually linger (1.1–1.9s life vs. a normal burst's ~0.3s), and a
    two-layer scorch decal (was one flat blob). Verified by clean-camera pixel sampling right
    after a single `tick()` — 1794/19600 sampled pixels in the fireball's own orange range.
  - **Fire hazard rendering**: was a flat ellipse + 4 rotating rectangles; now a warm radial
    ground-glow, a char patch, and a handful of real flame-lets scattered across the footprint
    using the SAME `torchFlame()` tongue-shape helper the standing-torch/campfire already use
    (different world positions feed its phase math, so each little flame flickers on its own).
  - **Gas/glue ("slime") rendering**: new shared `drawGoo(h, baseCol, highCol, bubbleCol)` —
    a golden-angle cluster of overlapping glossy blobs instead of one flat ellipse, a rim-light
    highlight streak, and two slow rising-then-popping bubbles. Glue reads amber/sticky, gas
    reads green/vaporous, using the same helper with different colours (one more "few engines,
    many templates" case). `weaponFx`'s slime/fire/acid impact splashes got a matching, layered
    upgrade (still one-shot particles, just richer).
  - **Spreadable fire** (city-only — a stray molotov can never accidentally torch the player's
    own village): every fire hazard rolls a spread check every 1.1–1.9s (40% chance, capped at
    26 simultaneous fire hazards). It first looks for the nearest unburned flammable prop
    (`tree`/`stump`/`dump`, i.e. anything destructible and not already on fire) within 70px; if
    it finds one, that prop is marked `_burning`, gets its own fire hazard (`burnProp: prop`
    on the hazard, so `updateHazards` periodically calls `hurtProp` on it — real, sustained fire
    damage, ~6 per 0.6s, using a neutral `{team:'fire'}` `from` so it bypasses the melee
    tool-requirement gate that would otherwise demand an axe). With nothing to ignite, it
    instead creeps a new short-lived ember onto nearby open ground, so fire genuinely spreads
    across a battlefield even in a treeless city. Ambient smoke now drifts off any burning fire
    even with nobody standing in it (previously only spawned when an actor was inside it).
  - **A real debugging lesson, worth keeping**: the first attempt to verify prop-ignition used a
    hand-built fake prop object missing the standard `vx`/`vy`/`fixed` fields every real prop
    gets from `mkProp()`. The engine's own per-frame prop-momentum integration
    (`p.x += p.vx*dt`) silently corrupted its position to `NaN` on the very first tick because
    `undefined*dt` is `NaN` — which looked exactly like "the ignition search never finds the
    target" until traced with a property-setter trap. Any future synthetic prop for testing
    needs `vx:0, vy:0, fixed:<bool>` at minimum, not just the fields the test cares about.
  - Verified: fire ground-glow/flame colours and gas/glue tint colours confirmed by direct pixel
    sampling (camera pinned exactly on the target so screen-coordinate math can't drift); the
    fade-in ramp already built into hazard alpha (`clamp(h.t*2,0.15,1)`) means a hazard needs
    ~0.4s of sim time before its true colour is sampleable — sampling too early reads as
    near-blank and is not a rendering bug. A synthetic tree prop (correctly shaped this time)
    was ignited by a nearby fire at tick 167, took sustained damage, and was fully destroyed by
    tick ~267 — the complete "burn it down" loop. A combined 1000-tick stress test (one
    explosion, three hazard kinds, 10 mixed enemies, 5 scattered trees) produced 0 console
    errors and at least one tree burned to death via pure fire-spread with no player
    involvement. Not yet covered (disclosed scope boundary, not attempted): igniting flammable
    WALL materials (plank/stick) — that would mean touching the MAT-cell grid rather than the
    `props` array, a bigger follow-up if wanted.
- **Mutator visual transforms. DONE & verified.** User: "change the players appearance when
  these effects take place... become a bat when using the vampire's flying ability, or turn
  transparent with the ninja ability, green and with bits of blood on them when a zombie and
  stuff like that depending on the ability." Three small hooks into the existing single
  `drawActor()` (which draws the player and every enemy/villager alike):
  - **`mutatorLook(a)`** — for the player only, overrides the `shirt`/`skin` consts `drawActor`
    already computes at its top, checked against equipped `player._traits` ids and active-timer
    flags that already existed from the perk actives (`_bloodlustT`, `_overchargeT`, `_bulwarkT`,
    `_shieldT`): **Zombie** (equipped) → swampy green skin/shirt (reusing the exact colours its
    own Outbreak active already paints onto converted thralls) + a `blood:true` flag; also sets
    `player.torsoW/torsoH` (an existing per-actor build-variance field `drawActor` already reads,
    built for NPC look diversity) to a bulkier 1.35×/1.22× for **Ogre**, no new sizing code
    needed. **Necromancer** (pale/dark robe), **Plague Doctor** (sickly yellow-green), and a skin
    tint for whichever of Berserker/Glass Cannon/Juggernaut/Thick Skinned currently has its timed
    active running (reddish/electric-blue/steel-grey), all "and stuff like that" extensions
    beyond the three named examples, done at my discretion.
  - **Zombie blood spatter** — five small dark-red rects drawn in the same local translated space
    `drawActor` is already in right before its own closing `octx.restore()` (confirmed by reading
    the surrounding code: everything after that restore switches to absolute world coordinates
    for the dazed-stars/soldier-healthbar tail, proving the restore is the outer local block's
    close), gated on `look.blood`.
  - **`drawBatForm(a)`** — Vampire's Wing Out (`player._batformT>0`) short-circuits `drawActor`
    at its very top into a wholly separate draw routine: a small dark silhouette with two
    triangular flapping wings (phase-animated off `performance.now()`), pointed ears, and glowing
    red eyes, replacing the humanoid sprite entirely for the flight's duration — no new state,
    reuses the noclip flag Wing Out already sets.
  - **True per-pixel transparency** for Ninja's Vanish and a new Ghost passive — the one part
    that couldn't reuse `drawActor` as-is, since its internals reset `octx.globalAlpha` back to 1
    in several isolated sub-blocks, so a single outer alpha wrapper around the whole call
    silently doesn't work, and `octx` itself is a `const` (no swapping in a scratch canvas
    without a bigger refactor). Solved with `drawActorTranslucent(a, alpha, camx, camy)`:
    `getImageData` the actor's screen-space bounding box, let `drawActor` draw normally (opaque),
    `getImageData` again, linearly blend `after = before + (after-before)*alpha` per channel, and
    `putImageData` the result back — works because canvas pixel I/O ignores the transform matrix
    and this game's `VS` (world-unit-to-device-pixel scale) is exactly 1, so `devicePx = worldPx
    - cam`. `playerVisualAlpha(a)` picks the alpha (0.22 for Vanish, 0.55 for Ghost equipped, 1
    otherwise) and the main y-sorted draw dispatch (`draw()`'s `_dl` loop) routes through the
    translucent path only when it's <1, so every other actor's draw call is untouched.
  - Verified live: equipped Zombie sampled as green RGB with dark-red blood pixels present in the
    sprite's bounding box; Wing Out screenshot shows a clean bat silhouette in place of the
    player; Vanish screenshot shows the player blended almost invisibly into the grass; Ghost
    shows a distinctly lighter ~55% fade, visually different from Vanish's near-full transparency;
    Ogre's torso reads visibly wider/taller. 0 console errors throughout. Legacy save
    (`ror_legacy`) restored to its pre-test `equipped:[]` state afterward — `unlocked`/`points`
    were untouched (every perk was already unlocked from earlier dev testing).
- **City street-folk jobs + gang patrols. DONE & verified.** User: "we need to start managing
  the behaviours of the people in the city similar to how they're managed in the village. Not to
  the same depth, but we need the city folk to have jobs and patrol routes etc — instead of
  everyone either attacking or running." Deliberately much shallower than the village's
  `JOB_META`/dossier system — no persistent records, no daily routine, just a distinct loiter
  pattern + bark pool per job, layered on the existing `civ` actor:
  - **`CIV_JOBS`** — 5 archetypes rolled per street civilian (`rollCivJob()`, weighted): plain
    **pedestrian** (the old behavior, still the plurality), **shopkeeper**/**worker** (anchored
    to their spawn spot, a tight loiter loop + a little idle-work particle puff, reusing the
    villager work-beat idiom), **jogger** (a longer steady loop at 1.5× speed), **dogwalker** (a
    small companion `_dog` on a leash that trails the owner with simple spring-follow, drawn by a
    new `drawDog()` called from `drawActor`'s world-space tail). Building occupants aren't a
    random roll — `addOccupants` now tags diner/bar/shop interiors as `shopkeeper` and apartment
    interiors as `worker` via a new `job` field threaded through `pendingCiv`/`drainPending`
    into `makeActor`'s new optional `forceCivJob` param, so the person standing in a shop is
    actually its shopkeeper. Every job still drops whatever it's doing and flees if the player
    gets within 150px, same as before — the jobs only change the *calm* behavior.
  - **Territorial shopkeepers** — `alertShopkeepers(x,y)` scans for a shopkeeper/worker within
    90px of the damage point and fires `markWanted(true)` (a bark + real heat, on a 6s cooldown
    per shopkeeper) the moment the player breaks a nearby prop (`hurtProp`) or wall/window
    (`attack()`'s cell-damage branch) — messing with someone's storefront calls the cops even if
    you never touch the shopkeeper directly. Hitting them directly still uses the existing
    generic `civ`→`thug` conversion (unchanged).
  - **Gang patrols** — `assignPatrol(e, shared)` gives a street thug/bruiser/gunner 2-3 waypoints
    around their spawn and a wait-then-advance loop, swapped in for the old pure-jitter wander in
    `updateEnemy`'s calm branch (`e._patrol` present) — reads as walking a beat instead of
    twitching in place. `spawnEnemy` gained an optional `atPos` param; an ambient street thug now
    has a ~40% chance to bring 1-2 companions along at the same spot sharing its patrol loop
    (`spawnEnemy('thug', {x,y,patrol})`), so blocks get actual loitering/patrolling gangs instead
    of lone wolves. None of this touches the existing aggro/sight/engage logic — a patrolling
    gang still spots and attacks the player exactly like before (and gives up the same way
    against Ninja's Vanish); patrol resumes from wherever they left off once they lose interest.
  - User's own follow-up, addressed by design rather than new code: at high wanted the calm
    per-job behaviors naturally get overridden by pre-existing systems (direct-hit civs already
    convert to fighters, damage() already spreads `mad=true` to everyone within 240px, cops
    already stream in while `wanted>0`) — so a hot chase already reads as a warzone without
    needing a separate escalation tier, while a clean approach still lets you thread a shop
    without waking the block.
  - Verified live via `window.__G()._fn` (`enterZone('city')`, `spawnEnemy`, `makeActor`,
    `tick`): all 5 `civJob`s roll and move without NaN corruption over a 600-tick mixed stress
    test (10 thugs/gangs + 8 civs, one of each job, 50 actors total, 0 console errors); gang
    clustering measured at ~30% of solo `spawnEnemy('thug')` calls producing >1 enemy (target
    ~40%, consistent within sampling noise); a forced shopkeeper's territory alert fired
    `markWanted` and set its 6s cooldown on the first nearby prop hit, exactly as coded; the
    dogwalker's `_dog` companion pixel-sampled at its computed screen position as the expected
    brown dog-body color, confirming it actually renders where the leash math places it.
- **Sight-based hunting in the city. DONE & verified.** User: "once I get even the smallest
  wanted level then everyone forgets their roles/jobs and just hides... it's very hard to hide
  from pursuers because they can sense me wherever I am... have the 'attackers' patrolling the
  city too until I'm seen, otherwise I'm hunted the entire time." Root-caused to three real gaps,
  not one:
  - **No memory** — once any enemy's `mad` flag went true, nothing ever cleared it (except a
    Ninja-Vanish-specific random chance). `updateEnemy` now tracks `e._loseSightT`: while `mad`,
    it resets to 0 whenever `canSee && pd < aggro*1.2`, else accumulates; past 5s (and pd>140, so
    it can't happen mid-melee) the enemy gives up — `mad=false`, and a cop's `calm` is restored
    too so it genuinely resumes its patrol/beat rather than a generic wander. (First version of
    this had a bug — the "just engaged" branch unconditionally re-zeroed the same timer every
    frame `mad` was true, which is always true right up until the moment it would've tripped, so
    it could never actually accumulate; caught and fixed via a pinned-position/zero-speed
    isolation test that could tick the sim forward without the chase itself closing the distance.)
  - **Detection range too large** — thug/bruiser/gunner/cop `aggro` (640/700/1000/900) was bigger
    than a screen's radius, so `canSee`'s line-of-sight gate rarely mattered — you were "seen"
    from off-screen. Cut to 300/320/420/360 (gunners/cops still see furthest, in character); a
    civ angered into a thug now runs at 420, not 900.
  - **Crowd aggro swept in bystanders** — hurting anyone within 240px pulled EVERY nearby actor
    into the fight, `civ`s included, which read as "the whole street panics the instant anything
    happens." Now excludes `civ`s outright and requires an unobstructed `!lineBlocked` sightline,
    so only armed enemies who could plausibly have seen it join in — a civilian just flees if it
    gets close, per their own existing distance check, exactly as before. `markWanted`'s cop-wake
    radius was cut the same way (700px, no sight check → 340px + `!lineBlocked`) — cops respond
    to what they can plausibly see/hear, not a citywide instant page.
  - Explicitly NOT solved by new code, by design: escalating chaos at high wanted still happens
    entirely through the systems above compounding (direct hits still convert civs, cops keep
    streaming in while `wanted>0`) — there's no separate "warzone tier," so a clean approach still
    lets you work a block unnoticed and a loud one still snowballs into a real manhunt.
  - Verified via a pinned-position isolation harness (`window.__G()._fn`, thug/cop pushed 1000px
    away with `speed=0` and the player's own position/velocity reset every tick so only the AI's
    own sight-memory math is exercised): `_loseSightT` climbs linearly with `dt` and both a thug's
    `mad` and a cop's `mad`+`calm` flip back to their idle state at exactly the 5s mark, reliably
    across repeated runs. Crowd-aggro re-tested with a hurt thug + an adjacent civ + a third armed
    thug 20px further out: the civ never went `mad`, the other thug did. 0 console errors.
- **Build carousel: WALL/FLOOR/WIN tags + discovered-material recipe buff. DONE & verified.**
  Two related complaints in one pass:
  - User: "it's too hard to tell what is a floor tile and what is a wall tile." A discovered
    (codex) material's build icon is just its raw texture swatch, and its name alone doesn't say
    which layer it belongs to — a wall and a floor piece of the same material can look and read
    identically in the carousel. `drawOptScreen` (shared by the build carousel and the craft
    strip) gained an optional `tag` corner-ribbon param; `drawBuildUI` now passes `'WALL'`/
    `'FLOOR'`/`'WIN'` (color-coded) for any `BUILD_ITEM` that fills the wall grid, is a floor
    tile, or is a `WINDOW_MATS` pane respectively — furniture/props get no tag, since they were
    never ambiguous. Applies uniformly to the built-in pieces too, not just codex ones.
  - User: "make all wall tiles x2 and floors x3 when created — otherwise it gets too expensive to
    build the newer material types." Traced to `registerCodexMaterial`: the built-in wall/floor
    recipes already craft in bulk (Plank/Stick/Fieldstone Wall ×3, Floor Boards/Packed Earth ×4),
    but every *discovered* material's recipe (`registerCodexMaterial`'s `mat_id`/`matf_id`)
    output only ×1 — so a material felt dramatically pricier to actually build with purely
    because it was found late, not because it's meant to be rarer. Wall-kind recipes now output
    2, floor-kind 3, matching the user's literal ask; door/window-kind codex recipes are
    untouched (not what was asked, and doors/windows are single fixed openings, not
    surface-area pieces). Only affects newly-registered recipes (`RECIPES` is runtime-only,
    rebuilt from the saved codex on each page load), so existing discoveries pick up the new
    rate on the next load rather than needing a save migration.
  - Verified live: forced three fresh discoveries (`kind` 'both', 'both', 'floor') and read back
    their registered `RECIPES` entries — wall output 2, floor output 3 in every case; a
    screenshot of the build carousel with test materials in the OTHER row shows the WALL/FLOOR
    tags rendering clearly and distinctly per item. 0 console errors.
- **Villager population cap. DONE & verified.** User: "should we implement a limit on how many
  villagers we have? Up to you" — raised alongside a night-performance question, since a bigger
  colony is directly more actors ticking and more lit windows/torches to render at night for a
  village-management/dossier/sit-down system that was tuned around a cult-sized colony, not
  an unbounded one. Added `VILLAGER_CAP = 24` and a `villagerAtCap()` helper; gated all three
  places a genuinely NEW villager gets added — kidnap completion (`completeUrge`), the passive
  country-tick recruit trickle, and a captured raid boss auto-joining — WITHOUT touching governor
  recall (an existing villager returning to the roster isn't population growth, so it's always
  allowed even at the cap). Hitting the cap doesn't waste the player's effort: a blocked kidnap
  pays out 90 reward + $60 cash instead of 70 reward, a blocked recruit becomes $15 tribute, and
  a blocked boss-capture pays $80 — each with its own flash explaining why, rather than silently
  discarding the reward. Verified live: filled a test village to exactly 24, ran `completeUrge`
  for a kidnap — villager count stayed at 24, player gained $60; the same call against a 5-villager
  test roster added the 6th normally. Test data was written into a real autosave mid-session
  (`ror_village`) and was explicitly cleaned back out afterward, confirmed via a direct
  localStorage read showing 0 villagers again. 0 console errors.
- **Raid factions were still pre-aggroed on spawn; fast night lighting toggle. DONE & verified.**
  User: "enemies and civilians still seem to be acting like they used to. As soon as I spawn
  enemies appear hunting me down and everyone seems to be able to see me through walls." The
  sight-based hunting work above covers ambient street thugs, but `spawnRaidFaction()` — the
  boss + elite garrison spawned the moment you raid a country-map city — had its own separate,
  untouched `mad: true, aggro: 1400` baked directly into the boss and every elite at creation.
  That's a real miss in the previous pass, not a stale-cache illusion: any country-node raid put
  the player straight into a pre-alerted swarm regardless of the sight/aggro rework, which is
  almost certainly what "as soon as I spawn" was describing. Fixed the same way as the ambient
  case: boss/elites now keep their own type's sight-based aggro (bruiser 380, whatever `f.elite`
  resolves to otherwise) instead of the hardcoded 1400, drop the forced `mad`, and get
  `assignPatrol()` so they visibly walk a beat around the town square instead of either freezing
  in place or auto-charging — "the attackers are patrolling until you're seen" now genuinely
  applies to raids too, not just street encounters. Mid-fight reinforcements (the `_straggler`
  trickle once the square is being held) were deliberately left `mad: true` — by that point the
  fight is already loud and obvious, so a reinforcement rushing toward known combat isn't the
  same bug as a silent garrison somehow sensing you on arrival.
  - Verified live: forced a country-node raid via the debug object (`spawnRaidFaction()` with
    `mission.node` set) — boss and all elites came up `mad:false` with sight-scale aggro and a
    real 2-3 point patrol loop; placing the player 40px away and ticking 30 frames flipped the
    boss to `mad:true` exactly as intended (proximity/sight still works, it just isn't automatic
    anymore). 0 console errors.
  - Also addressed in the same pass — the user's separate night-lag question, answered last turn
    as "likely the per-frame `createRadialGradient` calls for every torch/window/player-torch,
    not the cosmetic day effects" — with a **toggleable** experiment per their explicit ask to
    "test... with the ability to step back if they look bad": `FAST_GLOW` (on by default) bakes
    ONE soft glow sprite once (`glowSprite()`) and reuses it via cheap `drawImage`+`globalAlpha`
    calls (`drawGlowFast()`) for the three lighting sites that scale with village size — lit
    windows (the biggest one, since it's per-visible-pane), hearth/torch ground pools, and the
    player's own torch. Each site keeps its ORIGINAL `createRadialGradient` code intact in an
    `else` branch — nothing was deleted, so turning the toggle off is a real, complete revert,
    not a cosmetic approximation of one. A new **Settings → "Fast lighting"** checkbox
    (persisted to `localStorage` the same way the existing Music/SFX/AI-mix rows are) flips it
    live, no reload needed; also exposed as a settable `fastGlow` property on the debug object
    for quick A/B checks. Trade-off disclosed up front: the cached sprite uses one shared
    warm-orange tint/shape approximating what used to be 3 slightly different gradients (a
    torch's two-stop flicker pool, a window's single-stop halo, the player's own off-centre
    torch glow) — close, not pixel-identical.
  - Verified live: screenshotted the same night scene with the toggle on vs off via the debug
    object — both read as a coherent, attractive night look; the difference is real (fast mode
    is a touch softer/warmer, the original a touch colder/more contained) but not jarring in
    either direction. Confirmed the actual Settings checkbox (not just the debug setter) flips
    the live flag AND persists to `localStorage['sb_fastglow']` by toggling it through the real
    UI and reading storage back. 0 console errors. Not yet measured: actual frame-time delta on
    the user's own hardware, since that's where the real lag was reported — this ships the lever,
    not a benchmark.
- **Two more real sight-based-hunting bugs, plus a kidnap bodyguard. DONE & verified.** User:
  "walking around the city everyone is still watching me, even through walls — I can tell because
  they are always facing me. The hostile characters seem to even be trying to attack me before
  I've even broken the law and they're trapped inside houses." Two separate, concrete gaps this
  time, not one:
  - **Every enemy always faced the player.** `updateEnemy` set `e.dir = Math.atan2(dpy, dpx)`
    (dpx/dpy = vector to whatever `enemyTarget()` returned, usually the player) unconditionally,
    every frame, for every enemy — BEFORE the civ/calm-cop/patrol/engaged dispatch even ran. A
    patrolling or wandering enemy's facing was never touched afterward, so it visibly stared at
    the player through walls the entire time regardless of `mad`/sight state — a real, highly
    visible bug, and exactly what "always facing me" describes. Moved the aim-at-target
    assignment into the `engaged` branch only (so it still aims correctly while actually
    fighting), and added a general "face the direction you're actually walking" fallback
    (`if (!e.mad && speed>4) e.dir = atan2(vy,vx)`, mirroring the existing villager pattern) for
    every calm state — patrol, wander, and each civ job. Shopkeeper/worker's own idle work-beat
    also now explicitly faces their stall while busy, matching the equivalent villager job code.
  - **AI-generated/roster-spec/building-occupant enemies never got last session's aggro fix.**
    The thug/bruiser/gunner/cop *string*-type branches in `makeActor` were retuned to
    screen-scale aggro, but any enemy created from a *spec object* instead (building occupants
    in a hideout/warehouse/gym/office via `addOccupants`'s `HOSTILE_KINDS`, Generator Lab
    spawns, AI-mixed wave enemies) routes through a completely separate `compileActorSpec` →
    `BEHAVIORS` table that still had the old 640/700/1000 values — so anything spawned that way
    kept detecting the player from screen-spanning range regardless of walls, which is almost
    certainly the "hostile, trapped inside houses, before I've broken the law" report. Retuned
    `BEHAVIORS.rusher/bruiser/shooter` to 300/320/420 to match, and dropped the `(e.aggro||600)`
    fallback used in the sight-memory math to 320 so anything with no explicit aggro at all
    inherits the tight scale too, not the old expansive one.
  - **Kidnap targets now have a bodyguard**, per the user's own explicit ask ("otherwise it'll be
    a little too easy" now that street hostiles are calm-until-sighted): `missionSpawnObjective`
    spawns a thug/bruiser (`_guardOf` tagging the target, a `BODYGUARD` trait-tag/aura reusing
    the existing M6a aura system so it's visually identifiable) next to any kidnap target. The
    guard is an ordinary sight-gated hostile right up until it actually spots the player — the
    new part is `alertEnforcers(x,y)`, fired the instant it transitions calm→mad: it calls
    `markWanted(true)` (wakes nearby cops, same sight-gated rule as everywhere else) AND rallies
    any other nearby non-civ hostile within sight (same pattern as the crowd-aggro fix). Sneaking
    up on an unguarded target is still exactly as easy as before; sneaking past a guarded one
    now has a real, sight-based risk instead of none.
  - **Fast-lighting toggle also added to the admin panel**, per the user's ask to test it in
    their real village rather than a throwaway save: a `fast lighting: on/off` button in the
    existing Generator Lab admin bar (`\`), wired to the same `FAST_GLOW` flag, `localStorage`
    key, and Settings checkbox as the version from the previous pass — clicking either the admin
    button or the Settings checkbox keeps both in sync.
  - Verified live in the user's actual save (day-1 test village, not a synthetic one): a
    spawned-and-moving thug's `dir` matched its real `atan2(vy,vx)` heading, not the vector to
    the player, while calm; a spec-compiled enemy (mirroring a building occupant) came up with
    aggro 300/320/420 for rusher/bruiser/shooter instead of 640/700/1000; a kidnap target spawned
    with a calm, correctly-tagged bodyguard 40px away, which flipped hostile and rallied a
    separate bystander thug + raised `wanted` the moment the player got close enough to be seen;
    the admin fast-lighting button toggled the live flag, `localStorage['sb_fastglow']`, and the
    Settings checkbox in lockstep, in both directions. A 600-tick mixed stress test (10
    thugs/gangs + 8 civs, all 5 jobs) produced 0 NaN positions/directions and 0 console errors.
    Test-only village state (a synthetic `village.urge`) was cleaned back out of the real
    autosave afterward, confirmed via a direct localStorage read.
- **The actual "sees through walls/objects" cause. DONE & verified.** User: "everyone still
  seems to be able to see me through walls and objects." The two previous passes were real fixes
  but incomplete — this time traced it to the sight-check primitives themselves, not the states
  built on top of them:
  - **`lineBlocked` never checked props at all** — it only ever raycast against the wall-material
    grid (`cellSolid`). A car, dumpster, crate, or any other solid prop did nothing to break
    sight, which is exactly "through... objects." Added `segmentHitsBox()` (a standard
    segment-vs-AABB slab test) and a pass over `props` in `lineBlocked`, checking any `p.solid`
    prop the same way movement collision already does.
  - **A sight-free "point blank" clause silently dominated everything.** `engaged` was
    `e.mad || (canSee && pd<aggro) || pd<150` — that trailing `|| pd<150` has NO sight check at
    all, and 150px (≈9 grid cells) is large enough to span an adjacent room through a shared
    wall, or reach around a corner. Since every aggro value is now 300+ (last session's fix),
    `canSee && pd<aggro` already covers everything within 150px that's actually visible, making
    the bare `pd<150` clause pure liability — removed outright. The parallel civilian panic-flee
    check (`if (pd<150...) { flee }`) had the identical gap and is now gated on `canSee` too.
    This was very likely the dominant remaining cause: once `pd<150` made an enemy `mad` through
    a wall, it was then *legitimately* entitled (by the code's own logic) to face and chase the
    player every frame after — which is why the "always facing me" fix from the previous pass
    didn't visibly resolve the complaint on its own. Fixing the entry condition here is what
    actually stops it, not another patch on the symptom.
  - Verified live: a thug 80px from the player with open sight went `mad`; an identical setup
    with a solid synthetic prop placed on the direct line between them stayed calm. At 100px
    (well inside the old sight-free `pd<150` band) — the exact case that used to detect through
    anything — a blocking prop now keeps the thug calm, while the same distance with a clear
    line still correctly goes hostile (close-range detection isn't broken, just no longer
    sight-free). 600-tick mixed stress test afterward: 0 NaN positions/directions, 0 console
    errors.
- **Re-verified wall-blocking is real (it was a test artifact, not a bug) + the actual remaining
  cause. DONE & verified.** User: "Are you including walls when considering barriers? ... I seem
  to get a 'wanted' level almost the moment I spawn too." Re-tested `lineBlocked` against a REAL
  generated city wall cell (not a synthetic prop) in one continuous script — it blocks correctly;
  an earlier ad-hoc check that seemed to show a live bug turned out to be the well-known
  cross-call state-drift trap (splitting setup and assertion across separate tool round-trips
  lets the real background loop move the player in between, so the "line between them" being
  tested was already stale) — worth remembering, not a code defect.
  - **The actual bug**: `attack()`'s melee path unconditionally called `markWanted(true)` at the
    end of EVERY swing — hit or miss, against anything, including an enemy already attacking
    you. Fighting back in self-defense was silently raising heat exactly like committing a
    crime, which is almost certainly the real source of "wanted the moment I spawn" and a good
    chunk of the "sixth sense" feeling (once `wanted>0`, cops actively converge, and any fight at
    all was enough to trigger it). Removed the unconditional call — hitting a civilian (already
    handled in `damage()`'s civ branch) and vandalizing property near a shopkeeper (already
    handled by `alertShopkeepers`) are still the real "breaking the law" triggers; melee no
    longer raises wanted by itself.
  - Verified live: a whiffed swing at open air left `wanted` at 0; attacking an already-hostile
    thug (self-defense) also left it at 0; attacking a civilian still correctly raised it to 8 and
    converted them, unchanged. A same-script, single-continuous-run retest of a real wall cell
    (found via `cellSolid`, actor placed with `speed:0` on the far side) confirmed sight is
    genuinely blocked.
- **Kidnap targets now stay put and are properly guarded. DONE & verified.** User: "the
  bodyguards don't seem to be near the person I'm kidnapping... make the person getting kidnapped
  just stay indoors and not travel around — maybe add another bodyguard? Or have the target call
  the authorities too... too easy to walk up and take them." Two real gaps in last session's
  bodyguard feature:
  - The **target itself** was a plain `civ` with a randomly-rolled job — if it happened to roll
    `jogger` or `pedestrian` it could wander freely (even clear across the city) like any other
    civilian, with nothing tying it to its spawn point. Kidnap targets now spawn forced into the
    `worker` job (the same tight, anchored loiter loop shopkeepers use) via `makeActor`'s
    existing `forceCivJob` param — a strong, low-risk stand-in for "stays indoors" without a
    deeper building-placement rework. (Errand targets, not mentioned by the user, keep their old
    free-roam behaviour.)
  - The **bodyguard** was spawned near the target but with NO patrol/anchor at all, so it fell
    into the plain undirected jitter-walk and could drift arbitrarily far away over a long play
    session — there was nothing keeping it "near the person I'm kidnapping" past the first
    moment. `assignPatrol()` gained an optional `center`/`rMin`/`rMax` so a beat can be pinned to
    something other than the patroller's own spawn point; a kidnap target now gets **two**
    guards (a bruiser and a thug, per the user's own "maybe add another bodyguard"), each
    patrolling a tight 20-44px loop centred on the TARGET's position specifically, not their own.
    Each guard is an ordinary sight-gated hostile until it actually spots the player, at which
    point (unchanged from last session) it sounds a real alarm via `alertEnforcers`.
  - "Have the target call the authorities too" was already true and didn't need new code: the
    target's own bonk-handling in `damage()` (`t.isTarget && !t.dazed`) has called
    `markWanted(true)` on the very first hit since this system was first built — confirmed by
    reading that code path, not assumed.
  - Verified live: a kidnap target spawned with `civJob:'worker'`, two guards (bruiser + thug)
    with patrol points all within ~35-42px of the target at spawn; after a 20-sim-second tick,
    the target had drifted only ~14px from its spawn (vs. potentially anywhere before) and both
    guards stayed within ~33-57px of the target's new position — patrolling their charge, not
    the city. 600-tick mixed stress test: 0 NaN, 0 console errors. Test-only `village.urge`
    cleaned back out of the real autosave afterward.
- **Enemy visual variety + a real wanted-tier system. DONE & verified.** Two requests:
  - User: "why are the enemies in the cities during these basic missions always the same
    people? It's always the circus looking guy and a bunch of about 5 identical looking
    enemies." Two separate real causes: (1) `roster.js` (the checked-in AI-generated seed file)
    is entirely carnival-themed (5 of 5 entries), and `rollSpawnType`'s 40% AI-mix chance was
    drawing from a pool where circus characters outnumbered everything else for two of the
    three behaviors — added 5 new non-carnival `DEFAULT_ROSTER` enemies (Dock Heavy, Alley
    Tough, Numbers Runner, Junkyard Brute, Rooftop Sniper — spanning bruiser/rusher/shooter,
    built from the same parts/palette vocabulary as the existing Fire Marshal/Clown/Biker/Line
    Cook) so the built-in pool is no longer circus-minority; bruiser and shooter pools are now
    majority non-circus, rusher improved from 1-in-3 to 2-in-5. (2) The PLAIN thug/bruiser/
    gunner types (the ones NOT AI-mixed) had almost no colour variety at all — bruiser and
    gunner had a single FIXED shirt colour each (every bruiser was the exact same enemy), and
    thug picked from 3 near-identical shades of rust. Widened each to 5-8 genuinely distinct
    hues (reusing the pattern the civ palette already used successfully) — a street full of the
    same base type now reads as a crowd, not clones.
  - User: "there should be different levels of wanted level where it ramps up the more illegal
    stuff you do, where stronger enemies get added the higher the level — but running and hiding
    should always be an option... so if you can be out of sight for a period of time then the
    wanted level gradually drops away." `wanted` was previously a single floor-set value (a
    "minor" infraction could never raise it past 8, a "major" past 12, and repeat offenses did
    nothing once already at that floor) that decayed on a flat per-second timer regardless of
    what the player was doing. Replaced with a proper tiered system:
    - `markWanted` now ADDS to `wanted` (capped at `WANTED_CAP=100`) instead of flooring it, so
      repeat infractions genuinely escalate rather than plateauing instantly.
    - `WANTED_TIERS` (0/1/30/60/85, mapping to 0-4 "stars") drives both the HUD text
      (`updateWantedHUD` — "★★★ WANTED" etc, replacing the old static "★ WANTED") and which
      enemy types are eligible to spawn as reinforcements while wanted: tier 1 is cop-only,
      tier 2 adds thugs, tier 3 adds gunners/bruisers alongside cops, tier 4 is gunners/bruisers
      without the training wheels — literally "stronger enemies get added the higher the level".
      The existing reinforcement cadence (a `dt*0.25` chance, gated so it doesn't spawn forever)
      is unchanged — only the pool it draws from and the population cap scale with tier now.
    - Decay is now sight-gated rather than a flat timer: a new `_wantedHideT` counts seconds
      since ANY hostile last had real eyes on the player (checked by reusing the existing
      per-enemy `_loseSightT` sight-memory timer from two sessions ago — `mad` and
      `_loseSightT<0.5` means "currently or very recently perceiving you"). Wanted holds steady
      the entire time you're seen, however long a fight runs; only once nobody's had eyes on you
      for 4 straight seconds does it start draining (10/sec) — genuinely breaking contact and
      staying broken is what calms things down, matching "if you can be out of sight for a
      period of time then the wanted level gradually drops away" exactly.
  - Verified live: sampled 40 fresh thugs — 8 distinct shirt hues, no repeats clustering; the
    roster admin panel lists 14 enemies (was 9) with the new ones correctly categorised by
    behaviour and no validator warnings. Wanted: 5 civilian hits in sequence produced a clean
    8/16/24/32/40 additive sequence (not floored) with the HUD crossing to ★★ exactly at the
    30-point tier boundary; with a `mad` enemy kept continuously adjacent for 3 sim-seconds,
    wanted held at 40 with zero decay; with all enemies set calm afterward, wanted still held
    at 40 through 1 hidden second (inside the 4s grace window) and had drained to exactly 20 by
    6 hidden seconds (2s of 10/sec decay past the grace period) — matching the design precisely.
    600-tick mixed stress test: 0 NaN, 0 console errors.

- **City population redesign: static patrol gangs replace endless "waves"; civilians get a real
  chance to fight back; wanted-reinforcement bug actually fixed this time. DONE & verified.**
  User: "I never saw any enemies, even though my wanted level is 2. Then because they never saw
  me the wanted level drops to nothing... in Streets of Rogue there's always lots of police
  patrolling so they come running if you commit a crime and they're nearby... maybe 50% of
  civilians could pull out a weapon and attack you if you cause trouble... let's remove the
  'waves' of enemies and instead have patrolling gangs who attack on sight and police who come
  running if you cause trouble nearby (but they're passive otherwise), and the wanted level will
  still apply to the 'gangs' of themed enemies."
  - **Removed the endless "wave" system entirely.** `nextWave()` used to re-trigger forever the
    moment every hostile died, with an ever-growing spawn budget (`3 + wave*2`, scaled by
    tier) — there was no such thing as "the block is cleared," just an escalating treadmill.
    Replaced with `populateCityStreets()`: a fixed, one-time population seeded right after
    `missionSpawnObjective()`/`spawnRaidFaction()` in `enterZone` — 4-6 gang members (already
    patrol-looping and gang-clustering, per the earlier sight-based work) plus 2-3 beat cops
    (now also given a real `assignPatrol()` loop, not the old pure-jitter wander — "always lots
    of police patrolling" is now literally true). Nothing auto-respawns once killed; verified a
    fully cleared street stays cleared through a 600-tick tick-through. `spawnQueue`/`waveTimer`
    and the `nextWave` debug export were removed as genuinely dead code, not just unused.
  - **Found and fixed the actual reason reinforcements never reached the player.** Two bugs
    stacked on top of each other: (1) the wanted-tier reinforcement spawn (built last session)
    used the same far random ring as ordinary ambient spawns (620-980px) — usually well outside
    view and often too far to ever close the distance, so cops effectively spawned into the
    void. Fixed by spawning them 340-460px out ("just outside of view", per the user's own
    suggestion) and immediately `mad` + `calm:false` — an actively-responding unit heading
    straight for the player's real position, not a fresh calm patroller that happens to be nearby.
    (2) A second, subtler bug in the tier logic itself: the reinforcement roll and the sight-gated
    decay were one `if/else` — meaning a responder could only ever be rolled during the brief
    window *before* the 4-second hide-grace elapsed. If nothing happened to already be `mad`
    right after the last infraction (very possible — see the civilian point below), that window
    could pass with zero rolls, and wanted would then just silently drain to 0 with no response
    ever having spawned — exactly the reported "wanted level 2, never saw anyone, then it dropped
    to nothing." Decoupled the two: reinforcement rolls now run for as long as `wanted > 0`,
    completely independent of the hide/decay state, so being hidden fades your heat but doesn't
    call off the search.
  - **Civilians now have a real chance to fight back**, replacing the old near-guaranteed
    conversion: hitting a civilian always alerts the authorities (`markWanted`, unconditional —
    a witness always reacts) but only a coin-flip half the time do they actually draw a weapon
    and become hostile; the other half just panic-flee via their existing behaviour, completely
    unrelated to the player's wanted level, matching "civilians wouldn't react to your wanted
    level, but they do defend themselves... if you're threatening them." Property defence
    (`alertShopkeepers`, from the earlier session) is unchanged — still always calls it in.
  - Verified live: `populateCityStreets()` seeds 4-6 patrol-looping gang members (including
    AI-mix roster substitutes) and 2-3 patrol-looping cops per city visit; killing everyone and
    ticking 600 frames confirms nothing auto-repopulates. 40 sampled civilian hits split 21
    fight/19 flee — a genuine coin flip, not a fixed rule. A clean, single-script reinforcement
    test (civilian hits built wanted to 40, all hostiles pre-cleared, player pinned in place for
    1500 ticks) produced 2 active responders, one already in melee range and one still closing
    from 215px out — both `mad`, both genuinely converging on the player, not stranded on the
    far side of the map. 900-tick stress test afterward: 0 NaN, 0 console errors. (Also
    re-learned, the hard way, mid-session: reading a primitive like `wanted` off a
    `window.__G()` snapshot captured earlier in the SAME script still returns the stale value —
    every read needs a fresh `window.__G()` call, not just reads split across separate tool
    calls; two apparent "zero responders ever" results during testing turned out to be exactly
    this, not real bugs.)
- **Weapon still visible while your hands are full. FIXED & verified.** User: "when you pick up
  an object your weapon is still visible even though you can't use them." `attack()` already
  refused to swing while `player.carrying` (a kidnap target/bulky item) or `player.holding` (a
  keepsake) was set, but `drawActor`'s weapon-rendering block had no matching check — it drew
  the equipped weapon unconditionally any time `a.weapon !== 'fists'`. Added a `handsFull = a
  === player && (player.carrying || player.holding)` guard alongside the existing check, so the
  weapon sprite disappears exactly when it stops being usable, matching the two dedicated
  carry/hold arm poses that already render in that state. Verified by pixel-sampling the bat's
  known fill colour (`#9a6b3a`) at the weapon's on-screen position: present normally, gone the
  instant `holding` or `carrying` is set, with 0 console errors.
- **The real "second dimmer flame" cause, found after ~10 prior failed attempts. FIXED &
  verified.** User: "I've asked you to fix this about 10 times now and you keep saying it's
  fixed but it's not. There's always a second dimmer flame below the main (top) one." Rather
  than guess an 11th time, walked every flame-related code path first (the Standing Torch prop's
  day-draw vs. its night "relight" stamp — confirmed mathematically exclusive, `nt<=0.36` vs.
  `tod.night>0.36`, no possible overlap — and the `torch` weapon-head sprite), reproduced a
  torch prop live at several times of day with no duplicate, then asked two targeted questions
  to pin down what previous attempts apparently never confirmed: the second shape was a **real
  flame silhouette**, not a soft glow, and it appeared **always, on the player, at night** —
  regardless of nearby props or what was equipped. That pointed at the one thing actually drawn
  unconditionally on the player after dark: the "lit torch in the off-hand" sprite in
  `drawActor` (position = `player.x/y` offset by `Math.cos/sin(player.dir + 0.7) * R*1.05`,
  swinging to whichever side is off-hand as you turn) and a *separate* ambient light-glow-pool
  drawn in the lighting pass, meant to be that same torch's light. The glow's position, though,
  was hardcoded to `player.y ± 13` with **no dependency on `player.dir` at all** — so for most
  facing directions the light came from a completely different spot than the actual torch
  sprite (worked out numerically for facing east: sprite at `player.(x+10.4, y+5.5)`, light at
  `player.(x+0, y-13)` — a different quadrant entirely). That mismatch is what read as two
  flames: the real sprite, and a separate, wrongly-placed glow blob that never tracked it.
  Fixed by computing the glow's anchor with the exact same `player.dir`-dependent formula the
  sprite uses, so the light now genuinely comes from where the torch visibly is.
  - Verified live: screenshotted the isolated torch (away from any other light source) at
    several different facing angles and with `FAST_GLOW` both on and off — the glow stays
    visually locked to the sprite in every case, instead of splitting into two separate warm
    patches. 0 console errors.
- **Daytime performance pass. DONE & verified.** User: "the game gets a little laggy during the
  daytime now. Not sure why." Two concrete, verifiable finds:
  - `lineBlocked`'s prop-occlusion check (added when fixing the "sees through objects" bug) had
    no early-out — every sight check scanned the ENTIRE `props` array with the full
    segment-vs-box slab test, and this runs at least once per enemy per frame. Added a cheap
    4-comparison AABB reject before the slab math, so a prop nowhere near the line in question
    gets thrown out almost for free instead of paying the full geometric test — a real,
    unbounded-scaling cost (worse the longer a single city visit runs, since chunks/props never
    unload — `CDROP` was declared for exactly that and never actually used, a separate,
    disclosed gap) turned into a cheap one, with identical blocked/open results.
  - The village's daytime cloud-shadow rendering builds a fresh `createRadialGradient` per
    cloud per frame — architecturally the same cost class as the night-lighting issue fixed a
    few sessions ago, just smaller (2-3 clouds, not every torch/window in view). Extended the
    existing `FAST_GLOW` toggle to cover it (`drawShadowFast`/`shadowSprite`, a dark-blob mirror
    of the warm `glowSprite`) for both the village's daytime clouds and the city's rain-clouds,
    with the original gradient code kept intact as the off state, same as everywhere else
    `FAST_GLOW` touches.
  - Verified live: a thug 80px from the player with a clear line still goes hostile; the
    identical setup with a solid prop on the line still stays calm — the AABB fast-path changes
    nothing about correctness. A 300-tick daytime simulation with natural clouds produced 0
    console errors with `FAST_GLOW` on. Not confirmed: whether either of these was the exact
    cause of the reported slowdown, since no profiler was run — both are real, disclosed, safe
    wins regardless, not a guess dressed up as a diagnosis.
- **Pulled the camera back a notch; brought ambient pedestrians back. DONE & verified.** User:
  "Is it possible to zoom out the view in the city a little?... hard to hide or avoid mobs when
  everything is so close up and tight. We need more pedestrians too. I only ever see people
  cowering."
  - **Zoom.** First tried a live mouse-wheel zoom (`setZoom()`, clamped 1.2-2.6, persisted to
    `localStorage`) — genuinely zooms the CAMERA, not just a crop-and-stretch of an already-drawn
    frame (that's what the existing `viewZoom` "blit-zoom" used for craft/build close-ups does,
    and why IT can only ever zoom in: the offscreen canvas has no more world data to reveal past
    what's already rendered into it). Verified live in the city: scrolling out visibly widened
    the view (more street, another NPC and torch came into frame) while scrolling in narrowed it
    back, all while build mode correctly froze it (that mode owns zoom via `viewZoom` instead).
    User's follow-up: the interactivity itself wasn't wanted — just fix the camera at the
    pulled-back level they'd landed on. Removed the wheel listener and the whole adjustable-zoom
    apparatus, and made `ZOOM` a plain constant at that level (1.44, down from 2.0) — a smaller,
    permanent pull-back rather than a live control. **Kept** the one real fix this required:
    `drawActorTranslucent` (Ninja Vanish / Ghost transparency) sampled the screen assuming
    `VS===1` — true only at the old default zoom — now goes through `vw()` like the rest of the
    renderer, so it stays correct at any fixed zoom level, not just 2.0.
  - **Pedestrians.** Traced to a real gap from two sessions ago: replacing the old endless
    "wave" spawner with `populateCityStreets()` carried over the gang members and cops but
    dropped the plain ambient-civilian spawn the old system used to include — the only
    "civilians" a street population actually had left were building occupants (easy to miss
    indoors) and the kidnap target, whose entire design IS panicking. That's the literal
    explanation for "I only ever see people cowering": there was structurally nothing else
    outdoors to see. Added 8-12 ambient civs per city visit via the existing `rollCivJob()`
    pool (pedestrian/shopkeeper/worker/dogwalker/jogger, from the sight-based-AI work two
    sessions ago), going about their own business exactly like before, unrelated to the fix.
  - Verified live: a fresh city populated with 21 civs (of 32 total actors) spanning
    shopkeeper/worker/pedestrian/jogger — a visibly busy street on screenshot, several distinct
    NPCs going about their day rather than a lone panicking target. 600-tick stress test: 0 NaN,
    0 console errors.
- **Streets still read as empty after exploring. FIXED & verified.** User: "the streets are
  still very empty. I've never ever noticed a dog walker on the street or anyone casually
  walking the streets" — reported from a screenshot taken 10 blocks into a city visit. The
  ambient-civilian fix from the previous pass was real but incomplete: `populateCityStreets()`
  only seeds its population ONCE, near the mission's entry edge — it has no way to know the
  player will go on to explore many chunks beyond that (this city can be many blocks across).
  Every civilian from the initial seed was still alive, just far behind wherever the player had
  since wandered to, so any block more than a couple of screens from the entry point was
  genuinely never populated in the first place — not a rendering or spawn-chance bug, a coverage
  gap. Added a lightweight top-up in `step()`'s city block: whenever fewer than 6 civilians are
  within 500px of the player's CURRENT position, occasionally spawn one more via the same
  `spawnEnemy('civ')` used by the initial seed — which places on the standard ring around
  wherever the player is NOW, so new arrivals drift into view from just off-screen rather than
  popping in underfoot. Paused during a raid's `fight`/`hold` phases so it doesn't clutter a boss
  square, same as the old wave system was. This is explicitly NOT a revival of the removed
  "wave" mechanic — it only ever tops up toward a small fixed density (civilians only, never
  gangs/cops), and stops spawning the moment that density is met, rather than escalating.
  - Verified live: teleported the player 4000px from a freshly-populated city entry point (zero
    civilians within 500px, confirming the exact reported symptom) — after 10 sim-seconds the
    nearby count climbed to 4, and after 20s reached the 6-civilian target and correctly stopped
    growing further (39 total civs both before and after the extra 10s, i.e. no runaway). A
    forced sample confirmed dogwalkers specifically spawn with their `_dog` companion intact.
    1800-tick combined stress test: 0 NaN, 0 console errors.
- **2026-09-13d — "edges filled with NPCs but empty streets" + fleeing for no reason + civilians
  jitter/wander aimlessly.** Three real, related bugs, all from the same investigation:
  - The ambient/gang spawn ring (`spawnEnemy` with no `atPos`) was a fixed 620-980 world-unit
    distance from the player, tuned back when `ZOOM` was 2.0 (view half-width ~480, so the ring
    was always safely off-screen). Once `ZOOM` was pulled back to 1.44 for visibility (see above),
    the view half-width grew to ~660+ — bigger than the ring's own near edge — so spawns started
    landing at or inside the visible screen boundary: a wall of NPCs popping in right at the edge.
    Worse, the population top-up in `step()` only counted civilians within 500px as "nearby," but
    the ring starts past 620px, so a freshly spawned civilian never counted toward satisfying that
    check — it kept re-rolling more spawns onto the same edge band every frame instead of settling
    at a stable population, which is what read as "the edges are filled but the streets are empty."
    Fixed by anchoring both the spawn ring and the top-up's "nearby" radius to the CURRENT view
    size (`Math.hypot(VUW,VUH)/2`, plus a fixed margin) instead of a hardcoded distance, so spawns
    always land just past the edge regardless of zoom, and immediately count once they do.
  - Civilians fled from mere proximity (`canSee && pd<150`) with no actual threat requirement —
    just existing near the player triggered a scatter, "even though I've done nothing." Gated the
    check behind a real threat signal: `wanted > 0` (you've already broken the law) or the player
    actually holding a weapon (`player.weapon !== 'fists'`). An unarmed, unwanted player can now
    stand right next to a civilian with no reaction; hitting one (which already calls
    `markWanted(true)`) makes nearby civs flee correctly, same as everyone else once wanted.
  - Ambient civilians (pedestrian/dogwalker/jogger) had no real path — they picked a fresh random
    point every ~1-2s from wherever they currently stood, which reads as vibrating/wandering in
    circles rather than going anywhere; a beat cop was assigned a proper patrol loop at spawn
    (`assignPatrol`) but the calm-cop movement branch never actually read it back, so cops jittered
    in place too despite having a real loop computed. Fixed by giving pedestrian/dogwalker/jogger a
    real fixed-waypoint loop at spawn (reusing `assignPatrol`) and having calm cops walk their
    existing `_patrol` the same way gang thugs already do. Added two new anchored jobs — bouncer,
    homeless — reusing the shopkeeper/worker "return to one spot" loiter behavior. Also hardened
    `assignPatrol` itself to reroll a waypoint that lands inside a wall (it previously didn't check
    at all, so a patrolling actor could walk up to an unreachable point inside a building and stall
    there, which is its own source of the "jitter" look).
  - Verified live: spawn-ring distances now span from the view-edge margin outward (no more fixed
    620-980 regardless of zoom); a pedestrian's `_patrol` trace showed a clean pause-then-travel
    cycle with a stable heading the whole way (no wobble) instead of the old random-reroll drift; a
    controlled A/B test (civilian placed 30-60px from the player) showed a velocity-away-from-player
    component of -0.43 (crossing past, normal) when unarmed/unwanted vs. 0.999 (fleeing dead away)
    immediately after a real civ-hit raised `wanted` via `markWanted(true)` — confirming the gate
    triggers on actual provocation, not proximity. 0 console errors across the test session.
- **2026-09-13e — Population still too sparse after the ring fix; village daytime lag still
  unreproduced.** User: "It's somehow worse now. There were a bunch of people near the starting
  point and then the rest of the streets were empty" (city), plus "around the village area it was
  still running slowly during the day — even with the new lighting... something has changed."
  - Population: the 2026-09-13d fix correctly stopped the top-up from over-spawning at the view
    edge, but that also exposed how low its actual target was — only 6 civilians kept "nearby,"
    well under `populateCityStreets()`'s own 8-13 initial seed, so any block beyond the entry point
    visibly thinned out even though nothing was popping in wrong anymore. Raised the top-up target
    to 12 (matching the seed) and its fill rate slightly (`dt*0.4`→`dt*0.5`), and widened the
    pedestrian/dogwalker patrol-loop radius (90-190→130-260) so a mobile civ's loop actually covers
    a meaningful stretch of street instead of a tight loiter bubble. Verified live: a fresh city
    entry plus a few seconds of top-up produced 30 civilians spanning 103-1487 units from the
    player (was capped near 18 before), 15 of them already inside the nearby catchment band.
  - Village lag: could NOT reproduce on this end — a synthetic stress test (60 extra villagers
    pushed into a save that already had 916 props) held a rock-steady ~60fps/16.7ms both at the
    normal viewport and a much wider one, over 6+ second sampling windows, no hitches. Confirmed
    `streamChunks()` is a no-op in the village zone (`if (zone==='village') return;`), so chunk-gen
    stalls are ruled out there; confirmed `FAST_GLOW` is already on. Since this couldn't be forced
    to reproduce here, added a temporary F9-toggled corner readout (`frame/step/draw ms`, enemy
    /prop/light counts, zone, FAST_GLOW state) so the actual numbers from the reporter's own
    machine can be read directly instead of guessed at a third time — intended to be removed once
    the real cause is found, not a permanent feature.
- **2026-09-13f — Real numbers came back (frame 20.7ms, step 1.8ms, draw 17.6ms, only 4 enemies /
  856 props) — draw() itself is the bottleneck, not simulation load.** Also: F8 turned out to
  double as F9 originally, which is already bound to quickload — moved the toggle to F8. Found one
  concrete, unconditional cost in `draw()`: the corner vignette rebuilt a full-resolution radial
  gradient (`ctx.createRadialGradient` on the visible `W×H` canvas, not the half-res offscreen
  layer FAST_GLOW covers) and filled the entire screen with it every single frame, regardless of
  zone or state — cost scales directly with screen resolution, and a live desktop monitor is far
  larger than this sandbox's test viewport, which is the likely reason it wasn't showing up here.
  Cached it as a pre-rendered bitmap keyed on size + a quantized day/night edge colour, so a normal
  frame just blits the cached image instead of resampling a gradient across the whole screen; a
  full resize or a meaningful (>1%) day/night colour shift is the only thing that rebuilds it now.
  Could not reproduce a large delta from this specific fix in-sandbox (this test browser's canvas
  ops are just fast regardless of resolution — checked at a full emulated 1920×1080 and still saw
  draw() around 3ms either way), so it's shipped as a safe, strictly-better change rather than a
  confirmed full fix. Added `window.innerWidth/innerHeight`, actual canvas `W×H`, and
  `devicePixelRatio` to the F8 readout to see whether a high-DPI display (which would multiply the
  real backing-store pixel count well past what CSS pixels suggest) is part of the story — waiting
  on the reporter's numbers post-fix before calling this resolved.
- **2026-09-13g — Found and confirmed the REAL cause: stick-wall (and any gappy-textured wall)
  rendering was redone from scratch, in full, for every single wall cell, every single frame.**
  Post-vignette-fix numbers came back unchanged (frame 23.7ms, draw 16.3ms, win 1920x925, dpr 1 —
  ruling out high-DPI), confirming the vignette wasn't the real cost. The user's own aside — "the
  building walls are made of sticks... if that might help" — was the actual lead. `drawTexturedFill`
  (used for every wall/floor cell with a "gappy" texture — woven/rubble/lattice/etc, i.e. any
  stick, fieldstone, or player-discovered codex-material wall) rendered onto a shared scratch
  canvas via a full clear + fill + vector line-drawing + `punchLattice`'s double-nested-loop
  diamond-hole grid + `drawImage` composite — and did this ENTIRE pipeline over again for every
  wall cell, every frame, even though the output is 100% deterministic for a given material/size
  (none of the texture engines use position or randomness). `woven` (stick walls specifically) is
  the heaviest of the texture engines — crossed diagonal lines plus a full lattice grid of punched
  diamonds — so a stick-walled house was by far the worst case. Fixed by caching the rendered
  result as a tiny bitmap keyed on (texture engine, gap, line colour, fill colour, size): the first
  cell of a given material pays for the vector math once, every other cell (and every later frame)
  just blits the cached sprite — same technique as `glowSprite`/`shadowSprite`'s FAST_GLOW caching,
  just applied to wall/floor texture fills, which that system never covered.
  - Verified with a genuine causal A/B on identical geometry: painted a 112-cell stick-wall
    perimeter directly into a chunk's `mat` grid, then toggled between the old and new
    `drawTexturedFill` on that exact same scene (same viewport, same everything). OLD code:
    frame 20.7ms, draw 11.7ms — matching the reporter's own numbers almost to the decimal. NEW
    code: frame 4.4ms, draw 2.7ms. Roughly a 4-5x drop in draw time, reproduced twice. Screenshot
    diff confirmed the wall texture renders pixel-identical before and after (deterministic output
    was the whole premise the cache relies on). 0 console errors.
- **2026-09-13h — Village lag confirmed fixed on the reporter's own machine.** Follow-up:
  "the spread of civilians is better - but there's barely any of them" + "did you add weapons to
  them so that 50% of them can fight back if attacked or provoked?" + what would more ambient city
  NPCs cost.
  - Weapon gap: confirmed real — the coin-flip fight-back code (2026-09-12j) set `t.mad`/`t.type`
    but never touched `t.weapon`, so a "fighting back" civilian kept the bare-fists weapon it
    spawned with despite the code comment literally saying "pull a weapon." Now rolls a real
    improvised weapon (`pipe`/`bat`/`knife`) and runs `pickCombat(t)` so its AI pattern actually
    matches what it's holding. Verified live: 30 fresh civs hit, exactly 15 fought back (50.0%),
    every one carrying a real weapon with a matching combat style (rusher/skirmisher/ambusher).
  - Performance headroom: measured actual cost of more city population rather than guessing.
    Actor simulation/rendering is cheap — 44 total enemies costs ~4.7ms/frame, 136 costs ~10ms.
    The real ceiling is `updateEnemy`'s O(n²) crowd-separation loop (every enemy scans the full
    enemy list for neighbors): step() alone measured ~4.7ms at 136 enemies, ~16.4ms at 247, ~24ms
    at 300 — a real quadratic wall, but a long way past what a lively street needs. Raised the
    ambient top-up target from 12 to 20 nearby civilians (still nowhere near the danger zone) and
    its fill rate slightly (`dt*0.5`→`dt*0.6`). Verified live: 27 civs spread 130-1190 units out,
    total frame time ~4.7ms — comfortable margin. (Not fixed: the O(n²) separation cost itself —
    a spatial-grid rewrite would remove the ceiling entirely, but isn't needed at the population
    levels a "lively but not overwhelming" city actually wants; noted here in case a future ask
    — like a proper crowd/riot scene — needs to push past a few hundred simultaneous actors.)
  - 0 console errors under normal play; a batch of stale "non-finite gradient" console messages
    from the earlier synthetic 300-actor stress test were confirmed frozen/non-growing (leftover
    buffer, not a live issue) and cleared on a fresh tab reload.
- **2026-09-13i — The raid van, and fleeing civilians that actually keep fleeing.** Two asks:
  replace the abstract "walk off the map edge" entrance/exit with a beat-up white van that skids
  in at the start of a raid (no animation needed on the way out), and stop civilians from jittering
  in place a short sprint from the player once they clear the panic-trigger radius.
  - The raid van: `mission.edge`/`edgeSpawnPoint`/`edgeExitRect` already shared one exact centre
    point per edge (the spawn point sits dead in the middle of the exit band), so "arrive and leave
    from the same spot" was already true structurally — it just needed a real vehicle there instead
    of a dashed line. Added a `van` prop (boxier than the existing `car` clutter prop, worn white
    body, near-black windshield/window band, rust scuffs, a dent crease) parked just behind the
    player's facing direction. On city entry it starts 260 world units further out along the
    outward-facing direction (derived from the existing `faceInward(mission.edge)` angle, so no new
    direction table needed) and eases (cubic ease-out — fast approach, soft settle) to its resting
    spot over 0.8s, with a synthesized tire-screech (`S.screech`, existing noise/tone primitives)
    and a trailing dust-burst (reusing `burst()`) at the stop. Player input is held during the
    intro the same way the existing `p.dead` early-return already gates `updatePlayer`. `van` is
    effectively indestructible (hp 9999, matching `car`) and fixed (immune to explosion/impact
    shove) so it can't wander off as a landmark. Exit is untouched by design — same `exitRect`
    trigger, no animation, the parked van just IS the visual marker now.
  - Fleeing civilians: `pd < 150` was the only trigger AND the only thing keeping them fleeing —
    the instant they cleared 150 units (well under a second at full flee speed) they snapped back
    to their job's loiter/patrol logic with nowhere sensible to go, reading as jittering in place.
    Added a `_fleeT` timer: entering the panic condition sets/refreshes it to 5s, and while it's
    running (even after the proximity trigger itself goes false) they keep sprinting directly away
    from the player's current position — only falling back to normal behaviour once it expires.
  - Verified live: a fresh city entry traced the van easing from 260 units out down to its rest
    spot over exactly 0.8s (x: -1586→-1525→-1476→-1449→-1434→-1426→-1424, visibly decelerating),
    player position frozen the entire time, intro cleared itself on schedule, 0 console errors.
    Flee test: hit a civ to raise `wanted`, teleported a second civ next to the player — it ran at
    ~185-189 units/s continuously out to 1024 units away (nearly 7x the old 150-unit cutoff) over
    5.5 real seconds before `_fleeT` expired and it dropped back to normal wander speed and
    direction, exactly matching the intended "keep running for at least 5 seconds" behaviour.
- **2026-09-14 — Multiple profiles, so a second player doesn't overwrite the first's save.**
  User's daughter plays on the same machine/browser; before this, every save (`ror_village`,
  `ror_player`, quicksave, the 3 manual slots, the 6 rolling autosaves, legacy points) lived at one
  fixed set of localStorage keys shared by anyone who opens the game in that browser — a second
  person could only start playing by overwriting the first's progress.
  - Added a lightweight profile system rather than rearchitecting the save code: `activeProfile`
    (persisted in the always-global `ror_active_profile` key) and a `scopedKey()` helper wired
    directly into the two-function `store` object (`store.get`/`store.set`, the single choke point
    every save/load call already goes through) that appends `@<profileId>` to any `ror_*` key when
    the active profile isn't the default one. Left at 'default' — which is what every existing save
    is under, since the profile system didn't exist before — this changes nothing: a returning
    player's save keeps its original, unprefixed keys with zero migration step. Audio volume,
    fast-lighting, and high-score keys (`sb_*`) are deliberately left unscoped — those are device
    preferences, not save data, and nobody wants to re-set them per family member.
  - Added a `title-profiles` row on the title screen (`renderTitleProfiles()`, called from
    `openTitle()`): one button per known profile (from a `ror_profiles` registry, always-global,
    defaults to a single "Player 1" entry representing whatever save already existed) plus a
    "+ new profile" button that prompts for a name and creates+switches to a fresh one. Switching
    profiles just updates `activeProfile` and re-renders the title screen — since `hasSave()`
    already goes through the now-scoped `store.get`, the Continue button correctly shows/hides
    itself per profile with no changes needed there at all.
  - Verified live end-to-end: started a game as the default profile (blue shirt) — wrote to the
    original unprefixed `ror_village`/`ror_player` as always. Created a second profile "Testy" via
    direct profile-registry manipulation (this sandbox's `prompt()` isn't supported, a tooling
    limitation only — the codebase already relies on native `confirm()` elsewhere in this same save
    system without issue) and started a second game (pink shirt) — confirmed it wrote to
    `ror_village@p_test123`/`ror_player@p_test123` etc, a fully separate key set, while the
    original `ror_village`/`ror_player` stayed byte-for-byte present and untouched throughout.
    Switched back to the default profile and reloaded: Continue correctly returned the original
    blue-shirted save, not Testy's. 0 console errors besides the expected `prompt()` sandbox
    limitation from the one test click that used it.
  - Not built: renaming or deleting a profile (their save data lives forever once created — a
    delete option would need real confirmation UX given how much a village save represents; left
    out for now rather than rushed, per this project's standing caution around destructive save
    actions). Easy enough to add later if it turns out to matter.
- **2026-09-14b — "Quit to menu" button + a real title-screen illustration.** With multiple
  profiles now in play, switching who's playing needed a way back to the title screen without
  reloading the tab — plus a request for the title screen to actually look like the game instead
  of a plain button list, "like my character kidnapping someone, or being chased by clowns."
  - `quitToTitle()`, wired to a new "quit to menu" button in the Esc/Settings panel: saves
    (`saveVillage`/`savePlayer`) then nulls `player` and calls `toggleSettings(false)` — which
    already has an `else if (!player) openTitle()` fallback from a while back, meaning the "show
    the title instead of a blank canvas" logic already existed and needed zero changes. Mid-raid,
    it goes through the existing `leaveMission()` first (same retreat/spoils resolution as walking
    to the exit van) before dropping to the title 650ms later, once that's actually landed back in
    the village. A `confirm()` guards the button since it interrupts whatever's in progress, even
    though nothing is lost.
  - Title art: a small dedicated `<canvas id="title-art">` (340×150, pixelated rendering) drawn by
    a new self-contained `drawTitleArt(t)` — deliberately NOT reusing the live game's `drawActor`
    pipeline (too coupled to camera/lighting/real actor state for a static menu scene) but built in
    the same flat rectangle/circle style, with a shared `drawRunner()` helper for the blocky running
    figures. The scene: a night alley, building silhouettes with a couple lit windows, a flickering
    streetlamp, a moon, the player sprinting toward the parked getaway van with a kidnap victim
    slung limp over one shoulder (sack over their head, dangling arms/legs), two clowns in pursuit
    (candy-palette colours pulled straight from the real `clown`/`jester` roster entries — pink/
    yellow wigs, red nose, a bat) — ties the kidnap urge, the circus enemy theme, and the new raid
    van into one scene. Runs its own tiny animation cycle (opposite-phase leg swing via `Math.sin`,
    lamp flicker, van headlight pulse) off the existing `loop()` rAF, gated on `titleOpen` so it
    costs nothing once a game is actually running.
  - Verified live: quit-to-menu from the village correctly saved and returned to a title screen
    with Continue available, and reloading that save landed at the same spot with the same stats
    (village, 12/40, full HP) confirming no data loss. Quit-to-menu mid-raid correctly resolved
    the raid (zone flipped to village) before showing the title 650ms later. The illustration
    renders as intended — moon, buildings, lamp-lit street, two chasing clowns, the player mid-
    getaway, the van — and a two-frame comparison confirmed the run-cycle animation is actually
    advancing (a clown's arm visibly changed position between frames). 0 console errors (the
    sandbox's `prompt()`/`confirm()` limitations were worked around for testing only, per the
    profile-system entry above — real browsers execute both natively, as the codebase already
    relies on elsewhere).

- **2026-09-14c — "+ New Profile" did nothing: `window.prompt()`/`confirm()` don't work in the
  real play environment.** User's actual repro: click, nothing visible happens. This game is
  served inside the Projects Launcher (an embedding page), and a sandboxed iframe without
  "allow-modals" makes `prompt()`/`confirm()` either throw or silently resolve false/null with no
  dialog shown at all — exactly "doesn't seem to do anything," and not reproducible by opening the
  file directly (no iframe there), which is why the earlier session's own sandbox-limitation notes
  undersold it as testing-only.
  - Replaced every native dialog in the game (there were 7: the new-profile prompt, quickload,
    slot-load, autosave-rollback, quit-to-menu, wipe/new-game ×2) with a shared in-page dialog —
    one `#dialogModal` (text line + an optional text input) driven by `showDialog()`/`showConfirm()`
    /`showPrompt()`, all Promise-based so each call site just became `await showConfirm(...)` /
    `await showPrompt(...)` in an already-async-capable click handler. Being plain DOM instead of
    a browser-chrome dialog, it can't be blocked by iframe sandboxing at all.
  - Verified live with real clicks this time (not console workarounds): "+ new profile" now shows
    a proper text-input dialog, typing a name and clicking OK creates and switches to it
    immediately; Cancel correctly adds nothing. Quit-to-menu's confirm now renders as an in-page
    dialog too, and clicking OK through it saved and returned to the title with Continue correctly
    available afterward. 0 console errors on a clean tab (a batch of stale `prompt()`-not-supported
    messages from testing the OLD code before this fix were confirmed to be frozen buffer, not
    live, on a fresh tab reload — the same false-alarm pattern as earlier in this project).
- **2026-09-14d — Torch/campfire flicker slowed down.** User: "I like the fast lighting but that
  flicker is too intense/fast." All the flame-brightness flicker terms (torch/campfire/firebarrel
  glow pools feeding `drawGlowFast`, `torchFlame()`'s own flame-glyph pulse, the relight pass's
  campfire/firebarrel re-stamp) shared one frequency (`Math.sin(now*0.021+...)`, ≈3.3Hz — a fast,
  noticeable pulse); halved it to `0.010` (≈1.6Hz) across every one of those spots, keeping them in
  sync with each other the way the code already intended ("ONE flicker, shared... so the pool and
  the flame pulse together"). Also found the player's own held-torch flame re-stamp was using raw
  `1 + Math.random()*0.3` — no smoothing at all, a new random size every single frame — almost
  certainly the most jarring instance since it's the light attached to the player, on-screen
  constantly; replaced with the same smooth, slowed sine. The player's separate torch glow-POOL
  (a different code path, also FAST_GLOW-gated) had its own quicker sines (~2Hz) plus a small
  per-frame random jitter term; slowed and aligned it to the same pace and dropped the raw jitter
  for a fully smooth pulse. Streetlamp buzz and the flame's side-to-side sway were left untouched —
  those are a different, deliberately electrical/jittery effect and pure motion respectively, not
  what "fast lighting" flicker refers to. Verified live: forced night in the village (`village.tod`
  set high enough for `todLerp().night>0.3`), confirmed the torch/campfire glow renders correctly
  with no visual corruption post-edit; the frequency halving itself is a direct, easily-verified
  arithmetic change (period doubled from ~300ms to ~628ms) rather than something needing frame-by-
  frame visual timing proof. 0 console errors.
- **2026-09-14e — Still too fast/strong: halved again, AND cut the amplitude.** User: "the fast
  lighting flicker growing and shrinking is still too fast, when you have a few lights together
  it's intense... make it more subtle/slow." The previous pass only halved the frequency (0.021 ->
  0.010, ~1.6Hz) and left the size-swing amplitude untouched (±0.16-0.20, i.e. the glow pool's
  radius itself swinging ±16-20%) — with several torches/campfires in view at once, each pulsing
  out of phase, that reads as a busy, breathing scene even at the slower rate. This pass halves the
  frequency again (0.010 -> 0.006, ~1Hz) AND halves the amplitude (0.16 -> 0.08, and proportionally
  down the smaller secondary terms) across every spot touched last time: `torchFlame()`, the shared
  torch/campfire/firebarrel glow pool, the relight-pass campfire/firebarrel re-stamp, the player's
  held-torch flame re-stamp, and the player's own torch glow-pool (baseline raised slightly, 0.85
  ->0.92, so the now-smaller swing still reads at a similar average brightness rather than just
  looking dimmer). Streetlamp buzz and the flame's side-sway are still left alone — different,
  deliberately electrical/jittery effect and pure motion, not the "growing and shrinking" being
  described. Verified live: forced night, confirmed the campfire + player-torch overlap (the "a few
  lights together" case) renders correctly with no visual corruption; a batch of console errors
  seen mid-test traced to a testing artifact of my own (two `null` entries accidentally pushed into
  `props` while trying to spawn extra torches for the test) — confirmed cleaned up and, separately,
  confirmed absent entirely on a fresh tab, so not a real regression from this change.
- **2026-09-14f — The van intro became a real three-beat sequence: drive in, skid, player emerges
  from the door.** User: "make it move down and then skid, making smoke from the tyres as it
  skids. The player then appears from inside the van door. The van door stays open... for a fast
  escape." The previous version was one straight ease-out slide with the player already standing
  there the whole time — functional, but not the arrival beat asked for.
  - `mission.vanIntro` now tracks three phases against one running clock: **drive** (0.4s, fast
    ease toward a point ~80% of the way in), **skid** (0.28s, hard ease-out to the exact rest spot
    with a decaying sideways fishtail wobble on the perpendicular axis, tire-smoke bursts every
    35ms, and the screech sound now fired at the START of this phase — synced to the actual
    braking moment instead of the instant the van appears), **emerge** (0.28s, the player — hidden
    until this point — becomes visible exactly at the van's position and eases to their real
    standing spot, like stepping out and walking clear).
  - The player is genuinely invisible (not just repositioned) during drive+skid: extended the
    existing `playerVisualAlpha()` hook (already used for Ninja Vanish/Ghost translucency) to
    return 0 while `mission.vanIntro.hidePlayer` is set, so it renders through the same
    getImageData/putImageData blend path already proven for partial transparency — no new drawing
    code needed, and no separate flag left dangling on the player object itself (derived from
    `mission.vanIntro` each frame, which is always freshly created or absent, so nothing can go
    stale across a zone change).
  - Added the open rear cargo door to the actual in-game van sprite — it only existed on the
    title-screen art before; the real `drawProp` van had no door gap at all. It's a permanent dark
    cutout in the side-shade band, always drawn regardless of intro state, so it's already "open"
    for a fast re-entry when leaving (exit itself is still untouched by design — instant, no
    animation).
  - Verified live with a 24-sample trace at 50ms resolution across the full ~0.96s sequence: van
    position confirmed fast-then-decelerating through drive (2180->2023 in the first 0.4s) with a
    visible ±5-unit wobble during skid (256->261->258->254->255) before snapping exactly to rest;
    `screeched` flips true right at the skid boundary; `hidePlayer` flips false and `settled`
    fires (with a 16-particle smoke burst) at the exact moment the van reaches its rest position;
    player then eases smoothly from the van's coordinates to their final standing spot over the
    emerge phase (1968->1960->1951->...->1928); `mission.vanIntro` clears itself on schedule.
    Screenshots confirmed the sequence renders correctly with no visual corruption at multiple
    points in the timeline. 0 console errors.
- **2026-09-14g — A real getaway: the van peels back out on exit, and bowls over anyone in its
  path.** User: "Would a getaway animation be do-able? If anyone is in the way it'd be fun to
  bowl them over." Exit was previously left instant/unanimated on purpose (mirroring the arrival
  intro's design), but this reframes it as its own moment rather than a bare utility action.
  - Hooked into the actual raid-exit trigger — pressing E while standing at the van/exit rect, in
    `tryInteract()` — rather than `leaveMission()`/`quitToTitle()`'s menu-driven exits, which stay
    instant on purpose (those are administrative shortcuts, not "getting in the van"). `beginGetaway()`
    dives the player into the van (hidden the same way as arrival, reusing the same
    `playerVisualAlpha()` hook), then `mission.vanGetaway` runs a single accelerating beat (0.9s,
    ease-IN — slow off the mark, speeding up as it peels out) back along the exact line it arrived
    on, continuing past the original arrival point and off into the distance. Tire smoke bursts
    continuously behind it; the screech now doubles as a tire-spinning-up-before-it-catches sound.
  - The "bowl them over" part: every tick, any `enemies` entry (civilian or hostile alike — no
    exemption, matching the dark-comedy tone) within 34 units of the van's current position that
    hasn't already been hit takes a real `damage()` call — 45 damage, a knockback of 520 (well
    above any weapon in the game, so it reads as the single hardest hit available), a "BOWLED
    OVER!" popup, and a burst of pale dust — then gets marked so the same actor can't be hit twice
    as the van continues past. Ordinary civs/street enemies go down in one hit; a boss or bruiser
    would survive it, same relative toughness as everywhere else.
  - One real bug caught before it shipped: the completion branch originally called
    `enterZone('village')` directly inline once the getaway finished — but that runs from inside
    `updatePlayer()`, itself called from `step()`, and `enterZone` immediately clears `enemies`/
    `props`/etc., which anything still queued later in that same `step()` tick would then read as
    already-reset. Deferred it through `setTimeout(..., 0)` instead, the same pattern
    `leaveMission()` already relied on for exactly this reason.
  - Verified live: spawned a 30hp civilian dummy directly in the departure path, triggered the
    real exit interaction, and traced the sequence at 50ms resolution. Van position confirmed
    genuine acceleration (2588 total units covered in 0.9s, position deltas growing throughout);
    the dummy took exactly 45 damage on the first pass (30hp -> -15, dead) and was never
    double-hit on later ticks despite the van continuing past it for several more frames; the zone
    cleanly flipped to village once the sequence finished, with no corruption or errors. 0 console
    errors on a fresh tab.
- **2026-09-14h — Population rearchitected (per-chunk, not player-chased); van smashes through
  people/walls on arrival too; fire actually spreads through buildings and sets people alight;
  a real ranged water gun with a wet status; water + electricity → chained electrocution.** A
  six-part request in one message. In priority/dependency order:
  - **Population, for real this time.** Two earlier passes (2026-09-13d/e) kept tuning the
    proximity top-up's radius/target and still left a visible edge cluster, because the mechanism
    itself was the problem: `spawnEnemy('civ')` always placed new arrivals near the player's
    CURRENT position, so "here" was perpetually being topped up while everywhere else thinned out
    — a moving bubble, not a spread city. Removed the step()-level top-up entirely and moved
    ambient-civilian seeding INTO `genCityChunk()` itself (a coin-flip per generated chunk: ~50%
    get 1, ~20% get 2, else 0 — pushed to `pendingCiv` exactly like building occupants already
    are), so population is baked into the world as it's explored, the same way its buildings and
    streetlamps already are, instead of being conjured near wherever "now" happens to be. Verified
    live: 47 civilians across a fresh city entry with distances to the player ranging smoothly
    118-1722 units (sorted list shows no clustering at any one band) — a categorically different
    distribution than the old ring-shaped pileup.
  - **Van smash on arrival.** The getaway's "bowls over anyone in the way" (2026-09-14g) only
    covered leaving. Factored the collision logic out into a shared `vanSmash(x, y, hitSet)` —
    bowls over any enemy within 34 units (45 dmg, knock 520, "BOWLED OVER!") AND now also damages
    any solid wall cell within a 5×2 neighborhood of the van's current position (`damageCell`, 55
    dmg/tick) — and calls it from both the arrival's drive+skid phases and the departure, so the
    van can genuinely plow through people or a wall on the way in, not just the way out. Verified:
    a dummy placed directly in the arrival drive-in path took the same 45-damage one-hit kill as
    the departure test.
  - **Fire that actually spreads and is worth noticing.** Two problems: fire could only ever
    catch on `tree`/`stump`/`dump` props — vanishingly rare downtown — and there was no persistent
    "on fire" status, so standing in a fire hazard only hurt while inside it. Added `FLAMMABLE_MAT`
    (WOOD/PLANK_WALL/DOOR/FENCE/STICK — not brick/concrete/fieldstone/glass) and extended the
    spread search to also target nearby flammable WALL CELLS, burning through them via
    `damageCell` over several seconds until they collapse to empty — a wood-built house can now
    genuinely burn down wall by wall. Also raised spread frequency/chance/cap (0.4→0.55 chance
    every 0.8-1.3s instead of 0.9-1.9s, cap 26→40) so it reads as a real spreading fire instead of
    an occasional ember. Added a persistent `_burnT` status (shared `tickBurning()` for player and
    enemies): ignites with a per-second chance while standing in fire OR on a direct hit from any
    fire-hitFx weapon (torch/flamethrower/flaregun, which previously didn't ignite anyone at all),
    deals DOT, and — for enemies — overrides their normal AI with a directionless panicked
    scramble until it burns out or kills them. The player keeps full movement control while
    burning (DOT + visuals only — taking away control for a status effect felt like the wrong call
    for the one actor a real person is driving). Verified live: a fire hazard placed next to a
    confirmed WOOD wall cell burned it from `MAT.WOOD` to `MAT.EMPTY` in 4 seconds; a directly
    ignited dummy in open ground showed genuine erratic movement (position samples zigzagging, not
    a straight line) while HP ticked down each frame to death on schedule.
  - **A real water gun, and water/electricity interaction.** The existing "Fire Hose" weapon was
    `kind:'melee'` (swing it like a bat) with a cosmetic 'water' hit-splash — never an actual
    sprayer, which is exactly "fire hoses don't shoot water." Added `WEAPONS.watergun` (a proper
    `kind:'gun'` entry reusing the existing bullet pipeline — real projectile, `projCol` for a
    blue blob, `hitFx:'water'`) and re-routed the AI/roster name-matcher (`hose`/`water gun`
    /`squirt gun`/`super soaker`) to compile to it instead of the old melee stats. Getting hit
    applies `_wetT` (a soaked status, shared `tickWet()`), which drip-particles and decays on its
    own, and doubles as "water puts out fire" — a wet actor's `_burnT` is snuffed immediately
    (with a "hiss!" popup) rather than needing to wait it out. Made it actually obtainable in a
    normal run: smashing a HYDRANT prop (already existing city street furniture) now bursts with a
    spray, soaks everyone within 60 units, and drops a real Water Gun pickup. For the "cool
    interactions" ask specifically: `weaponFx`'s existing per-element hit-effect dispatcher (fire/
    water/spark/ice/slime/acid/oil, already shared between melee and guns) got a `spark` case that
    checks the target's wet status — hitting a soaked target with anything electric (`hitFx:
    'spark'`, e.g. the existing Cattle Prod) now chain-electrocutes to every OTHER wet actor within
    100 units via a new `electrocute()` (18 dmg + stun each, a visible spark-particle arc between
    each link, capped at 6 links so a fully soaked crowd can't cascade forever) — soak a group
    first, zap one, watch it spread. Verified live end-to-end: fired the water gun at a fresh
    dummy and confirmed `_wetT` set to 6 with real damage from an actual travelling bullet (not a
    synthetic hit); confirmed a burning dummy's `_burnT` dropped to exactly 0 the instant `_wetT`
    was set; equipped the (real, base-game) Cattle Prod, wet two nearby dummies, hit only one, and
    confirmed BOTH took the expected 18 electrocution damage — the second one only reachable via
    the chain, since it was never in the prod's own melee arc.
  - 0 console errors across every test and an 8-second unattended normal-play smoke test with
    everything active at once.
- **2026-09-14i — More electric weapons, and the real cause of "reoccurring characters with
  limited weapons" found and fixed.** Two asks: add electric weapon variety, and investigate
  whether faction/weapon variety is actually working — the user had noticed the same characters
  and a narrow weapon set showing up repeatedly and asked directly whether it was broken.
  - **New electric weapons.** `WEAPONS.zapstaff` (melee, Zap Staff — the visual head already
    existed in the drawing code from an AI-roster-only weapon that was never a real base item),
    `WEAPONS.taser` (a proper ranged gun, `hitFx:'spark'`), and `WEAPONS.teslagren` (thrown —
    lands and drops a new `HAZ.spark` hazard, a lingering electrified patch). All three route
    through the existing `weaponFx` dispatcher, so they automatically get the water/electricity
    chain-electrocution built last session for free — no per-weapon wiring needed.
  - **The actual cause of "reoccurring characters, limited weapons," found by reading the
    generator, not guessing.** `spawnRaidFaction()` (the squad guarding a raid's objective — up to
    12 enemies) had every single grunt: (1) the exact same enemy TYPE — 100% `f.elite`, no mix;
    (2) the exact same fixed shirt/pants hex colour, via `tintFaction` literally overwriting each
    one's individually-rolled colour with one flat value; (3) drawn from a pool of only 4-5 weapons
    per faction theme, with a 34% chance of the single "signature" weapon on top of that. Regular
    street thugs (outside the raid-objective squad) were less affected — `applyGruntWeapon` only
    touches 45% of them and never calls `tintFaction` — but the climactic fight of every single
    raid was, structurally, up to 12 near-identical clones. Fixed all three: widened every faction's
    `grunts` pool from 5 to 7 (folding in the new electric weapons where thematically apt — taser/
    zapstaff for the lawful/industrial factions, watergun for the marsh gang, trout for the coast
    gang) and dropped the signature-weapon bias 34%→20%; `tintFaction` now applies a small
    per-enemy `_tone()` lightness jitter to shirt/pants instead of one fixed value (the boss keeps
    the true canonical colour, staying visually the one to watch for); `spawnRaidFaction` now rolls
    each elite's type independently (72% the faction's own elite type, 28% one of the other two
    civilian archetypes — 'cop' stays exclusive to garrison/capital so an outlaw gang never gets a
    stray officer mixed in).
  - **A real, unrelated bug found along the way**: standing directly in a thrown fire or gas
    hazard has been dealing **zero actual damage** — `addHazard()` never copied a hazard type's
    `dps` field onto the spawned instance (only `r`/`life`/`life0` were), and every hazard's
    `tick(h,a)` reads `h.dps`, not the definition's own — so `h.dps` was `undefined` and
    `a.hp -= undefined * dt` silently produced `NaN` forever, with no visible symptom besides the
    hazard just not hurting anyone standing in it. This has nothing to do with the faction/weapon
    variety question — found only because testing the new `spark` hazard surfaced the same latent
    flaw fire and gas already had. Fixed by copying `dps` onto the instance in `addHazard` like the
    other static fields already are.
  - Verified live: `genFaction('railhub',...)`/`genFaction('marsh',...)` calls confirmed 6-7 item
    pools including the new electric weapons in thematically fitting factions; a full
    `spawnRaidFaction()` run against a real campaign node (forcing a fresh, uncached faction)
    showed a genuinely mixed elite squad (6 gunner + 1 bruiser in one trial), 7 distinct shirt
    colours (all variations of the base hex, boss kept the canonical one), and weapons correctly
    drawn from that faction's own widened pool (previously an earlier check against a STALE cached
    faction object gave a false alarm — resolved by forcing a fresh `genFaction()` call and
    re-verifying, a reminder to check for stale cached state before concluding something's broken).
    Zapstaff/taser/teslagren each independently confirmed to deal damage and apply their status
    (stun / `hitFx:'spark'`) via real fired shots, not synthetic hits. The `dps` fix verified by
    placing fresh dummies directly in real fire/gas/spark hazards and confirming actual (non-NaN)
    damage for the first time; the wet+spark electrocution chain re-verified working correctly on
    top of the fix. 0 console errors across every test plus an 8-second unattended smoke test.
- **2026-09-14j** — the previous entry's faction/weapon-variety fix didn't touch the ACTUAL source
  of "same clown guys in the buildings, same fireman with a hose that doesn't shoot water": that
  complaint comes from `DEFAULT_ROSTER`/`roster.js`, a completely separate, static content system
  (used for named building occupants + the AI-generated-NPC street mix-in) that `FACTION_THEME`
  (raid guard squads) never touches. Two concrete bugs found and fixed there:
  - "Fire Marshal" (`DEFAULT_ROSTER.enemies` id `fireman`) had `weapon:'fire-hose'`, a roster-only
    weapon spec hardcoded `kind:'melee'` — so it swung the hose like a bat and never sprayed
    anything, regardless of the real ranged `WEAPONS.watergun` built a few entries back. Fixed by
    pointing `fireman` straight at `weapon:'watergun'` (a base-table id, resolved fine since
    `compileActorSpec` checks the real `WEAPONS` table, not just the roster's own weapon list) and
    deleting the now-dead `fire-hose` roster spec.
  - "Same clown guys in the buildings": of the 7 named "place" templates that existed across
    `DEFAULT_ROSTER` + `roster.js` (the only content `pickCityPlace` can hand a building, 55%
    chance per lot), exactly ONE had hostile occupants at all — `roster.js`'s `haunted-midway`,
    hardcoded to `['carnival-barker','clown-carny','sideshow-illusionist']`. Every building the
    player ever found enemies inside was, unavoidably, that exact trio. Fixed by adding 4 new
    `DEFAULT_ROSTER` places (chop-shop, gym, bookie office, biker hideout) drawing on the
    non-circus enemies added last entry, plus giving the existing civ-only `depot` a hostile
    occupant too — takes hostile-occupant places from 1 to 6, spread across 5 different enemy
    types instead of the one carnival set.
  - Verified live via the in-game Roster/Generator Lab debug panel (`window.__G()` + spawning
    `fireman` from the ENEMIES list): compiled fireman actor now carries `weapon:'watergun'`,
    `ammo:99` (gun-kind, confirmed via `compileActorSpec`'s gun-ammo branch); on-screen it visibly
    fires a stream of blue water pellets at the player, who picks up `_wetT:6` from the hit — the
    full ranged-spray-plus-wet-status pipeline working end to end, not just a data change.
    `window.__G().ROSTER` also confirmed 11 total places (was 7), 6 hostile-kind ones (was 1), and
    no roster-validation warnings (all new occupant ids resolved cleanly).

- **2026-09-14k** — bullet overhaul + Legacy screen locked to between-campaigns only.
  - Every gun bullet drew identically: `drawBullet` was one hardcoded `fillStyle = '#ffe38a'` plus a
    5x5 `fillRect`, regardless of weapon — a water gun, a nailgun and a plain pistol all fired the
    same yellow square. Replaced with `bulletVisual(wp, weaponId, from)` (spawn-time, not per-frame)
    picking a shape+colour primarily off `hitFx` (fire/ice/water/slime/acid/spark — the same tag
    `weaponFx` already uses for hit particles, so it covers every gun, built-in or
    AI-classified/roster, automatically) plus a few id/head overrides for guns without a
    distinctive hitFx (nailgun, bubblegun, gluegun, dartgun). `drawBullet` renders 10 real shapes:
    a water droplet with highlight, a wobbling slime/acid blob, a flickering flame teardrop, an ice
    crystal, a spark zigzag, a needle-tipped dart, a nail, a soap bubble, a sticky glue drop with a
    drip tail, and a plain tracer bolt for everything else. Water and fire bullets also trail faint
    particles in flight so they read as a spray, not a dot. Wall-impact sparks now tint to the
    bullet's own colour instead of a fixed orange. Thrown grenades (`drawGrenade`) got the same
    treatment per `grenId`: molotov is now a bottle with a lit rag wick, gas grenade a canister with
    vent slits, tesla grenade a charged orb with a bolt across it, bolas two weighted balls on a
    cord, singularity a dark orb warping a faint ring — previously every thrown weapon was the same
    coloured square with a white highlight strip (still the fallback for anything unlisted).
  - Found and fixed a real bug while verifying: `RS.gunHeads` (validateWeapon's head whitelist,
    separate from the `GUN_HEADS` table itself) was never updated when watergun/taser were added —
    so any DYNAMICALLY discovered water gun or taser (debug spawner, an AI-named item, anything not
    pulled straight from the static `WEAPONS` table) was silently downgraded to a plain pistol at
    validation time, with no warning. Only the STATIC `WEAPONS.watergun`/`WEAPONS.taser` entries
    (e.g. the DEFAULT_ROSTER fireman fix from the previous entry) were unaffected. Added both to
    `RS.gunHeads`.
  - Verified live: discovered a fresh "super soaker" via the debug weapon spawner, confirmed via a
    tight in-page polling loop (avoids network round-trip timing races with 1.1s bullet lifetimes)
    that it now resolves `style:'water'` and the canonical blue `#7ab8e0` — before the RS.gunHeads
    fix it silently came back as `style:'bolt'` with a random palette colour. Screenshotted the
    actual spray of blue droplet bullets arcing from the player mid-fire.
  - Separately, user flagged that the Legacy panel (spend/equip permanent meta-perks) was a plain
    village hotkey (L) — freely reachable any time you were home, which meant respeccing your
    equipped perks between every single raid of the same campaign, not just between separate
    campaigns. Restricted `toggleLegacy` to exactly two doors in: a new "Legacy" button on the
    title screen (between campaigns — works pre-game since none of `loadLegacy`/`unlockTrait`/
    `toggleEquip`/`buySlot` touch `player` or `zone`), and a new mandatory stop the instant a
    country is conquered (`closeWinScreen`, shared by the win screen's Continue button and Escape
    so neither can skip past it) — `legacyForced` marks that second case so the panel can open
    outside the village without reopening the door for everything else. Removed the L hotkey and
    its mentions in the on-screen control hints. Legacy points/unlocks still persist through
    `wipeSave` exactly as before (Legacy was always meant to survive a "New Game" wipe) — only the
    respec timing changed. Verified live: L no longer opens anything mid-game; the title screen's
    Legacy button opens/closes cleanly pre-game; forcing `showWinScreen()` on a live session chains
    straight into a Legacy panel labelled "the campaign is over — set your loadout for next time"
    with a "Continue" (not "Close") footer button, and clicking it correctly resumes unpaused
    gameplay in the village.

- **2026-09-14l** — water puddles, ice-freeze-to-statue, and a round of elemental combos.
  User: water guns should leave persistent puddles (dried up by nearby fire), ice should freeze a
  wet target solid and leave a breakable ice-statue corpse if they die frozen, and "feel free to
  work through all the weapons and add fun combinations."
  - **Puddles**: new `HAZ.puddle` (effectively infinite life, `tick` just keeps re-wetting anyone
    standing in it). `spawnPuddle(x,y,r)` merges into any existing puddle within range instead of
    stacking a fresh hazard on every single watergun tick (it fires every 0.11s), and caps the
    total count the same way fire spread already does. Wired into every place a water bullet's
    journey can end: hitting an actor (`weaponFx`'s water case), hitting a wall or a solid prop, and
    fizzling out mid-air with nothing hit — plus hydrant bursts now flood a big permanent puddle
    under the intersection instead of just a one-off splash. `updateHazards`'s fire branch now
    scans nearby hazards each tick: any puddle close to an open flame gets force-dried (life cut to
    ~0.6s with a hiss of steam) instead of sitting there forever.
  - **Freeze**: new `_iceFrozenT` status + `tickFrozen(a,dt)` (hooked into both `updateEnemy` and
    `updatePlayer`, early — zero velocity, no AI/attacks, occasional ice-mote particles, until it
    thaws). `weaponFx`'s `ice` case now checks the target: wet → `freezeActor()` (hard freeze,
    clears the wet/burn status, refreshes on a re-hit), burning → extinguish (ice puts a fire out
    same as water), dry → just the existing cosmetic burst. Kept `_iceFrozenT` a separate field from
    the pre-existing `_frozenT` (Time Bender's Time Stop active ability) on purpose — same
    "can't act" idea, two unrelated triggers, would have silently fought over one field otherwise.
  - **Ice statues**: dying while `_iceFrozenT>0` (enemies only) now branches `killActor` into
    `spawnIceStatue(t, loot)` instead of the normal blood/corpse/immediate-loot path — a real prop
    (`mkProp(...,'icestatue')`, solid, fixed, 46 hp, `PROP_MAT` 'glass' so it already gets icy-blue
    hit sparks for free) carrying the kill's weapon/cash drop as `_frozenLoot`, deferred until
    something actually shatters it via the normal `hurtProp` pipeline — melee and bullets already
    hit props for free, no new hit-detection needed. New `drawProp` case renders a translucent blue
    icy glaze over a faint silhouette in the victim's own skin/shirt/hair colours, with crack lines
    that thicken as it takes damage. The original corpse's `corpseT` is set to 9 so the existing
    8-second corpse-cleanup sweep removes it almost immediately — it lives on as the statue now, not
    a second overlapping body. A fire hit on a frozen-but-still-alive target shatters them free
    early instead of igniting them (thermal shock), rather than just extinguishing like a normal
    wet target would.
  - **Bonus combo**: gas + an open flame now actually ignites — `updateHazards`'s fire branch scans
    for nearby `gas` hazards and detonates them (`explode` + a fresh fire hazard where the cloud
    was) instead of the two just quietly coexisting forever.
  - **Bullet visual**: water bullets are now noticeably bigger with a short trailing stream and a
    two-tone highlight/shadow, instead of the same-size dot every other bullet style uses.
  - Verified live via new debug hooks added to the Roster/Generator Lab's `window.__G()._fn`
    (`killActor, hurtProp, freezeActor, spawnPuddle, spawnIceStatue, addHazard, weaponFx`, plus a
    `hazards` getter — same purpose as the `attack`/`damage`/`explode` hooks already exposed there):
    confirmed a frozen enemy holds position for the full duration and thaws cleanly; confirmed
    killing one while frozen produces exactly one new `icestatue` prop carrying the deferred loot
    and sweeps the old corpse immediately; confirmed shattering the statue drops that loot and
    removes the prop; confirmed two `spawnPuddle` calls near each other merge into one (not two
    overlapping hazards); confirmed a real puddle placed near a live fire hazard gets force-dried
    within a second; confirmed firing the actual in-game `watergun` at a wall through the real
    input pipeline (not the debug hook) produces a real merged puddle; confirmed fire on a frozen
    target clears `_iceFrozenT` to 0 while fire on a merely-wet target still just hisses out
    (`_burnT` stays unset) and fire on a dry target ignites normally; confirmed ice on a burning
    target extinguishes it; confirmed a gas cloud next to a fresh fire hazard is consumed and
    replaced by a real fire hazard (the explosion). Screenshotted the ice statue rendered in-world
    next to the player.

- **2026-09-14m** — the big city-chaos update: environmental chain reactions, weather with real
  gameplay effects, commandeer-any-car, moving hazard props, systemic wanted/faction escalation,
  and a handful of set-piece props. User asked for a brainstormed list to be built "all except
  stampede and riot trigger" — everything below shipped and was verified live via new debug hooks
  added to `window.__G()._fn` (killActor, hurtProp, freezeActor, spawnPuddle, spawnIceStatue,
  addHazard, weaponFx, enterCar, exitCar, maybeSpawnTurfWar, lightningStrike, updateSpecialProps,
  wanted get/set, wantedTier, keys, updatePlayer, a `hazards` getter and a `drivingCar` getter —
  same purpose as the attack/damage/explode hooks already there).
  - **Environmental chain reactions**: lampposts are now destructible (hp 26, was 9999) and spark a
    real hazard where they fall — a downed power line; a new real, breakable `manhole` prop (35%
    per city chunk, separate from the purely cosmetic manhole texture baked into the ground art)
    ruptures into a genuine environmental gas source on destruction; oil is now a real spreading
    hazard — a totalled car leaks a 3-point oil trail away from the wreck, and `updateHazards`'
    fire branch now ignites gas OR oil hazards it gets close to (bigger blast for gas, a racing
    fuse for oil), and separately burns through any nearby `web` hazard in a second, freeing
    whatever it had rooted; `freezeActor` checks for a nearby `glue` hazard and freezes far longer
    (11-15s instead of 2.6-3.6s) if the target was already stuck fast; `HAZ.singularity`'s `end()`
    now eats every other hazard within its pull radius before popping, scaling the explosion by how
    many it swallowed.
  - **Weather with real effects** (built on the existing `weather`/`wind` ambience system, not a
    parallel one): heavy rain now actually wets outdoor actors and seeds real puddles over time; a
    new `heat` mode (22% chance instead of rain when a clear spell ends) dries the city out —
    existing puddles quietly evaporate and fire spreads 60% more readily; the existing lightning
    *flash* now triggers a real `lightningStrike()` — zaps a wet actor outright (chains via
    `electrocute`), otherwise blows out a nearby lamppost, otherwise cracks down on open ground,
    always dropping a real spark hazard; wind (already simulated for ambient litter) now biases
    fire-spread direction downwind and drifts thrown grenades off-target mid-flight during gusts.
  - **Commandeer any parked car**: E near any parked `car` prop hops in (`enterCar`/`exitCar`) —
    full manual WASD control with a real turn-in feel, smashing through enemies and damaging solid
    cells exactly like the raid van's own arrival cutscene (reuses `vanSmash`), the player sprite
    hidden the same way the van intro already hides it, ramming a wall damages the car itself, and
    getting wrecked out from under you ejects you. Cars are now destructible (hp 220, were
    indestructible) — hitting one without killing it trips a car alarm (`markWanted`, a real "someone
    saw that" heat spike, once per car); killing one detonates it and chain-detonates any other car
    within 110px of the blast.
  - **Moving hazard props** (`updateSpecialProps`, a new per-frame pass, city-only): a wrecking ball
    (rare, 8%-of-8% per chunk) swings on a chain from a fixed pivot and hits hard on contact; a
    traffic car patrols a fixed lane along a chunk's road band and runs down anything in its path
    (own hit-tracking Set, same "don't hit the same target every single frame" pattern `vanSmash`
    uses); a cement mixer sprays a `glue` hazard on a timer.
  - **Systemic escalation**: a 5th wanted tier at 97+ heat calls in real "SWAT" — responders spawn
    tougher (+60% hp), hit harder (+25% dmg), and are recolored in dark tactical gear, layered on
    the *existing* wanted-response spawner rather than a parallel system. Spontaneous turf wars
    (`maybeSpawnTurfWar`, city-only, one at a time, ~1-2 min cooldown) spawn two small rival crews
    already squared off against EACH OTHER away from the player — required teaching `enemyTarget`
    and `attack()`'s melee foe-list to recognize a shared `_turf` tag (previously hostile enemies
    could only ever target the player or player's own squad, never each other); ignore it, loot the
    wreckage after, or wade in. Copycat civilians: an unprovoked civ near an exotic dropped weapon
    (water gun, taser, teslagren, molotov, bubble gun, glue gun, nailgun, flaregun, sheep launcher,
    singularity grenade, freeze ray, slime gun, acid spray, flamethrower, bolas — deliberately not
    the plain bat/pipe/pistol the ordinary "provoked civ fights back" path already covers) has a
    small chance to just pick it up and turn hostile with it.
  - **Set-piece props**: a fireworks stand, knocked over, keeps launching real mini-explosions
    every 0.35-0.6s for ~4.5s instead of popping once (`HAZ.fireworks`, no actor-tick — the damage
    is real `explode()` calls on a timer, same pattern fire's own spread logic uses); a kennel,
    broken, sends every nearby hostile fleeing in fear for a few seconds (reuses the existing
    Hypnotist-perk `_fearT` field rather than inventing new animal AI/art); a neon sign — real props
    now, attached to any place generated with `sign:'neon'` — crashes straight down for real area
    damage when its mount gives out.
  - Every new prop type registered across `PROP_MAT`/`PROP_HP`/`PROP_DIM`/`PROP_SORT_LIFT`/
    `PROP_NONSOLID`/`FIXED_PROP` and given a real `drawProp` case: manhole, firework, cementmixer,
    kennel, neonsign, wreckingball, trafficcar.
  - Verified live: destroyed a lamppost/manhole/car/kennel/firework/neonsign directly via the new
    `hurtProp` hook and confirmed each one's real payoff (spark hazard, gas hazard, chain explosion
    + 3-point oil trail, `_fearT` on a nearby dummy, a still-ticking `fireworks` hazard, real damage
    to a nearby dummy); confirmed a car alarm fires on a non-lethal hit and wanted actually rises;
    confirmed a manually-placed wrecking ball/traffic car/cement mixer each did their thing over 60+
    simulated ticks (killed a dummy, ran over a second dummy, produced a glue hazard); confirmed
    `wantedTier()` resolves to the real SWAT tier at 98 heat; force-spawned a turf war and confirmed
    both the enemy-vs-enemy melee AND the `enemyTarget` retargeting actually connect (a rival's HP
    dropped from a melee swing that would previously have been silently ignored since hostile
    enemies could never damage each other in melee before this); confirmed `lightningStrike()`
    zaps a pre-wetted dummy for real damage and drops a spark hazard; drove a commandeered car
    dead-on into a dummy and confirmed exactly one real hit registered, then exited cleanly.

- **2026-09-14n** — car-driving pass 2, after real hands-on feedback on the commandeer-a-car feature.
  - **Real car steering**: replaced the "direction = whatever the input vector points" controller
    with an actual throttle/steer model — W/S accelerate/brake-then-reverse along wherever the car
    is currently pointed, A/D only turn while it's actually rolling (turn rate scales with speed,
    and reversing flips which way A/D swings the back end, same as backing up a real car).
  - **Fixed the instant-exit bug**: the E press that gets you IN is still physically held down for
    a normal keypress duration, and the driving branch's own exit edge-check had nothing to stop it
    reading that same held key as a fresh press — booted you straight back out almost every time.
    `enterCar` now marks that key as already "seen" and adds a 0.35s grace period before the exit
    check is even allowed to fire.
  - **Ramming has real cost now**: a new `carRam` (the player-driven equivalent of `vanSmash`,
    which stays untouched for the raid van's own scripted cutscene) costs the car real HP and
    bleeds off its speed proportional to what it hit — recklessly plowing through a crowd now beats
    up your own car, it isn't free. Walls still give a little at any speed, but genuinely breaking
    through takes real speed behind it, same as smashing enemies/props does.
  - **Explosion warning**: a car under 35% HP now smokes, sparks, and flickers, plus a one-time
    "that's gonna blow!" — real warning before a low-hp car actually detonates (see last entry's
    car-chain-explosion), instead of it just going off with no notice.
  - Slowed the top speed down (320→200 forward, -150→-95 reverse) — it read as too fast to react to
    anything.
  - **Visual rework**: cars now draw with a dark "skirt" offset straight down the screen underneath
    the coloured top face (the same z-lift trick every other prop in the game already uses for a
    bit of isometric height) instead of a flat rotating silhouette that read as a boat. Also fixed
    the shadow: it used to be `drawProp`'s generic flat, unrotated rectangle, which very obviously
    didn't turn with the car — cars now draw their own shadow inside the same rotated transform as
    everything else. `trafficcar` now shares the exact same shape/paint-job system (`drawCarShape`,
    `CAR_COLORS`) instead of its own simpler one-off look.
  - Dropped the "You get out" flash entirely for a normal exit; kept a small popText (not a big
    screen banner) only for being violently thrown clear when the car gets wrecked out from under
    you, since that one's still worth a beat.
  - Verified live: held E through the entry press and confirmed the car does NOT immediately kick
    you back out; drove a car in open ground and confirmed accel/max-speed/turning-only-while-
    moving all behave correctly with the new numbers; rammed a dummy at speed and confirmed the car
    itself lost real HP and speed (not just the target); confirmed a low-hp car sets its one-time
    warning flag; screenshotted four cars at different facings/colors side by side showing the
    tapered nose, distinct paint jobs, and the new isometric depth.

- **2026-09-14o** — real lag fix (hazard draw had zero view-culling), plus arrival crowding and a
  shrunk exit zone, all from a live screenshot with the game's own F8 perf overlay turned on
  (frame 34.9ms / step 2.5 / draw 24.0 — confirmed the bottleneck was specifically in drawing, not
  simulation).
  - **The real bug**: `drawHazards()` had never been view-culled, unlike every other per-frame
    draw list (props/pickups/actors all skip anything off-screen). Harmless when hazards were
    short-lived fire/gas puffs, but puddles (added recently, near-permanent, up to 22 scattered
    across the whole explored city as you fire a water gun) meant a growing number of full
    `createRadialGradient` repaints happening every single frame regardless of whether any of them
    were anywhere near the screen. Fixed with the same bounding-box cull (padded by each hazard's
    own radius) everything else already uses.
  - **Arrival crowding**: `populateCityStreets()` (the one-time street-life seed fired the instant
    a raid begins) called `spawnEnemy()` with no explicit position for all ~14-20 of its
    thugs/bruisers/gunners/cops/civs. `spawnEnemy`'s no-position default rings things just past the
    edge of *current view* — the right call for topping up a block as you walk through it, but
    wrong for a one-time burst fired the instant you step out of the van, when "current view" IS
    the arrival spot. The entire street population landed in a ring immediately surrounding the
    player on arrival — instantly crowded, instantly hostile. New `spreadCityPoint()` scatters
    hostiles across the whole city, comfortably outside arrival view (civs a bit closer, since
    they're harmless) — preserved the existing "gang buddy" flavor spawn via an explicit
    `allowGang` flag since that logic used to key off "no position was given" and would otherwise
    have silently stopped firing.
  - **Exit zone**: `mission.exitRect` used to be `edgeExitRect()` — a full 1.5-chunk-wide strip
    along the *entire* entry edge, so you could trigger the leave prompt from almost anywhere along
    that whole side of the map, nowhere near the van. It's now a small 150×150 area centered
    exactly on the van's actual parked position, computed once that position is known (the glowing
    dashed exit-strip visual already just draws `mission.exitRect`'s bounds directly, so it shrank
    to match for free — no separate visual fix needed).
  - Verified live: forced a fresh raid entry and measured every hostile's distance from the
    player's actual arrival point — closest was 1030 units (was landing in a ~600-900 unit ring
    right on top of the player before); confirmed `mission.exitRect` is now a 150×150 box centered
    exactly on the van's real position; re-placed hazards both near and far from the player after
    the culling fix and confirmed nearby ones still render normally (a fire's glow, rain, etc. all
    still show correctly on screen).

- **2026-09-14p** — weapon variety, cop/SWAT visibility, wanted-response actually firing, and
  set-piece props rare enough that a whole playthrough could miss every single one.
  - **"almost all the enemies had bats"**: real cause, found by reading `makeActor`'s base weapon
    assignment (not the faction-override system fixed a few entries back, which only ever applies
    45% of the time) — bruisers had a flat 60% chance of 'bat' no matter what, and thugs put 46% of
    all rolls into just 'pipe' or 'bat' before ever reaching the varied pool. Widened both into one
    flat pool each (bruiser: bat/sledge/springfist/zapstaff/trout; thug: pipe/bat plus the existing
    7-item varied pool, all equal odds) and gave cops a taser option alongside pistol/pipe.
  - **"I didn't see police come for me"**: a real, separate bug from the SWAT-tier work a few
    entries back — the wanted-responder spawn cap counted EVERY cop/bruiser/gunner alive anywhere,
    which double-counts the ambient street population `populateCityStreets()` already seeds at
    raid start (2-3 cops plus several bruisers/gunners baked into that same initial mix). A normal,
    populated block could already be sitting at or over the response cap before a single dedicated
    responder ever spawned — wanted going up basically never visibly called anyone in. Responders
    now get their own `_responder` tag and only THEY count against the cap.
  - **"give them badges... same with swat"**: cops (and the SWAT variant) are a base type with no
    hat/parts system of their own, so they were only ever distinguishable by shirt colour — easy to
    lose in a crowd mid-fight. Added a dark cap band + a gold badge glint on the chest for regular
    cops, and a flat tactical visor instead of the badge for `_swat`.
  - **"didn't see [wrecking ball/pet shop/etc]... no moving hazards"**: the 5 set-piece prop kinds
    (firework/kennel/cementmixer/wreckingball/trafficcar) shared one 8% per-chunk roll, split 5
    ways — 1.6% per kind per chunk. Over a typical raid's worth of exploring (10-20 chunks) the
    expected count of any ONE kind was well under 1, so seeing none of them in a whole playthrough
    wasn't bad luck, the odds meant you basically never would. Raised the shared roll to 35% (7%
    per kind per chunk) — each kind should now average roughly one appearance per raid.
  - Verified live: spawned 40 bruiser/thug enemies and tabulated weapons — 'bat' dropped to 6/40
    (15%) across 15 distinct weapon types, versus the old 60%-bat floor; forced wanted+an actively
    "seeing" enemy for 9 real seconds and confirmed a real `_responder`-tagged, `mad`, actively
    hunting cop spawned (0 before, 1 alive after — this reliably failed before the cap fix, capped
    out by the ambient population alone); screenshotted a spawned cop showing the new cap+badge
    clearly.

- **2026-09-14q** — village window height, and a real fix for "screen stuck on the village while
  I can hear the city."
  - **Windows sitting low, half-buried in the wall**: the south-face window pane was drawn
    floor-to-ceiling from the wall's base, so most of it read as wall trim rather than an actual
    window at head height. Raised and shortened it (top edge now pokes a couple px above the
    wall's own top edge instead of sitting flush) with the sill following wherever the shorter
    pane's bottom lands. Verified live by placing a test wall+window and screenshotting it.
  - **"the image is still of the village but I can hear stuff in the city happen"**: real bug,
    found by reading how `draw()` is wired into the main loop rather than by reproducing it
    directly (extensive stress-testing — full 49-chunk city gen, every set-piece prop type, all
    weather modes, lightning, turf wars, car entry — never once threw). `draw()` renders the
    entire frame onto an offscreen half-res canvas across ~450 lines, then blits that buffer to
    the VISIBLE canvas in one `drawImage` call roughly two-thirds of the way through the
    function — and the whole function sits inside the main loop's `try/catch(err){
    console.error(err) }`. Any exception ANYWHERE in that first ~450-line stretch (which is
    exactly where all the new city-chaos rendering — weather, cars, hazards, set-piece props —
    lives) aborts the function before the blit ever runs. The visible canvas then simply keeps
    showing whatever the LAST successful frame was — e.g. the village, if the very next draw
    after entering the city started throwing — while `step()` (protected by its own half of the
    same try/catch) keeps simulating and making noise every frame regardless. Never found the
    exact triggering condition (likely a narrow edge case in the city-chaos code this session
    added), but the failure MODE itself is now fixed at the source: that whole offscreen-render
    stretch is wrapped in its own try/catch that logs full details to
    `window.__RORDrawErrors` (persistent, unlike the console tool this session already proved
    unreliable on long-lived tabs) and — critically — still falls through to the blit
    afterward, so the visible screen always shows the current frame (even if a few draw calls
    partway through got skipped) instead of freezing on a stale one from a different zone.
    Verified live: reproduced the exact failure mode by injecting a forced throw partway through
    that block and confirming the screen kept updating and the error landed in
    `window.__RORDrawErrors`; then re-ran the full 49-chunk/all-set-pieces/weather/lightning/
    turf-war/car stress pass against the real (non-forced) code with zero entries logged.

- **2026-09-14r — the actual "me and the buildings keep disappearing" trigger, caught live via the
  `window.__RORDrawErrors` logging added minutes earlier in this same session.** User reported it
  mid-raid, in the rain, at 16/160 HP; checked the log immediately instead of trying to reproduce
  blind, and it had already caught 20+ identical errors that frame. `drawProp`'s `'trafficcar'`
  branch called `drawCarShape(w, h, col, dmg)` — but `drawCarShape`'s real signature is
  `(w, h, facing, col, dmg)`. Missing the `facing` argument shifted every parameter after it one
  slot to the left: the color object landed in the `facing` param and the damage NUMBER landed in
  the `col` param. `col.body` on a number is just `undefined` (no throw yet), which then got
  handed to `_tone()` → `_hex2()` → `undefined.slice(...)` → real crash, every single frame any
  `trafficcar` was on screen. Because this happens partway through the same offscreen actor-draw
  pass fixed in 2026-09-14q, it aborted everything queued to draw AFTER that one car for the rest
  of that frame — the player included — hence "me and the buildings keep disappearing" (they
  weren't invisible, they just kept losing their turn to draw, frame after frame, for as long as a
  traffic car was in view). The `'car'` branch (parked/driven cars) passed all 5 args correctly and
  was never affected. Fixed the call to pass `0` for facing (the caller already does its own
  `octx.rotate()` for lane direction before calling in, same as the working `'car'` path expects
  the rotation done by its own internal `facing` param instead). Verified in a separate background
  tab (not the user's live one, to avoid disrupting their in-progress raid): re-rolled city seeds
  until a `trafficcar` spawned, ran 15 full draw passes, zero entries in `window.__RORDrawErrors`,
  screenshotted the car rendering correctly alongside the player and buildings.

- **2026-09-14s — arriving in the city could make you Wanted before you'd done anything.** User:
  "there's always a bunch of NPCs hanging around my spawning area... the car will always hit them
  and start me off as Wanted." Real bug, two separate wanted-raising code paths both fired off the
  raid van's own scripted arrival smash (`vanSmash`, the drive-in/skid/emerge cutscene bowling over
  anyone standing in its path) — a collision the player has no control over, unlike a real
  commandeered-car ram (`carRam`, untouched, still raises wanted same as always):
  1. `damage()`'s civilian branch calls `markWanted(true)` on ANY hit to a civ, `vanSmash` included
     — it never distinguished a scripted, unavoidable hit from a real player swing.
  2. `killActor()` separately calls `markWanted(true)` (plus a score penalty) whenever the victim
     was an innocent, non-hostile civilian — a completely separate path, so a bystander killed
     outright by the van (very possible: `vanSmash` deals 45, most civs only have 30 hp) raised heat
     even once (1) was addressed.
  Added a `noHeat` flag threaded through both `damage()` and `killActor()`; `vanSmash` now passes
  it so the physical-comedy "BOWLED OVER!" beat (and, grimly, the odd death) stays consequence-free
  — no wanted, no score hit — same as any other cutscene event nobody chose to trigger. Verified
  live: piled 4 civilians directly on the scripted van's path, let the real intro sequence play out
  via the exposed `tick(n,dt)` debug hook (not a mocked shortcut), confirmed 3 died and `wanted`
  stayed at 0 throughout — then, as a control, had the player directly kill a civilian normally and
  confirmed `wanted` still jumped to 16 (both the "hurt" and "kill" heat stack, unchanged from
  before), proving the fix is scoped to the scripted collision only, not a blanket disable.

- **2026-09-14t — the roaming `trafficcar` set-piece was undersized, off the road, and
  invincible.** User: "what's with that tiny little red car? It should at least stick to the roads
  and react to impacts the same as a regular car." Three separate real issues, all in the code that
  spawns/handles it (`genCityChunk`, `PROP_HP`/`PROP_DIM`, `hurtProp`) — the driving/rendering logic
  itself (shared with the parked `'car'` prop via `drawCarShape`, `updateSpecialProps`) was fine:
  1. **Undersized**: spawned at `28×16` versus a parked car's `64×30` — well under half scale.
     Widened to match; its 34px hit-radius in `updateSpecialProps` already assumed a car-sized
     target; only the sprite was wrong.
  2. **Off the road**: its lane was `oy + RD*PS + 30` — but `RD*PS` (48 world px) IS the full width
     of the road band along that edge (see `bakeCityGround`), so `+30` past that landed the car 30px
     PAST the road, into the sidewalk/building lot beyond it. Centered it in the band instead
     (`RD*PS*0.5`).
  3. **Invincible**: `PROP_HP.trafficcar` was `9999` (same bucket as the wrecking ball/campfire —
     genuinely indestructible set dressing) and none of the car-specific `hurtProp` branches (alarm
     chirp on first hit, "that's gonna blow!" warning, the totalled explosion + oil trail + chain
     detonating nearby cars) checked for it, only the literal `'car'` type. Set its HP to 90 (same
     as parked cars) and widened all three `p.t === 'car'` checks to `(p.t === 'car' || p.t ===
     'trafficcar')`, including the chain-detonation target filter so a parked car and a traffic car
     can now set each other off.
  Verified live: generated chunks until a `trafficcar` spawned, confirmed `[64,30]` dims and a
  y-offset of exactly 24 world units from its chunk's edge (dead center of the 48-wide road band,
  versus 78 — 30px past it — before the fix) and `90/90` hp; `hurtProp`'d it to death directly and
  confirmed it died, left oil hazards, and matched a real car's destruction; screenshotted it
  full-size and correctly seated on the road next to a building.

- **2026-09-14u — retired `trafficcar` entirely; replaced it with NPC-driven parked cars.** The
  fixes one entry up were real, but the user reported it was STILL "a tiny clown car driving
  underneath a wall" — turned out that tab just hadn't reloaded (confirmed live: the props still
  had the old `28×16` dims), but rather than keep patching a bespoke, fixed-lane, bounce-between-
  two-points implementation that had now needed three separate rounds of bug fixes, the user
  proposed something better: "Would it be easier to have a regular driveable car that has an NPC
  driving that I can just kick out? It'd be funny if they try running away and crash through a
  building or a crowd in their panic." Yes — it lets the whole feature ride on the ALREADY-correct
  parked-`'car'` spawn (kerb-hugging via `sidewalkSpot`, correct 64×30 size, correct 90 hp,
  already-working alarm/explosion/chain-detonate reactions) instead of a second, parallel car
  implementation with its own copy of everything to get wrong.
  - Removed `'trafficcar'` from `genCityChunk`'s 5-way special-prop pick (now a 4-way pick among
    the other four kinds) — its supporting draw/HP/dim code is left in place but nothing spawns it
    anymore, so it's inert rather than ripped out (lower risk than surgery across a dozen call
    sites for a type nothing creates).
  - Parked `'car'` props now get `_driver = true` 35% of the time.
  - Calm carjack (walk up, press E): the driver bails out on foot, panicked (`_fearT`, the same
    flee-AI a Hypnotist-spooked enemy already uses), no fuss, no chase — the point of "I can just
    kick out" the driver.
  - Attack an occupied car instead: the driver panics WITH the car — new `_panicking` state, added
    to a new short-lived `panicCars` list (same pattern as `specialProps`/`warningCars`), driven by
    a new `updatePanicCars(dt)`. Reuses the exact wall-collision math from the player's own driving
    branch in `updatePlayer` (crash through weak walls, bleed off speed and real hp, scaled by
    speed) and `carRam` for anything solid or alive in its path, plus a direct run-over check
    against the player (things `carRam` doesn't cover, since it's built for player-driven cars).
    Heading eases toward "away from the player" every 0.3-0.6s with wide random jitter so it reads
    as swerving in a panic, not calmly navigating — a wall hit sends the next heading close to
    random too, like a caroming panicked driver rather than a clean bounce. Since it's a plain
    `'car'` prop underneath, dying (from crashing or being shot at) triggers the exact same
    explosion + oil trail + chain-detonation as any other car, with zero extra code.
  - Verified live end-to-end: confirmed driver assignment (1 of 4 parked cars, on one chunk-gen
    pass) and zero `trafficcar` spawns across a full 49-chunk city; calm-carjack tested directly
    (driver's `_driver` cleared, a fleeing civ with `_fearT` set appeared at the car's spot, player
    ended up in `drivingCar` pointing at that exact car object); panic-trigger tested directly
    (`_driver` cleared, `_panicking` set, pushed onto `panicCars`); ran the real update loop via the
    exposed `tick(n,dt)` hook for several continuous seconds — car drove, crashed into walls (hp
    dropped from repeated impacts), zero entries in `window.__RORDrawErrors` or a native
    `error`/`unhandledrejection` listener throughout.

- **2026-09-14v — driving into fire barrels (and other props) at low speed did nothing.** User:
  "some objects still don't react when I drive into them, like fire barrels or other objects at
  slow speeds." Real bug in `carRam` (the function behind a player-driven car actually damaging
  what it hits — added this session for the commandeer-a-car feature): the call site gated the
  whole function behind a flat `Math.abs(car._speed) > 110` check — out of a 200 top speed, that's
  over half throttle just to get ANY reaction at all; anything gentler drove clean through a fire
  barrel, a hydrant, a crate, with zero effect, not even a shove. On top of that, `carRam`'s own
  `_hit` de-dupe (there to stop a stationary car pinned against something from re-dealing damage
  every single frame) never cleared once something was added — so even a single accidental graze
  above the 110 threshold made that object permanently immune to that car for the rest of the
  drive, no matter how hard you rammed it again later.
  - Lowered the gate to `12` (barely more than idle creep) and had `carRam` take a `speedFrac`
    (0.15-1, scaled off the car's actual current speed against its own top speed) that scales the
    damage/knockback dealt — a crawl now dents things a little instead of nothing, a full-speed hit
    still deals the original full damage, unchanged.
  - Rewrote `_hit` tracking from "everything ever touched" to "only what's touching RIGHT NOW,
    rebuilt fresh every call" — back off and ram something again later and it reacts again, instead
    of the first graze using up its one reaction forever.
  - Applied the identical fix to the new panic-car flee AI from the entry above (same `carRam` call,
    same 110-style flat gate it had copied) — and while touching it, gave the player-run-over check
    there its own separate one-shot field (`_ranOverPlayer`, cleared once contact breaks) instead of
    piggybacking on `carRam`'s own `_hit` set, which the fix above now rebuilds from scratch on every
    call — sharing it would have reset the "already hit the player this pass" flag out from under
    itself and re-triggered RUN OVER every single frame of contact instead of once.
  - Verified live: a controlled slow bump (speed 20, well under the old 110 gate) into a fresh
    60-hp fire barrel dealt real damage (60 → 53.25) where it previously did nothing at all; drove
    away under real physics and back again and it took a second, independent hit (46.5 → 34.125),
    confirming the de-dupe no longer sticks forever; confirmed a fast, sustained ram against a
    stationary player-adjacent panic-car still only registers the RUN OVER hit once (hp held flat
    across 20 straight frames of contact), not once per frame.

- **2026-09-14w — three more, from one message: cars still drove through objects at low speed, the
  arrival van could make a bystander cop hostile, and turf wars visibly popped into existence.**
  - **"I can still drive through objects if I'm moving slowly enough instead of the object halting
    my vehicle"**: the previous entry fixed the DAMAGE side (a slow hit doing nothing) but missed
    that driving never checked solid PROPS for physically blocking movement at all — only
    `cellSolid` (walls). A fire barrel, crate, or hydrant-post could never stop a car at any speed;
    it just (maybe, now) took some damage while the car sailed straight through. Added
    `carBlockedByProp` — the prop equivalent of `cellSolid`, matching how a walking actor's own
    movement already respects solid props (`moveActor`) — wired into both the player's driving
    branch and the panic-car AI's movement, right alongside the existing wall check. Surfaced a
    follow-on bug while verifying it: `carRam`'s own contact box used flat pads (`pr.w/2+30`,
    `pr.h/2+18`) instead of the car's real size, so a car could come to a physical stop right at the
    edge of something without ever crossing into carRam's (smaller, size-blind) damage box —
    meaning it would halt against an object while never actually damaging it. Widened carRam's box
    to match `carBlockedByProp`'s (+4px slack) so "physically touching" and "damage-eligible" agree.
  - **"the entrance van smashed through a wall summoning the police"**: the 2026-09-14s fix made
    vanSmash's `noHeat` flag suppress `markWanted` for a civilian it bowled over, but the SAME
    function's `else` branch — for any NON-civilian it hits (a cop, thug, gunner, bruiser standing
    in the arrival path) — set `t.mad = true` completely unconditionally, no `noHeat` check at all.
    A cop caught in the van's path went instantly hostile regardless. Gated that branch behind
    `!noHeat` too (and did the same for the civilian branch's own 50%-chance "picks up a weapon and
    fights back" roll, which had the identical gap) — a scripted, no-fault hit now never makes
    anyone come out swinging, civilian or not.
  - **"make the turf wars appear off screen... they seem to pop into existence out of nowhere"**:
    `maybeSpawnTurfWar` picked a spawn point 280-440 units from the player — a flat guess from when
    this was written, well inside the actual view radius (~420-620+ depending on window size, per
    `Math.hypot(VUW,VUH)/2`, the same formula `spawnEnemy`'s own off-screen ring already uses).
    Swapped the flat range for that same view-radius-relative formula, so a turf war now starts
    somewhere the player couldn't plausibly already be looking, same as an ordinary enemy spawn.
  - Verified live: traced a car's distance-to-barrel every frame approaching at a real "slow" speed
    (throttle held just long enough to reach ~90 before impact) — it now visibly decelerates and
    locks to a fixed stopping distance instead of sailing through, and (after the carRam box fix)
    the barrel takes real damage in the same pass (60 → 40.8) instead of zero; isolated the van
    intro to just its own movement code (no other AI running) and confirmed a cop caught in its
    path stays `calm` with `wanted` at 0 throughout; forced `maybeSpawnTurfWar` past its cooldown
    repeatedly and confirmed every spawn landed 597-616 units out against a measured ~462 view
    radius — comfortably off-screen.

- **2026-09-14x — the player briefly reappeared for a frame or two after the getaway van drove
  off.** User: "after the car drives off home the player reappears for a moment or two." Real bug
  in `beginGetaway`'s completion: once the drive-off animation finished, the code immediately did
  `mission.vanGetaway = null` and only THEN scheduled `setTimeout(() => enterZone('village'), 0)` —
  a deferred call that doesn't actually run until at least the next event-loop tick. But
  `playerVisualAlpha` (what keeps the player invisible during the getaway) checks
  `mission.vanGetaway` directly — nulling it immediately made that check start passing again right
  away, so the player popped back into view for however many frames passed before the deferred
  `enterZone` actually fired and the village loaded in. Stopped nulling it out early: the object now
  stays alive (with a `done` flag so the pending `enterZone` doesn't get scheduled again every
  subsequent frame) until `enterZone` itself replaces `mission` wholesale, which is also the exact
  frame the zone actually flips — so there's no longer a gap where the check can pass early.
  Verified live: drove the real getaway sequence frame-by-frame with an actual yield to the event
  loop after each tick (so the real `setTimeout` could fire exactly when the browser would normally
  run it, not simulated) and confirmed `mission.vanGetaway` stayed truthy for all 78 frames until
  the precise frame `zone` flipped to `'village'` — never false while still in the city.

- User also reported "those tiny cars" needing removal in favor of NPC-driven hijackable cars —
  that system (drivers on 35% of parked cars, calm carjack ejects them on foot, attacking one makes
  them panic-drive and crash) already shipped in 2026-09-14u, one message earlier. Checked the
  user's actual live tab directly and confirmed it's still running pre-2026-09-14u code (no
  `updatePanicCars` in scope at all) — this is the same "hadn't reloaded yet" situation as a few
  messages back, not a new ask. No code change needed here; flagged for the user to reload.
  - **Important process discovery while investigating this**: the "CityDebug" profile created
    early in this session for disposable testing turned out to be the ONLY profile with any saved
    data at all — "Player 1" (the default profile) had zero data under it the entire time. Every
    screenshot of real progress the user sent this whole session was on "CityDebug", meaning it was
    never actually disposable — it's the user's real, only save, just under a name I picked for
    testing. Reloaded the user's live tab directly (safe moment — they were in the village, not
    mid-raid) to finally get all of this session's fixes into their actual game, and clarified the
    naming mix-up so they don't get confused continuing on it.

- **2026-09-14y — police tasers could stunlock the player with zero chance to ever break free.**
  User: "those police tazers are great, but they completely disable you... so you get stuck to the
  point where you can't escape at all. Maybe add a random chance for you to not get frozen in place
  after each hit." Real bug: `WEAPONS.taser.onHit` set `t.stun = 1.0` (a full second) on literally
  EVERY hit, unconditionally — and `player.stun > 0` (checked in `updatePlayer`) blocks ALL player
  input outright, not just attacking, returning early before any movement keys are even read. The
  taser fires at `rate:0.5` (twice a second) — since 1.0s of stun outlasts the 0.5s gap before the
  next shot, a cop that keeps a bead on the player can chain hits forever with the stun NEVER
  reaching zero, a genuine, complete, inescapable lock exactly as described. Added a 40% chance per
  hit to only stumble (a much shorter 0.3s stun, safely under the fire-rate gap) instead of the full
  freeze — some hits still land the complete lock, so it's still a real threat, but no longer a
  guaranteed unbreakable one.
  - Verified live (on a genuinely isolated test profile — see the process note above; this session
    learned the hard way that separate browser tabs still share the SAME localStorage, so a
    "disposable" test profile isn't actually isolated unless it's a different profile ID entirely):
    ran `WEAPONS.taser.onHit` 200 times fresh and confirmed a ~40/60 split between the short and
    full stun, matching the intended odds; then simulated a worst-case cop landing every single
    shot at the taser's actual 0.5s fire rate for 15 straight seconds and confirmed the player now
    gets genuine windows of free control (~10% of total time) that were mathematically impossible
    (0%) under the old unconditional 1.0s stun — and real play, with misses and movement, should do
    better than this worst case.

- **2026-09-14z — the player could stay invisible after their own car explodes, and enemies chased
  in straight lines through walls even with a door right there.** Two unrelated asks in one message.
  - **"when cars explode my character stays invisible"**: real bug in the driving branch's own
    guard. `playerVisualAlpha` hides the player with a flat `if (drivingCar) return 0` while
    commandeering a car — correct while it's alive, but the branch that's supposed to eject the
    player and clear `drivingCar` the moment the car dies (`if (car.dead) exitCar(true)`) only ever
    ran from INSIDE a guard that required the car to still be ALIVE just to enter the block at all
    (`if (drivingCar && !drivingCar.dead)`). A car that died from something outside that same
    branch's own control — overwhelmingly a NEARBY car's chain-detonation (see 2026-09-14t's
    explosion code, which can set off other cars in the blast radius) rather than the one you're
    actually driving crashing itself — left `drivingCar` pointing at a dead car forever, with
    nothing left to ever clear it: invisible, permanently, exactly as described. Restructured the
    guard so a dead `drivingCar` is caught and ejected FIRST, on the very next frame regardless of
    cause, and hardened `playerVisualAlpha` itself to check `!drivingCar.dead` too as a second,
    independent layer — belt and suspenders, since the visibility check and the state-cleanup check
    were two different bugs that happened to produce the same symptom.
  - **"enemies chasing me still seem to just travel in a straight line towards me — even through
    walls when a door is right next to them"**: real gap, not a bug in existing code so much as a
    missing feature — a hunting enemy that loses line of sight to its target (an interior wall,
    almost always) had no route-finding at all: `steerAvoid`, the only wall-reaction an ordinary
    enemy had, is a single 26px probe straight ahead that just veers by a fixed angle (and half the
    time takes a swing at the wall to try to smash through) — no memory, no actual seeking of the
    opening that's usually a few steps away. Added a small, bounded A* (`findPath`) over the same
    cell grid `cellSolid` already uses — so a door, which `cellSolid` already treats as a plain open
    cell, just falls out of the search as a normal walkable route, no special-casing needed. Scoped
    deliberately small to stay cheap with many enemies active at once: a 32×32-cell (~512×512 world
    px) box around the seeker, capped at 900 expanded nodes, and — the actual expensive-case
    guard — it only ever runs at all when line of sight is genuinely blocked (`canSee` was already
    computed every frame for aggro; an enemy that can already see its target never touches any of
    this, so the common open-street case costs nothing extra). Recomputed at most every 0.5–0.9s
    per enemy (staggered) rather than every frame, and only while chasing (`e.mad`/engaged) with
    sight actually blocked — patrol, wander, and flee behavior are untouched. Falls back to the old
    direct-line behavior if the target is out of the search box or genuinely unreachable, so nothing
    gets stuck standing still.
  - Verified live: hand-traced the actual generated wall layout of a real city building (an ASCII
    dump of `cellSolid` around its door) to build a genuinely blocked enemy/player pair rather than
    guessing coordinates; confirmed `findPath` returns a route where every single waypoint is a real
    walkable cell and every step between consecutive waypoints is a legal adjacent move (no cutting
    through solid geometry); then spawned a real hostile enemy in that exact blocked configuration
    and ran the actual game loop — confirmed it picks up a path (`hasPath: true`) and closes real
    distance (96 → 69 world units in half a second) while blocked, instead of stalling or grinding
    against the wall, correctly handing back off to normal combat AI the moment it rounds the corner
    and regains a clear line of sight.

- **2026-09-14aa — cops and other hostiles seemed to know exactly where the player was even
  indoors, behind walls.** A direct, real consequence of the pathfinding fix one entry up, not a
  separate bug in old code: `findPath` was routing a blinded pursuer to the target's LIVE, current
  position the whole time it couldn't see them — meaning the more capable the new pathfinding got at
  actually reaching that position (through a door, around a corner), the more it looked like the
  enemy always knew exactly where the player currently was, walls or not. Added a proper "last
  seen" memory: `e._lastSeenX/Y` is only updated while an enemy genuinely has line of sight
  (`canSee`), and the moment sight is lost, both the pathfinding target AND the direct-line fallback
  switch to that remembered spot instead of the target's live position. An enemy that reaches where
  it last actually saw the player, with still no sight, now mills around searching in place rather
  than somehow knowing where to go next — giving up entirely is still the existing 5-second
  `_loseSightT` timer a few lines up, untouched, now also clearing the memory when it fires so a
  later, fresh spotting doesn't start from a stale position.
  - Verified live: spawned a hostile cop right next to the player (guaranteeing genuine line of
    sight, not just a hoped-for one) and confirmed it recorded the exact live position into
    `_lastSeenX/Y` on first sight; then teleported the player to a different spot fully blocked from
    the enemy's view and ran 5 more real ticks — confirmed `_lastSeenX/Y` stayed frozen at the
    ORIGINAL position throughout, never updating to the player's new (hidden) location, so the
    enemy's route/movement is provably built from stale, previously-witnessed information only —
    never the player's current position while genuinely out of sight.

- **2026-09-15 — four asks in one message: pathfinding "still" not working (a reload issue), real
  doors on city buildings, retired the wrecking ball, and the kennel actually releases pets now.**
  - **"it's still happening"**: checked the user's live tab directly — it had none of this
    session's fixes loaded at all, not even the first one from several messages back (no
    `updatePanicCars` in scope). Reloaded it directly this time (with the user's explicit go-ahead —
    "don't worry about my progress, this isn't a proper game") rather than asking a fourth time.
  - **"put doors on some of these buildings... windows from the village area"**: a city building's
    entrance was never actually a door — `carveRoom` just left a 3-cell gap in the wall (walkable,
    since `EMPTY` was never solid, but with nothing drawn there at all — a bare hole). Changed the
    centre cell of that gap to a real `MAT.DOOR`, the exact same door object/sprite the village
    already uses, via the same function both plain buildings and AI-authored "places" already
    share — so every city building gets one for free, no new code path. `cellSolid` already treats
    `DOOR` as non-solid, so this changes nothing about collision or pathfinding, purely visual. It
    renders in its closed pose (the swing-open animation only ever runs in the village) rather than
    a missing hole, which is what the pathfinding complaint was actually circling — see below.
    Windows: didn't touch these this round — the village's nicer raised-pane window is a separate
    per-tile overlay system (`village.windows`, save-scoped) rather than a wall material, and city
    buildings already have a flatter `MAT.GLASS` storefront pane; wiring the fancier version into an
    ephemeral, unsaved city building is a real separate task, flagged rather than rushed.
    - **Found and fixed a real, PRE-EXISTING bug while verifying this**, unrelated to the fix
      itself: `carveRoom`'s own bookkeeping of where its door actually is (`c.doorWorld`, read
      elsewhere in the game) checked `doorSide < 2` to decide which pair of wall coordinates to use
      — but doorSide 0/2 (north/south) run along the x-axis while 1/3 (east/west) run along y, so
      the correct grouping is `doorSide === 0 || doorSide === 2`, not `< 2`. East- and south-facing
      doors had `doorWorld` pointing at a coordinate sampled from the WRONG axis entirely — nowhere
      near the real opening. The actual door cell placed by `place()` was never affected by this
      (it always used the correct pair inline), only this separate, redundant recomputation. Fixed
      the condition to match.
    - Verified live: cross-checked every generated building's `doorWorld` against the actual cell
      grid — before the `doorSide` fix, only 26 of 45 matched (an almost exact 50/50 split, matching
      "2 of 4 sides broken"); after it, 49 of 49 matched exactly, across a fresh 49-chunk city;
      screenshotted a real door rendering distinctly from the surrounding wall on a live building.
  - **"the construction ball doesn't work... too tiny and there's no crane... remove it for now"**:
    done as asked — pulled `wreckingball` out of the special-prop spawn pool entirely (same
    treatment `trafficcar` got in 2026-09-14u), draw/update code left in place but inert in case
    it's worth rebuilding properly later with an actual crane rig at the right scale. Verified live:
    zero `wreckingball` props across a full 49-chunk city.
  - **"the dog kennel doesn't release any animals"**: real gap — its `hurtProp` branch only ever
    scared nearby hostiles (`_fearT`) with nothing ever actually appearing; "something got loose"
    had nothing to show for it. Added a real payoff: 1-2 small dogs now visibly bolt out and scamper
    off in a wobbly, wall-avoiding wander for 4-7 seconds before vanishing, reusing `drawDog`
    (already built for a civilian dogwalker's leashed companion — just skips drawing the leash line
    when there's no owner). This is NOT the full pet-shop city location the user recalled discussing
    — that would be its own place type with caged animals as a feature in its own right; this only
    fixes the specific kennel prop's payoff. Verified live: destroying a kennel spawned 2 pets that
    moved under their own steering and correctly expired (0 remaining) after their lifespan.

- **2026-09-15b — the new city door was tiny and misaligned, and enemies were still bashing walls
  down mid-chase.** Both real follow-on gaps in the doors/pathfinding work from the entry above.
  - **"it's tiny and aligned incorrectly for the space"**: the wall-drawing code only picks the
    correct door orientation — a normal horizontal opening vs. a 90°-rotated vertical one — by
    checking whether the NEIGHBOURING cell is also a door (the village always builds doors as a
    2-cell pair, so this check always finds one). My single, isolated door cell had nothing to pair
    with, so it always fell back to the horizontal shape regardless of which wall it was actually
    on — correct-looking on a north/south wall, small and wrong-axis on an east/west one, exactly
    what the screenshot showed. Made city doors a real 2-cell pair too (matching the village
    convention instead of inventing a new one), with the door's total gap widened from 3 to 4 cells
    (2 open, 2 door) to fit the pair — `dcOf`'s own margin was tightened by one cell so the pair
    can never land past the wall's actual corner.
  - **"enemies still bash down walls to get me instead of using doors"**: a real, separate leftover
    from wiring pathfinding in — `steerAvoid` (the old single-probe "veer, and 50% of the time just
    swing at the wall" behavior) was still being called UNCONDITIONALLY on the final movement
    direction, even on frames where that direction already came from a real, collision-aware path
    waypoint. The path was correctly routing around the wall; `steerAvoid`'s own independent
    forward-probe just didn't know that; and its 50% wall-attack roll could still fire regardless.
    Now skipped whenever a path waypoint was actually used this frame — it only ever runs for the
    two cases that still need it: a target in plain sight (no path involved at all) and the
    boxed-in/too-far fallback where no path could be found.
  - Verified live: cross-checked every door on a fresh 49-chunk city and confirmed 100% now form a
    real pair (22 horizontal, 18 vertical, zero isolated), up from single unpaired cells across the
    board; screenshotted a door on an east-facing wall specifically (the exact broken case) rendering
    as a correctly proportioned vertical opening; spawned a hostile in a genuinely wall-blocked
    setup, watched 54 solid cells around it for 1.5 seconds of active pathfinding pursuit, and
    confirmed zero of them took any damage — the wall-smashing side effect is gone specifically for
    the path-following case, without touching the two cases that legitimately still use it.

- **2026-09-15c — the "fixed" door still looked broken (floating, disconnected, wouldn't
  open/close), and one more wall-smash leak.** User circled a door sitting away from the wall with
  visible gaps on both sides, and separately: "why not make them the same as the Village doors...
  these don't even open or close." Both real, and both traced back to the SAME leftover: the
  previous fix widened the door's gap from 3 cells to 4 (2 open + 2 door) to fit a proper pair, but
  left the two OUTER cells of that gap as bare open ground either side of the door — which punched
  two extra, unintended holes in the wall right next to the door instead of one clean opening,
  reading as exactly what the user described. Removed the extra flanking cells entirely: the door
  pair now sits FLUSH against solid wall on both sides, precisely like a village door, with no
  gap-widening needed at all (back to a clean 2-cell doorway). Separately wired the actual swing
  animation in: `updateDoors` (the function that opens a door as someone approaches) was only ever
  called from inside the village-only branch of `step()` — nothing about the function itself is
  village-specific, it was just bundled next to other things that are. Pulled it out to run in
  either zone, so a city door now swings open on approach exactly like a village one, instead of
  rendering permanently shut.
  - Verified live: re-checked every door's immediate neighbor cell (not 1-3 away, the actual
    touching cell) across a fresh city and confirmed 45/45 sit flush against real wall material on
    at least one side, up from the previous version's deliberate gap; approached a door directly and
    confirmed a live `doorAnim` entry actively animating open (v: 0.97, mid-swing) — something that
    was structurally impossible before, since the trigger function never ran in the city at all;
    screenshotted the same door mid-open, flush against the wall with no stray gaps beside it.

- **2026-09-15d — the top HUD stat row was too small and half its entries had no idea what they
  meant.** User: "it's really hard to understand and see (since it's tiny) what all the numbers and
  icons stand for." Real, and a genuine inconsistency once looked at directly: the village-supplies
  box right next to it already paired every icon with a text label ("🌾 12 food"), but the row below
  it — money/wood/stick/stone/dirt/sand/clay — was icon-and-number only, no label at all, while the
  Day/Lvl/Wave/Kills/Blocks entries on the SAME row had a label but no icon. Half the row required
  memorizing what a given emoji meant (🥢 for "sticks" is not an obvious pairing) with nothing on
  screen to check it against. Added a text label to every one of those bare icon entries, bumped the
  whole HUD's base font size and the health/XP bar dimensions up modestly (13→14px base, meter
  190→212px wide), and let the stat row wrap instead of running off-screen now that its entries are
  wider. Verified live via a direct screenshot: the row now reads "💰 0 cash · 🪵 0 wood · 🥢 0
  sticks · 🪨 0 stone · Day 1 · Lvl 4" at a visibly larger size, instead of a dense strip of bare
  icons and digits.

- **2026-09-15e — doors confirmed fixed; but pursuers were still nearly impossible to lose.** User:
  "they can't see me but they're not giving up - they can still see me through the wall and they're
  not using pathfinding." They're not actually seeing through the wall or skipping pathfinding by
  this point — `canSee`/`findPath`/last-seen tracking are all working (independently re-verified
  live, again, in this same pass) — but the GIVE-UP condition had its own separate, un-fixed
  omniscience leak: `if (e._loseSightT > 5 && pd > 140){ e.mad = false; ... }` required the enemy to
  be more than 140 world units from the player's LIVE position before it would ever give up, on top
  of the 5-second blind timer. Most rooms are well under 140 units across, so a pursuer stuck right
  outside a wall from the player — the single most common way to actually try to lose someone — could
  rack up an unlimited `_loseSightT` and still never satisfy `pd > 140`, because `pd` is measured to
  where the player actually is, not where the enemy last saw them. It would NEVER give up as long as
  the player stayed nearby, no matter how long it had been genuinely blind. Removed the distance
  requirement entirely — giving up is now purely about how long they've actually been unable to see
  the target, consistent with every other "last seen, not live position" fix already in this system.
  - Verified live, on the user's own save (explicit go-ahead this message: "I don't care if you
    delete the saves or reload however much you like — do whatever works," so testing happened
    directly on it rather than a separate profile): spawned a hostile cop 48 units from the player
    behind a genuinely blocking wall, then pinned the enemy's position every single tick for 6.6
    seconds so `pd` could never rise above 48 — well under the old 140 threshold, exactly the case
    that used to be unrecoverable — and confirmed it still correctly gave up at the 5-second mark,
    proving the give-up no longer depends on physical proximity to the player's current position at
    all, only on how long it's actually been blind.
  - Also fixed, while in there: an out-of-date `active-profile` pointer left over from earlier
    background-tab testing had the title screen showing "Player 1" selected instead of the user's
    actual save — restored, and confirmed the user's real progress (Lvl 9) is intact and correctly
    selected.

- **2026-09-15f — wanted was rising for things the player had no part in at all.** User: "I become
  wanted by police for doing nothing. I think other deaths, damage and injuries all get pinned on
  me." Exactly right, and a much bigger version of the same class of bug the van-arrival fixes
  (2026-09-14s/w) already addressed for one specific scripted case — this time in the two most
  general, most-travelled code paths in the whole game:
  - `damage()`'s civilian branch called `markWanted(true)` on ANY hit to a civilian, full stop —
    never checking who actually landed it. In a city this alive (crossfire from another hostile,
    fire spreading on its own, a panicking driver's car crashing — see 2026-09-14u/v — a
    chain-detonating explosion from 2026-09-14t), a civilian could take damage from a dozen sources
    that have nothing to do with the player, and every single one raised heat as if the player had
    thrown the punch themselves.
  - `killActor`'s civilian-death branch had the identical gap for the (harsher) death case — a
    civilian killed by anything BUT the player still cost the player score and wanted.
  - A third, unrelated source found in the same pass: a copycat civilian autonomously picking up a
    stray weapon lying on the ground (a purely ambient event — nothing checks whether the player is
    even nearby) also unconditionally called `markWanted(true)`, blaming the player for a bystander's
    own unprompted decision.
  Fixed the first two by gating on `from && from.team === 'player'` — the exact same test the
  correctly-behaving call sites (the car alarm, the kidnap-target bonk, the crowd-aggro cascade)
  already used, so this brings the civilian-harm paths in line with every OTHER wanted trigger in
  the game rather than inventing a new pattern. Removed the third `markWanted` call entirely — the
  civilian still turns hostile (a real, felt consequence), it just no longer costs the player heat
  for something they didn't do.
  - Verified live, directly on the user's own save: spawned a civilian and a separate hostile enemy,
    had the ENEMY (not the player) damage and then kill the civilian outright — `wanted` stayed at 0
    through both; as a control, had the player themselves hit a different fresh civilian and
    confirmed `wanted` still correctly rose (0 → 8), proving the fix is scoped to removing false
    attribution, not disabling the mechanic.

- **2026-09-15g — driving "under" steam vents, and re-investigated "no animals from the kennel."**
  - **"I can drive under these steaming floor vents"**: real visual bug, not a collision one — a
    vent is deliberately walkable/driveable (`PROP_NONSOLID`, so people and cars can pass over a
    subway-grate-style vent, which is correct), but its rising steam particles were drawn as a flat
    overlay AFTER the entire y-sorted scene — actors and cars included — regardless of actual
    position, the same shared pass firebarrel/torchpost embers use to float dramatically in front of
    someone standing near a fire. That's fine for embers; for a vent's steam it meant anything
    parked or standing on the vent got a solid-looking column of steam painted over it every frame,
    reading as "driving under" it. Split the shared `drawSteam()` by particle kind: vent steam now
    draws once, early, BEFORE the y-sorted actor/prop pass (so a car or the player on top of it
    correctly occludes it), while embers keep the original on-top timing since that one still reads
    correctly. Canvas draw order is deterministic — later calls paint over earlier ones with no
    frame-timing ambiguity — so this is a straightforward, low-risk fix to verify by reading the
    code, confirmed with a live pass generating real steam at a real vent's position with zero
    render errors.
  - **"no animals are spawned from the kennel"**: re-investigated end to end and could not
    reproduce — this is the same mechanism verified live back when it first shipped (2026-09-14u/v).
    Confirmed again from scratch: destroying a kennel through the actual player `attack()` path (not
    a shortcut) correctly spawns 1-2 `kennelPets`, and separately confirmed the same for `explode()`
    damage (the other realistic way one might get destroyed, e.g. by a grenade or a nearby car
    exploding) — both paths produced real, positioned pets with zero errors. No code change made;
    most likely explanation is the brief 4-7s lifespan making them easy to miss in the middle of a
    raid, or the specific kennel encountered not actually having been destroyed yet. Flagged rather
    than guessed at a fix for a mechanism that's demonstrably working every way it was tested.

- **2026-09-15h — "nothing is fixed" turned out to be a testing-process bug, not a code one.** User
  reported both the vent and kennel fixes from the entry above as still broken. Re-investigating on
  the user's own live tab (per their earlier go-ahead to test directly on it) turned up a Settings
  menu sitting open and a wanted level / kill count that had changed since the last check — meaning
  the user was actively playing that exact tab at the same time this session was running invasive
  live JS calls against it (teleporting the player, forcing attacks, spawning enemies, switching
  zones). Two live scripts driving the same running game at once is its own failure mode entirely
  separate from anything save/profile-related — a kennel attacked while the game happened to be
  paused by the user's own concurrent input, for instance, would look exactly like "nothing
  happens," with no code bug involved at all. Re-ran the exact same kennel/vent checks in a genuinely
  separate background tab this time (not the user's own) and both came back clean — see
  [[feedback_browser_tabs_share_localstorage]] for the fuller lesson. Going forward: read-only
  checks (confirming a fix exists in the loaded code, inspecting current `props`/`wanted`/`zone`)
  are fine directly on the user's live tab, but anything that actually mutates game state belongs in
  a separate tab even when save corruption itself is a non-issue.

- **2026-09-15i — retired the neon sign.** User: "you can remove the neon signs too. They don't seem
  to do anything." It did have a real effect (shoot the mount down and it crashes, hurting anyone
  underneath — `hurtProp`'s `'neonsign'` case), but apparently never read as an interactive target
  to anyone. Unlike the other retired set-pieces, it doesn't spawn from the random `kind` pool —
  `genPlaceInChunk` adds one whenever a place's roster spec has `sign: 'neon'`. Removed that spawn
  call instead of touching the roster data; the supporting draw/hurtProp code is left in place but
  inert, same treatment as the wrecking ball. Verified live, in a genuinely separate background tab
  this time: zero `neonsign` props across a full 49-chunk city, no errors.

- **2026-09-15j — ambient traffic, and an angry ejected carjack victim.** User: "the NPC vehicles
  drive well. Could you make a few drive around the map? Also when hijacked can you make the driver
  get thrown out angry."
  - **Ambient traffic**: added `updateAmbientTraffic`, sharing its entire movement/collision model
    with `updatePanicCars` — same accel curve, same `carBlockedByProp`/`cellSolid` wall handling,
    same `carRam` — just wandering toward a picked destination (found via `findPath`, the same A*
    a chasing enemy uses) instead of fleeing the player, and a little calmer about it (130 vs 165
    top speed) since this is meant to read as normal traffic, not someone in a panic. A few parked
    cars now spawn already out driving instead of sitting at the kerb — capped at
    `AMBIENT_CAR_CAP = 3`, deliberately much lower than the existing `CAR_CAP = 4` overall car
    limit, so "a few" stays a few. Still a plain `'car'` prop underneath: the player can hop into
    one at any time through the existing `tryInteract` check, no special-casing needed — the only
    addition was a `car === drivingCar` guard in `updateAmbientTraffic` so the AI stops steering
    the instant the player takes over, instead of fighting them for the wheel.
  - **Angry ejected driver**: the calm-carjack eject (2026-09-14u) used to spawn a fleeing,
    scared civilian (`_fearT`). Replaced with a real "thrown out" beat: the ejected civ now gets an
    actual toss (a real outward velocity, ~220 units/s, plus a brief stun so they visibly tumble
    before getting up) instead of just materializing, and comes up `mad`, armed (`type: 'thug'`,
    a random melee weapon), and aggressive (`aggro: 380`) instead of running off — angry dialogue
    lines to match. The player still ends up driving the car either way; this only changes what the
    person they took it from does next.
  - Verified live, in a separate background tab: confirmed ambient cars spawn at the correct size/hp
    (matching a regular parked car) and cover real distance under their own steering (~200-250 world
    units in 5 seconds); confirmed the player can commandeer one via the ordinary interact check and
    that it correctly stops being AI-driven the instant they do (still exactly where they left it a
    second later, not fighting the input); confirmed a calm carjack now produces a real outward toss
    (~220 units/s), a stun, and a `mad`/armed/aggroed civilian with no fear timer set at all.

- **2026-09-15k — the "floor grates" and kennel complaints, 5th report.** User: "For the 5th time.
  The kennel still does nothing and I can still stand behind the floor grates," with a screenshot
  pointing at a small dark grated rectangle on a city road.
  - **Floor grates — found the real bug.** The city ever since had TWO visually near-identical
    grate-like things: the real, interactive `vent` prop (steam, already fixed for z-order on
    2026-09-15g), and a second, completely unrelated "drain grate" — one of six random cosmetic
    wear textures `bakeCityGround` bakes straight into the ground art (alongside oil stains, cracks,
    worn patches, gravel, puddles). It was never a prop: no collision, no interactivity, no steam,
    by design — pure ground dressing, same category as a crack or a stain. But it rendered as a
    small dark rectangle with vertical grate lines, indistinguishable from the real vent at a
    glance. Every one of the "I can drive/stand on grates and nothing happens" reports was almost
    certainly this — no fix to the real vent's steam or collision was ever going to touch a texture
    that was never meant to do anything. Removed the decorative case from `bakeCityGround` entirely
    rather than re-skinning it, so the only grate-like thing left in the city is the genuine one.
  - **Kennel — mechanism re-confirmed correct yet again**, the fourth independent test approach
    across as many sessions (direct `hurtProp` call, the real `attack()` input path, `explode()`,
    and now a fresh isolated background tab): every single time, destroying a kennel spawns 1-2
    `kennelPets` with zero draw errors. No code bug has ever reproduced. Given that, the next-most-
    likely explanation was visibility, not logic: the pet was an 8×4px flat rectangle alive for only
    4-7 seconds — a couple of screen pixels of movement, easy to miss even while looking straight at
    it, the same "too tiny to read" complaint already raised about the HUD (2026-09-15d). Rebuilt
    `drawDog`'s rendering (body/head as separate shaded ellipses, visible ears, a wagging tail, legs
    that animate with travel direction via `dog.ang`, a dark outline for silhouette against asphalt)
    and extended kennel-pet lifetime from 4-7s to 7-11s at a calmer 55-85 (was 70-110) speed, so a
    released pet reads as a scurrying animal instead of ground texture.
  - Verified live in a separate background tab: confirmed the code loaded (`bakeCityGround`'s old
    grate fillRect string is gone from the served HTML); confirmed a destroyed kennel still spawns
    1-2 pets with the new 7-11s lifetimes; zero draw errors throughout. Discovered along the way that
    backgrounding a test tab lets the browser coalesce a large `requestAnimationFrame` gap into one
    huge `dt` on resume, which briefly warped a pet's position and triggered unrelated world
    systems — harmless (the user's own tab is always focused while they play, so this can't happen
    to them) but noted here as a testing-methodology quirk, not a game bug: background-tab tests
    that need to *watch* something happening in close to real time should stay foregrounded
    throughout rather than backgrounding between steps.

- **2026-09-15l — a real remaining wanted-attribution leak, sparse cars, ejected-driver spawn spot,
  and kennels rebuilt as random-animal releases.** User: "I still feel I'm being framed for crimes
  I didn't commit. Also it's very rare to see cars driving around now... hyjacking the car the NPC
  that gets booted out spawns on the roof... Kennel STILL STILL STILL STILL does nothing. Just make
  it so a random animal appears when it's broken... some are friendly and some are not."
  - **The actual remaining wanted bug**: `damage()`'s civilian branch called `markWanted(true)` on
    *every* hit to a civilian, with no check for whether that civilian had already flipped hostile
    (`t.mad`) and started fighting back. So the one real crime (the first sucker-punch) kept
    re-billing the player on every follow-up hit of an ensuing fight against someone now armed and
    actively attacking them — self-defense kept reading as more crime. Fixed by gating on `!t.mad`;
    only the hit that turns a civilian hostile (or a repeat hit on one still fleeing, not yet
    flipped) raises heat.
  - **Cars felt rare**: `CAR_CAP` (max drivable cars alive at once, world-wide) was 4 — with the
    2026-09-15j ambient-traffic feature also drawing from that same tiny pool, a fully-explored area
    could easily have zero plain, walk-up-and-drive cars in it. Raised to 10, and added
    `PLAIN_CAR_TARGET = 3`: the parked-car spawn loop now guarantees at least 3 plain, unoccupied,
    no-fuss-required cars exist before any of the existing ambient/occupied variety rolls get a turn.
  - **Ejected driver "on the roof"**: the angry carjack-victim (2026-09-15j) spawned at the car's
    exact center (`p.x, p.y`) — visually indistinguishable from standing on the car's own (much
    bigger) sprite for a frame before the toss velocity carried them clear. Fixed by offsetting the
    spawn point itself along the same angle as the toss, so they appear outside the car's footprint
    from frame one, regardless of the car's actual road-relative rotation.
  - **Kennels — stopped chasing the ghost, shipped what was actually asked for**: after four
    independent tests across sessions all confirming the mechanism correct, this pivoted from "find
    the bug" to the user's actual request — a random animal (dog/cat/lion/bear), not always the same
    harmless critter. New `KENNEL_SPECIES` table drives per-species size/color (drawDog now scales
    and recolors one shared silhouette rather than four separate routines, plus a lion mane and
    glowing red eyes on anything hostile) and behavior: lion/bear actually hunt the nearest
    player/enemy within range and land real contact damage on a cooldown, using `from: {team:'wild'}`
    on the `damage()` call so a wild animal's kills never touch the player's own wanted meter or
    kill count attribution — "not friendly" is now a genuine, visible threat, not just a color swap.
  - Verified live in a separate, foregrounded background tab throughout (backgrounding it mid-test
    last time coalesced a huge `dt` on refocus and produced misleading readings — kept it fronted
    this round to avoid that): confirmed 6-9 cars alive at once post-fix vs. the old 4-car ceiling;
    confirmed the ejected driver lands ~24-32px clear of the car's center, not on it; confirmed all
    four kennel species spawn across repeated trials with roughly the intended weighting; confirmed
    a hostile animal actually damages a nearby player (-26 hp from one bear bite in a clean isolated
    check) while `wanted` stays at 0 throughout; zero draw errors.

- **2026-09-15m — the actual kennel bug, finally: wrong coordinate space, not a logic bug at all.**
  User: "The kennel pets are still invisible."
  - After five rounds of "does nothing" reports and four independent tests that all verified the
    spawn/movement/damage logic was correct, the bug was never in any of that — it was in WHERE
    `drawDog` got called for a loose kennel pet. `draw()` sets up a world→screen canvas transform
    once near the top (`octx.setTransform(VS, 0, 0, VS, -camx*VS, -camy*VS)`) and everything in the
    main y-sorted actor/prop pass (including the leashed-dogwalker-companion use of this same
    `drawDog`) relies on that being active, using raw world `x`/`y` with no per-call conversion of
    its own. The kennel-pet draw call, though, had been placed *after* the lighting pass resets that
    transform back to identity (`octx.setTransform(1,0,0,1,0,0)`) — a section that draws everything
    else in already-converted screen space via explicit `vw(x - camx)` math. So every loose kennel
    pet was being drawn at its literal world coordinate as if it were a screen pixel: for any city
    position more than a few hundred units from the map origin (i.e. almost always), that's
    hundreds or thousands of pixels off the visible canvas. It was never a question of the pet being
    "too small" (2026-09-15k's visual overhaul, while a real improvement, was solving the wrong
    problem) — it was 100% invisible, every single time, regardless of size, color, or lifetime,
    because it was never drawing on-screen at all. This also explains why every one of the four
    prior "verified working" tests looked clean: spawning, movement, and damage all live in plain
    game-state, entirely independent of where the sprite gets drawn — there was nothing about draw
    position that a state-only check could ever have caught.
  - Fixed by moving the kennel-pets draw call from the post-lighting-reset screen-space section into
    the main y-sorted pass, right after the actor/prop loop, while the world-space transform is still
    active — the same context the dogwalker's own leashed dog already relied on successfully.
  - Verified live in a separate foregrounded tab by computing the pet's exact expected canvas pixel
    from its world position (`ZOOM * (x - cam.x)`, `ZOOM * (y - cam.y)`) and reading real pixel data
    back from the actual game canvas at that location: 14/1600 sampled pixels matched the dog's exact
    body color at its precise computed position for a normal dog, and 64/3600 matched for a bear —
    both dead-on at the predicted coordinate, not found by eye in a screenshot. Before this fix, the
    same check would have found the pixel search box entirely off-canvas for almost any real-world
    city position, which is exactly what made this invisible in five straight sessions of play.

- **2026-09-16 — lift & throw furniture/animals, TV shocks, rolling barrels, quest variety, and a
  temporary-mutator quest reward.** Brainstormed and built in one pass. User: "It's time to add
  interactable furniture items within the house and the ability to lift and throw furniture and
  items... can't lift and throw the fridge but you can throw crates, being able to throw animals
  would be fun too. I'd like to have TVs cause shocks when broken and to be thrown and the barrels
  and flaming barrels to be throwable. When they land it'll be cool if they roll and explode
  (unless they've hit something)" — plus, separately: more variety for the city civilian-quest
  system (previously just "beat up the marked thug"), and quest rewards that can hand out "a
  temporary sample of the end-game mutators" to make the current run easier.
  - **Lift & throw**: built entirely on the existing `thrownItems` arc-physics system (gravity,
    spin, mid-air NPC hits, landing/slide) that already powered thrown keepsakes and stolen
    "errand" objects — added a `kind:'prop'` variant instead of a parallel system. `LIFTABLE_PROPS`
    (crate, barrel, firebarrel, chair, tv) plus any loose kennel-pet animal can be hefted via the
    existing E-interact (`tryInteract`, checked right after the car-carjack branch) and thrown on
    the same attack button the errand-object throw already used (`p.carrying.isProp` added to the
    existing `wantHit` gate in `updatePlayer`). A fridge/dumpster/etc. was deliberately left off the
    liftable list — "can't lift and throw the fridge."
  - **Landing behavior per type** (`updateThrown`'s new 'prop' branch): a crate/chair/tv breaks on
    impact exactly like it would from a melee hit — a fresh `mkProp` is destroyed via `hurtProp`
    with its own hp as the damage, reusing every existing per-type effect (a crate's chance to drop
    a weapon, TV's glass sound) instead of duplicating them. An animal gets back up: friendly
    (dog/cat) just scurries off again; a lion/bear comes up hunting immediately rather than needing
    to spot someone first. Barrel/firebarrel are the one type that doesn't settle at all — first
    ground contact hands them off to a new `rollingBarrels` list instead.
  - **TV shocks**: `hurtProp`'s tv/arcade branch (previously just a glass-shatter sound) now also
    calls `addHazard('spark', ...)` — the same hazard a downed lamppost already leaves — so a broken
    TV is a real steppable-in danger, not just a sound effect. Applies whether it broke from melee,
    gunfire, or a thrown-and-shattered impact, since all three now funnel through this one branch.
  - **Rolling barrels**: new `rollingBarrels` list + `updateRollingBarrels`. User's spec read as "it
    keeps rolling and blows up on its own after a short fuse, UNLESS it hits a wall/prop/actor
    first, which sets it off immediately instead." Implemented exactly that: rolls with decaying
    friction along the throw direction, checks `cellSolid`/solid props/actors each tick, explodes
    immediately (reusing the same `explode()` call and radius/damage a melee-destroyed barrel
    already used) on any collision, or after a ~2.4s fuse if nothing gets in the way — and shortens
    the fuse to ~1s once it's rolled to a stop with nothing hit, so it doesn't just sit there inert.
    Firebarrel variant keeps the extra fire-particle burst a melee-destroyed one already had.
  - **Quest variety**: the civilian E-interact quest roll now picks between three types instead of
    always "beat up the marked thug" — `wreck` (smash 2-3 marked nearby crates/barrels, completion
    checked once centrally in `hurtProp` right where `p.dead` is first set, so it fires the same way
    regardless of what actually destroyed the marked prop) and `fetch` (find and pick up one marked
    "package" pickup, a new `collectPickup` branch). Falls back to leaving `civ._talked` unset if
    the rolled type isn't available right now (no thug to mark, no crates nearby) so a civilian
    doesn't burn their one chance to ever offer a quest on bad luck.
  - **Temporary mutator reward**: "make that city run easier... a temporary sample of the end-game
    mutators." New `player._tempTraits` list, kept separate from the permanently-Legacy-equipped
    one so a mid-run trip into the perk menu can't wipe it — `applyPlayerPerks` now concatenates
    both when computing stats/hooks, so a temp trait behaves exactly like a real equipped one
    (mods, onDeal, tick, active ability) for the rest of the run, then `clearTempTraits()` (hooked
    into `enterZone`) drops it the moment you leave. ~35% of quests roll a bonus that grants a
    random NOT-already-owned trait via `grantRandomTempTrait` on completion, named in the reward
    banner.
  - Verified live in a separate tab (backgrounding/foregrounding it mid-session produced confusing
    stale-position artifacts again — same lesson as before, worked around by keeping test state
    changes atomic within single script calls): crate lift removes it from the world and hands it
    to `player.carrying`; thrown crate settles and is destroyed via the shared `hurtProp` path;
    thrown barrel converts to a rolling barrel that later explodes on its own; thrown dog/bear both
    re-release into `kennelPets` with the right species/hostile flag, and a released bear actually
    bites (-26 hp in a clean isolated check) with `wanted` staying at 0 throughout; a smashed TV
    adds a `'spark'` hazard; a 2-prop wreck quest completes exactly on the second marked prop dying,
    not the first; a fetch-quest package correctly can't be grabbed while already carrying something
    else (hands full, same as any other carry) and completes the instant it's picked up otherwise;
    `grantRandomTempTrait` adds a real trait to `player._traits` immediately. Zero draw errors
    throughout every check.

- **2026-09-16b — fire barely spread/ignited anything, and carried items rendered as the wrong
  thing entirely.** User: "It's really hard to make things catch on fire - even fire barrels aren't
  exploding and catching things on fire... when items are lifted they become tiny and barely
  resemble the original items."
  - **Firebarrel explosions left no actual fire.** `hurtProp`'s firebarrel branch called `explode()`
    plus a one-off flame-colored particle burst — real damage, real-looking sizzle, but never a
    lingering `'fire'` hazard, so nothing could ever catch from one. Every OTHER "explode" call site
    in the game had this same gap except the one Molotov weapon and gas/oil ignition. Added
    `addHazard('fire', ...)` to both the melee-destroyed firebarrel branch and the new
    thrown-and-rolled firebarrel explosion from 2026-09-16, so a firebarrel going off now leaves a
    real, spreadable fire behind exactly like a molotov's landing spot always did.
  - **Fire spread could only ever catch a tree, a stump, or a dump** — the three prop types that are
    barely present anywhere in the actual city (trees especially). Every OTHER wood prop (crate,
    chair, table, counter, shelf, rack, weaponrack, torchpost, booth's frame...) was silently
    excluded, even though the mechanic's own intent was clearly "wood catches fire." Broadened the
    spread target check from an explicit type list to `PROP_MAT[p.t] === 'wood'`, which is what it
    should have been checking all along — this alone should make fire visibly spread through actual
    city interiors/streets instead of only ever reaching an occasional park tree.
  - **Added a new interaction that didn't exist at all**: a barrel or firebarrel now standing close
    to an active fire hazard detonates on its own (reusing the exact same `hurtProp` destroy path,
    so it gets the same explosion/fire-hazard/chain-reaction treatment as being shot or thrown) —
    checked every ~1s alongside the existing spread timer, but NOT gated behind the random
    spread-chance roll the way ambient fire-creep is, since a fuel drum sitting in open flame igniting
    is a certainty, not a coin flip. This is also what actually makes "fire barrels aren't exploding"
    literal: one now can and will go up on its own from a nearby fire, not only from being attacked
    directly, and can chain into the next barrel over.
  - **Carried furniture/animals rendered as a tiny slumped person.** The over-the-shoulder carry
    draw only ever branched on `c.obj` (an old-style bulky "errand" carry, drawn as a small brown
    box) vs. everything else, which it assumed meant a kidnapped person — so a lifted crate, barrel,
    TV, chair, or animal (none of which set `.obj`) fell straight into the "slumped unconscious
    body" rendering path. Extracted the per-type icon logic already built for `drawThrownItem` into
    a shared `drawLiftedPropIcon(data, scale)`, called from both the mid-air throw AND the
    over-the-shoulder carry pose — a carried barrel now actually looks like a barrel, slung under the
    player's arm, the whole time it's held, not just once it's thrown. Also gave the actual
    kidnap-target carry pose ("same with people if possible") a rounder head and dangling
    limbs/hands instead of two flat rectangles, while still using the target's real skin/hair/shirt
    colors throughout.
  - Verified live in a separate foregrounded tab: a melee-destroyed firebarrel now leaves a real
    `'fire'` hazard at its own position; a plain barrel placed near a manually-added fire hazard
    self-detonated within a few ticks with no melee/gun hit involved; a wood-mat crate placed near
    a longer-lived fire hazard caught (`_burning` flipped true) within the broadened spread check;
    a carried barrel's exact body color was found via direct canvas pixel sampling right at the
    over-the-shoulder carry position, not the old generic-person color. Zero draw errors throughout.

- **2026-09-16c — thrown-item damage scaled by implied weight.** User: "Could you make the items
  do more damage depending on their implied weight? Also small crates should be throwable too - but
  maybe do little damage - only knockback due to them being mostly empty and light."
  - The mid-air direct-hit damage for a thrown prop was a single flat number added on top of a
    shared base (crate/chair/tv all effectively landed around the same 15-25 regardless of what
    they actually were). Replaced with `PROP_THROW_STATS`, a real per-type dmg+knock pair: crate 4
    dmg / 420 knock ("mostly empty and light" — barely hurts, still shoves hard for its size),
    chair 7/380, tv 18/300, barrel & firebarrel 22/340. A firebarrel connecting mid-air now also
    sets whoever it beans alight (`_burnT`, the same catch-fire status standing in a real fire
    already uses) — it's a flaming barrel hitting you, not a regular one.
  - Verified live: threw each type at a fresh dummy enemy and read the actual hp/velocity delta —
    crate 4 dmg, chair 7, tv 18, barrel/firebarrel 22 each, firebarrel additionally left `_burnT`
    set (~3.2s); knockback scaled inversely-ish with weight as intended (crate's velocity change
    came out highest despite lowest damage). Zero draw errors.

- **2026-09-16d — the cement mixer got a real job, ice/concrete get real visuals, barrel colors
  fixed.** User asked what it currently did (answer: almost nothing — an occasional small "glue"
  puddle drips near it, nothing else), then: "make anyone who walks through it be greatly slowed
  down - including yourself for 3-5 seconds. If thrown at enemies (or broken) it'll break and
  splash concrete... if it covers your enemies they turn into grey statues for 10s... when enemies
  are frozen they should turn light blue and transparent like ice. Red barrels are still brown
  while carried and thrown."
  - **Cement mixer, walk-through slow**: added to `PROP_NONSOLID` (it was solid before — "walking
    through it" was physically impossible) and `updateSpecialProps`' cementmixer branch now
    refreshes `slowT` (a real ~58% speed cut) to 3-5s for anyone — player included, no exemption —
    standing within its splash radius, on top of the small ambient glue drip it already did.
  - **Cement mixer, lift & throw & petrify**: added to `LIFTABLE_PROPS`/`PROP_THROW_STATS` (a heavy
    20 dmg / 280 knock mid-air beaning, on the same weight-tier scale as the barrel/TV work from
    earlier today). Its destruction — whether via combat or landing after a throw, same `hurtProp`
    path either way — now bursts a grey splash and calls a new `petrifyActor` on every ENEMY within
    range: a hard, 10-second movement/action lockout (own `_concreteT` field, alongside the existing
    ice-freeze `_iceFrozenT` and Time Bender's `_frozenT`, all independent). Enemy-only, same
    "who caused this" reasoning as every other hazard this session — the player throwing their own
    concrete at someone shouldn't be able to backfire on them.
  - **Frozen/petrified visuals, finally real**: neither status changed how an actor actually
    rendered before this — particles around them, but an ordinary-colored body. `drawActor`'s
    `shirt`/`skin` locals (already threaded through every body-part fill in the function, the same
    mechanism that already flashes an actor white on `hurt`) now check `_iceFrozenT`/`_concreteT`
    first: frozen gets a translucent light blue ("like ice" — carries its own alpha in the color
    string), petrified gets an opaque grey (stone, not glass). Confirmed visually in a screenshot —
    a petrified enemy reads unmistakably pale/grey next to normally-colored sprites nearby.
  - **"Red barrels are still brown"**: turned out the carried/thrown icon (`drawLiftedPropIcon`,
    shared with `drawThrownItem`) and the rolling-barrel draw had both been guessing generic browns
    instead of matching what the two barrel types actually look like sitting in the world
    (`drawProp`): the explosive barrel is a real rust-red drum with a yellow warning mark, the
    firebarrel is dark charred metal with a real flame on top — neither is brown at all. Fixed both
    draw sites to reuse the real colors.
  - Verified live in a separate tab: a thrown cementmixer dealt exactly 20 mid-air damage; smashing
    one petrified a nearby dummy enemy (`_concreteT` set to 10, confirmed decaying correctly to 1
    after 9 real seconds of `updateEnemy` ticks — the lockout genuinely holds, doesn't just flash and
    clear); standing next to an intact one for a tick set the player's own `slowT` to ~3.4s with no
    exemption; a full-canvas pixel scan found the corrected rust-red barrel color actually on screen
    for a carried barrel (my first several sampling attempts missed it purely from picking the wrong
    screen coordinates for the tab's actual canvas size, not a real miss — widening to a full-canvas
    scan resolved it); the petrify tint was confirmed by eye in a screenshot once positioned in
    frame. Zero draw errors throughout.

- **2026-09-16e — cement mixer: solid again, puddle made real and lopsided.** User corrected the
  previous change: "make the cement mixer NOT walkthroughable - but maybe make the cement puddle
  larger - so it's a real hazard, but lopsided, so if you approach it from the right angle you can
  pick it up without walking through the concrete."
  - Removed `cementmixer` from `PROP_NONSOLID` — back to a solid obstacle you go around, not through.
  - The slow hazard is no longer a ring centered on the mixer itself — new `CM_PUDDLE_X/Y/R`
    (offset 34 units to the south, radius 42, up from the old 30-radius circle) puts it off to one
    side on purpose. The ambient glue-drip now spawns inside this same puddle instead of near the
    mixer's own center, and — this is what actually makes "approach from the right angle" possible
    rather than a guess — `drawProp`'s cementmixer case now draws the puddle itself, at the exact
    same offset/radius the slow check uses, so the danger zone is visible, not implicit. The math
    leaves the north side of the mixer dry and still within the normal lift-interact range.
  - Verified live: standing 40 units north of a mixer left `slowT` at 0 (dry, safe) and lifting it
    from there worked normally; standing in the puddle to the south set `slowT` to ~3.7s; a freshly
    world-spawned cementmixer prop's own `solid` flag reads `true` again. Zero draw errors.

- **2026-09-16f — visible quest tracking.** User picked this from the earlier quest-revisit menu:
  a persistent active-objective panel and a way to tell where a quest target actually is, supporting
  more than one active quest at once (previously a single flash banner and then total silence).
  - New `#questlog` DOM panel, sitting just above the minimap — lists every active quest's
    `questLabel(q)` (live: "Smash the marked crates/barrels (N left)" actually counts down as marked
    props die, not just at creation), rebuilt via `updateQuestHUD()` whenever a quest is created,
    completed, or a wreck-quest prop is destroyed. Empty/hidden when nothing's active.
  - `questTargetPos(q)` returns a live position for each quest type — the marked thug's current
    (moving) location for `beat`, the nearest still-alive marked prop for `wreck`, the package
    pickup's spot for `fetch` — and `null` once it's no longer trackable, rather than a stale
    position captured at quest-creation time.
  - `drawMinimap` gets a sky-blue diamond per active quest (one loop, so multiple quests each get
    their own marker), reusing the EXACT clamped-to-the-border-with-a-pointer math the existing
    gold kidnap-target diamond already used — a different color keeps the two families of
    objective visually distinct rather than inventing a whole new waypoint-arrow system from
    scratch.
  - Verified live: pushing a `beat` quest updated the panel and `questTargetPos` correctly tracked
    the live enemy position; a 2-prop `wreck` quest's "(2 left)" line updated to "(1 left)" the
    instant one marked prop died and vanished from the panel entirely on the second, while an
    unrelated still-active `beat` quest correctly stayed listed; confirmed in a screenshot that the
    panel renders cleanly above the minimap during real play. Zero draw errors.

- **2026-09-16g — quieter default music, real genre-per-zone themes, quest rewards became a real
  gamble, rare weapons in safes, and a lasting cement puddle.** User, across two messages: "default
  the music volume to about 15? It's WAY too loud... upbeat rock music when in the city and
  something chill and retro in the village... can the cement mixer leave a big puddle of cement
  after it breaks from being thrown?"; and "add a chance you get a temporary perk as the reward for
  those small city missions — 30% random perk, 30% a rare themed weapon, 40% the money and food
  reward... add rare weapons to the safe too."
  - **Music volume default**: was `0.6` (a fresh profile with nothing in localStorage opened at
    60%) — now `0.15`, matching the slider/label's own static HTML default too.
  - **Real per-zone music themes**, not just a different chord progression: `THEMES.rock` (city) —
    138bpm, a driving G-D-Em-C progression, sawtooth bass actually run through a WaveShaper
    (`getDistortCurve`) for real electric-guitar-ish grit, four-on-the-floor kick, busy hats, no
    pad (the distorted bass/lead carry the harmony, same as a real rock mix). `THEMES.chill`
    (village, and everywhere else — raids, country map) — 82bpm, a slower Am-F-C-G loop held two
    bars per chord, sine/triangle waveforms, a slow pitch-vibrato LFO on the lead for warmth,
    sparser drums, pad leaned on more. `BPM`/`SPB`/`STEP` (previously `const`) are now mutable and
    recomputed by `A.setMusicTheme(name)`, called from `enterZone` — switches take effect from the
    next scheduled step with no restart/click. The shared distortion curve is computed once and
    cached, but each note still gets its own fresh `WaveShaperNode` — reusing one node's output
    across an entire song's worth of notes would have silently piled up redundant graph connections
    (`connect()` has no dedupe), found while double-checking the first draft of this.
  - **Quest rewards, a real 3-way roll**: previously every quest paid cash+XP, occasionally (35%)
    ALSO bonus-granting a temp perk on top. Now `completeQuest` rolls once — 30% a random
    not-already-owned temp mutator sample (same `grantRandomTempTrait` from 2026-09-16), 30% a rare
    weapon from the existing curated `COPYCAT_WEAPONS` pool (dropped as a pickup at the player's
    feet) — and only the remaining 40% is the money/XP/food payout, so a completed quest is a
    genuine surprise rather than a predictable trickle, per the user's own reasoning ("a reason to
    not rush to finish the mission and back so quickly"). Falls back to the money branch if every
    trait's already been granted this run rather than awarding nothing.
  - **Rare weapons in safes**: `hurtProp`'s safe branch now has a 30% chance to add one
    `COPYCAT_WEAPONS` pickup alongside its existing two cash drops.
  - **Cement mixer's big puddle**: breaking one (combat or thrown-landing, same path) now bakes a
    much larger permanent ground stain (34px, was 12px) and drops a real, lasting `'glue'` slow
    hazard (r:46, 14s) at the break point — previously the only puddle was the small cosmetic one
    tied to the live mixer prop, which vanished the instant the mixer did.
  - Verified live: settings panel read 15/15 for a fresh profile with `sb_musvol` cleared; entering
    city vs. village flipped a new debug `A.themeName`/`A.bpm` between `'rock'`/138 and
    `'chill'`/82, and letting the scheduler actually run (including the rock/distortion path) for
    real time produced zero console errors; 300 clean `completeQuest` rolls landed at 28% perk /
    33% weapon / 39% cash (target 30/30/40); 100 safe destructions hit the rare-weapon bonus 33% of
    the time; a broken cementmixer left a real `'glue'` hazard at radius 46 exactly at the break
    point. Zero draw errors throughout.

- **2026-09-16h — errand-quest items survive their holder's death (but become breakable in the
  city), and thrown objects finally collide with the world.** User: "with those item fetch quests
  you get from villagers — i.e. get a microwave — can you make the city dweller with that item drop
  it if they die... make the item breakable (only whilst it's in the city) instead — leading to a
  fail condition. Also thrown objects pass through walls and other objects instead of bouncing or
  exploding — which is weird."
  - This is the OLDER village-urge `kind:'errand'` raid system (a marked NPC holds `hasObject`,
    "bonked" via the existing kidnap-target daze mechanic to retrieve it) — separate from this
    session's new city civilian `fetch` quest type. `damage()` already makes an `isTarget` holder
    un-killable through normal hits (bonk-only, by design), but a hazard TICK (fire/gas) mutates hp
    directly and calls `killActor` completely outside that protection — so a holder caught in a fire
    really could die, silently taking the quest item with them forever. `killActor` now drops it as
    the same `'errand'` pickup a thrown-and-dropped item already uses (so `collectPickup` already
    knows how to hand it back), instead of just vanishing.
  - **Breakable, city-only**: new `breakNearbyErrandItem(x, y, r)` — checks whether the player is
    currently carrying the bulky object, or it's lying uncollected as a pickup, within range, and
    destroys it (with a clear "the microwave is destroyed!" callout) if so. No new "mission failed"
    flag needed: `urgeMet()`'s errand check is a live, re-evaluated "do you currently have it" test,
    not a one-way completion flag, so destroying the object just makes that check permanently false
    from then on — reaching the exit road afterward plays out exactly like never having found it,
    a real fail condition for free. Hooked into `explode()` (any blast) and the fire-hazard spread
    tick (an item left sitting in a spreading fire). Explicitly gated to `zone === 'city'` — the
    village stays the safe home base.
  - **Thrown objects now actually collide with the world**: `updateThrown` had no mid-flight solid
    check at all — only the eventual ground landing — so a thrown crate/barrel/anything sailed
    straight through a building wall or a parked car and landed wherever its arc happened to end.
    Now checked every frame: a solid wall cell or solid prop stops it dead at the point of impact
    and feeds it into the exact same landing dispatch a normal ground-landing already uses — a
    crate/tv/chair shatters right there, and a barrel/firebarrel starts "rolling" already touching
    the very wall it hit, which `updateRollingBarrels`' own collision check then detonates on its
    very next tick — so a barrel thrown at a wall now genuinely explodes against it.
  - Verified live: a crate thrown at a solid dumpster prop stopped essentially at its edge (only a
    dt-sized fraction of overshoot into it) instead of sailing through, and resolved into wreckage
    right there; a barrel thrown at the same kind of obstacle converted to a rolling barrel that
    exploded within a few ticks of "rolling" while still touching the wall; an errand-item holder
    killed via a simulated fire-tick death correctly dropped a real, collectable pickup; a carried
    bulky item and a ground-lying one were both destroyed by a nearby `explode()` call while in the
    city; the exact same check in the village left an identical carried item untouched. Zero draw
    errors throughout.

- **2026-09-16i — walking home from a raid, a real run recap, buildings that actually collapse, and
  the ACTUAL errand-item-vanishing bug.** User: "after finishing a run and arriving back in the
  village, can you start with the player walking in from off screen (a random edge)... and have
  your score/loot appear on screen"; then, mid-turn: "make it so that if any city building is over
  50% destroyed it collapses and does a lot of damage to everything inside and puts out whatever
  fires were still burning and leaves the remaining floor covered in rubble. Also I have done 3
  fetch quests and the item still vanishes when the holder dies."
  - **Walking in from off-screen**: new `villageArrival` — set in `enterZone` only when actually
    returning from a raid (`cameFromMission`), it places the player at a random point well outside
    the camera's view of the real spawn spot and walks them there in a straight line over ~1.3s,
    input locked the same way the raid van's own arrival cutscene already locks it. The camera is
    the part that makes this actually read as "off-screen" rather than just a fast walk: it's
    pinned on the real destination for the whole animation (see the new branch in the per-frame
    camera-follow code) instead of its usual smooth-follow, which would otherwise drag it straight
    out to the player's starting point and defeat the whole effect.
  - **A real "what you achieved" recap**: `runStart` (an existing loot/resource snapshot taken at
    the start of every raid) now also captures money/score/kills/level; a diff against it computed
    the moment you cross back into the village becomes `pendingRunRecap`, shown in a new `#runrecap`
    panel once the walk-in finishes — cash earned, score, kill count, and a level-up callout if one
    happened, auto-hiding after ~4s.
  - **Buildings that actually collapse**: `carveRoom` (every city building) now registers itself as
    a trackable "building" — a world-space AABB plus its own wall-cell count — and tags every wall
    cell it places; `damageCell` checks, the instant a wall cell actually breaks, whether that
    building has now lost over half its walls, and calls a new `collapseBuilding` if so: knocks down
    whatever wall was still standing (no half-collapsed building left politely intact), a real area
    hit to every actor inside — player included, no exception — destroys every prop inside via the
    same "real damage through hurtProp" trick used all session, snuffs out any fire/gas hazard still
    burning inside, and bakes a permanent rubble-colored stain across the floor.
  - **The actual errand-item-vanishing bug** (not the one fixed a message ago): that first fix
    guarded the item-drop on `!t.dazed`, which was backwards — `damage()`'s "can't kill an
    isTarget holder" protection only applies while they're NOT YET dazed; once they ARE dazed
    (knocked out, lying there waiting to be grabbed) a normal hit or a nearby explosion falls
    straight through to real damage and can genuinely kill them — caught in crossfire before the
    player gets to them, the far more likely real-world way this happens. That's exactly the case
    the `!t.dazed` guard excluded. Dropped the condition entirely — by the time a real pickup
    (`grabTarget`) has already happened, `t.dead` is already true and `killActor`'s own early return
    means the drop line never runs for that case anyway, so there was never a double-drop risk to
    guard against in the first place.
  - Verified live: a dazed holder killed via a simulated hazard-style call now correctly drops the
    item (the previous fix's exact blind spot); a real building found in a freshly generated city,
    collapsed manually, correctly damaged an actor inside for 70, destroyed a prop inside, snuffed a
    fire inside, and cleared every remaining wall cell tagged to it; breaking wall cells one-by-one
    through the real `damageCell` path auto-triggered the collapse at the instant the ratio crossed
    50%, not before; entering the city then killing two enemies then returning home produced a
    `pendingRunRecap` matching the real bounty/score earned, the player arrived off-screen and
    walked in to land exactly on the true spawn point, and the recap panel showed the correct
    "+$26 cash / +200 score / 2 kills" before auto-hiding. Zero draw errors throughout.

- **2026-09-16j — lifted items held overhead like the keepsake pose, not slung under one arm.**
  User: "I still want to see him holding the item above his head like he usually does. Don't forget
  that when carrying any object then weapons are stored away. When picking up barrels or people etc
  I could still see my weapons."
  - The weapon-hiding half of this turned out to already be correct: `drawActor`'s single weapon-
    render site is already gated on `handsFull = a===player && (player.carrying||player.holding)`,
    which is true for the new lifted-prop carry exactly the same as it always was for a bulky
    errand object or a kidnap target — confirmed by directly comparing rendered frames with/without
    an equipped weapon while carrying (a clean color-diff, not a guess): 281 matching weapon-color
    pixels with nothing carried, 0 with a TV held overhead. Nothing to fix there.
  - The actual ask: a lifted crate/barrel/tv/chair/animal was using the same "slung under one arm,
    tilted -0.5 rad" pose as a bulky errand object or an unconscious kidnap target — reasonable for
    those two, but not what reads as "about to throw something," and not the familiar pose the
    village keepsake-carry animation already has. Split it into its own branch: raised arms plus the
    exact same overhead placement/style `a.holding` already uses for a keepsake, still drawing the
    real per-item icon (`drawLiftedPropIcon`) rather than a generic shape. The errand-object and
    kidnap-target poses are untouched.
  - Verified live: a carried barrel's real red color was found concentrated right at the computed
    overhead position above the player, not at the old shoulder offset; re-ran the weapon-hidden
    check with the new pose active and it still held (0 weapon-color pixels while carrying). Zero
    draw errors.

- **2026-09-16k — the fireworks stand is throwable too.** User: "can you make the fireworks box
  throwable."
  - Added `firework` to `LIFTABLE_PROPS`/`PROP_THROW_STATS` (6 dmg / 380 knock — the same weight
    class as a crate; the payoff isn't the beaning). No new landing logic needed: it's not a
    barrel, so `updateThrown`'s generic landing path already applies — a fresh `mkProp` destroyed
    via the real `hurtProp`, which already has its own `'firework'` case
    (`addHazard('fireworks', ...)`, the same effect a melee-knocked-over stand already gets: real
    `explode()` calls popping every third-of-a-second for several seconds). Threw it, landed it,
    got the exact right effect, for free, by reusing the destroy path everything else this session
    already reuses. Also gave it a real carried/thrown icon (the same wooden-crate-with-colorful-
    rocket-sticks look the standing prop already has) instead of falling back to a plain crate.
  - Verified live: lifting removes it from the world and hands it to `player.carrying`; a mid-air
    hit dealt exactly 6 damage; landing added a real `'fireworks'` hazard; the carried icon's
    distinctive rocket-stick colors were found rendering at the correct position (an earlier
    same-check attempt across two separate tool calls came back empty purely because real
    background gameplay moved the player in between — redoing it as one atomic script, both
    position and the icon showed up exactly as expected). Zero draw errors.

- **2026-09-16l — collapsed buildings kept their roof; the errand item was dying in the SAME blast
  that killed its holder.** User: "collapsed buildings still have their roof. Please remove it
  after collapse. Also it still is destroying the item after the itemholder dies... maybe make it
  invulnerable for a few seconds after the holder dies."
  - **Roof**: a city building's roof (`c.roof`) is one fixed record per chunk — `genCityChunk`
    places at most one building per chunk and sets its roof right after, so the chunk `carveRoom`
    was called from (now stashed on the building record as `chunk`) is always exactly that
    building's own roof. `collapseBuilding` now clears it, so the rubble-covered, wall-less floor
    actually shows instead of staying hidden under a roof with nothing left to sit on.
  - **The item wasn't dying "after" the holder at all — it was dying in the exact same event**:
    `killActor` drops the item the instant the holder dies, but `explode()` (or a fire-hazard tick)
    calls `breakNearbyErrandItem` right afterward in that SAME call — so an explosion that killed a
    dazed holder would immediately also catch the item it had just dropped, in the same blast, at
    point-blank range. Gave the dropped pickup a `_bornAt` timestamp and a 3-second grace window in
    `breakNearbyErrandItem` before it's eligible to be destroyed at all — exactly the "invulnerable
    for a few seconds" the user suggested.
  - Verified live: a fresh, un-collapsed building's roof existed beforehand and was confirmed gone
    immediately after `collapseBuilding`; a dazed holder killed via a real `explode()` call (the
    actual bug scenario, one call doing both the kill and the nearby-item check) left its dropped
    item intact afterward; rolling that same item's `_bornAt` back past the 3s window and re-running
    the check then destroyed it normally, confirming the grace period expires rather than being a
    permanent immunity. Zero draw errors.

- **2026-09-16m — NPC-on-NPC retaliation.** User: "in the city, can you make enemies/npcs attack
  each other if they receive a certain amount of damage from another enemy/npc? That should add to
  the chaos."
  - `damage()`'s enemy branch now checks: if the hit came from a REAL actor (`from.dead === false`
    — the one check that actually distinguishes an actual `enemies`/`player` entry from the
    synthetic `{x,y,team:'fire'|'wild'|'building'}` stand-ins hazards/explosions/animals pass as
    `from`, which have no `.dead` at all and nothing an AI could chase or swing at) that isn't the
    player and isn't the victim itself, for at least 5 damage, the victim now marks that attacker as
    `_retaliateAgainst` for 4-7 seconds and goes `mad`. Crossfire, a rampaging panic car, a rival
    gang's stray hit, another civilian's swing — anyone but the player triggers it.
  - `enemyTarget(e)` checks this (a live target, ahead of the normal turf-war/player search) so a
    retaliating NPC's movement and aim genuinely turn on their actual attacker, not just "become
    generically angrier." That alone wasn't enough for melee, though: `attack()`'s hit-detection for
    an ordinary (non-turf) hostile only ever checked `[player, ...soldiers]` — even with
    `enemyTarget` correctly pointing them at their attacker, they'd walk right up and swing at empty
    air, landing nothing. Added the current `_retaliateAgainst` to that foes list when active, so
    the swing actually connects. Gunfire didn't need this fix — bullet collision already allows
    same-team hits once the target is `.mad` (the pre-existing crossfire rule other comments in this
    file already reference), so correct aim from `enemyTarget` was already sufficient there.
  - Verified live: enemy A hitting enemy B for 20 correctly set `B._retaliateAgainst = A` and
    `B.mad = true`; `enemyTarget(B)` resolved to `A`; a melee `attack()` call from B (facing A, in
    range) landed real damage on A (22, via B's own weapon) — confirming the foes-list fix actually
    lets the retaliation connect, not just point the AI in the right direction; a synthetic
    non-actor damage source (`{team:'fire'}`) and player-caused damage both correctly did NOT set
    any retaliation. (Also surfaced, unrelated to this feature: a handful of stray NaN-position
    lights in the world causing non-fatal but repeated draw exceptions — flagged as a separate task
    rather than chased down here, since nothing in this change touches light creation at all.)

- **2026-09-16n — the real window-rendering lag (stone wasn't it).** User: "the village area was
  getting a bit laggy... last time it was the sticks wall texture as it was transparent, maybe
  check to see if this stone texture is doing it too? You might need to check all wall and floor
  textures."
  - **Floors aren't a per-frame concern at all** — `bakeFloor` paints them into each chunk's static
    background canvas once, at generation time; the per-frame cost is a single `drawImage` blit of
    that whole baked chunk, same as any other background art.
  - **Fieldstone (the "stone" texture) checked out fine** — measured directly: repeatedly drawing
    the same fieldstone cell only ever added the 2 cache entries the earlier stick-wall fix's
    generic `drawTexturedFill` cache already covers (face + top sprite), reused every time. Isolated
    per-cell timing put it in the same ballpark as wood/brick (~0.012-0.017ms) — not the culprit.
  - **The actual regression: `MAT.WINDOW`**, a case the earlier stick-wall fix's cache never
    covered because it never went through `drawTexturedFill` in the first place — it redid a full
    scratch-canvas clear+clip+fill+`destination-out`-punch+restore sequence, from scratch, for
    every single window cell, every single frame, to carve the "true transparency" pane opening.
    That shape is 100% deterministic (always exactly `CELL`×`CELL`, always the same frame colour),
    so it's the same bitmap every time. Measured in isolation at ~0.0665ms/cell — 4-5x any other
    wall material's cost, and directly responsible for a window-walled test room's full `draw()`
    call averaging ~11.8ms vs ~4-8ms for other materials at the same scale. Same root cause as the
    original stick-wall bug (an expensive canvas op re-run every frame with nothing to prevent it),
    just a different material this fix never reached. Built the punched-frame sprite once
    (`getWinFrameSprite`) and reused it forever after, exactly like the existing texture-fill cache
    does for everything else. The now-fully-unused `_gapScratch`/`_gapCtx` scratch canvas this
    replaced (nothing else in the file still used it) was removed rather than left as dead weight.
  - Verified live: isolated per-cell `drawWallBlock` timing for `MAT.WINDOW` dropped from ~0.0665ms
    to ~0.0217ms (3x) after the fix, landing in the same range as every other material; a full
    window-walled room's `draw()` average dropped from ~11.8ms to ~4.1ms (~2.9x); a screenshot of
    that same room confirmed the window frames/panes/mullions still render pixel-identical to
    before — this only changed HOW the bitmap gets produced, not what it looks like. Zero draw
    errors. (The separately-flagged NaN-position-lights task is running independently in its own
    session per the user's go-ahead — not duplicated here.)

- **2026-09-16o — carry put-down, hit-triggered drops, quest discoverability, and the invisible
  wreck target.** User: "Can you make it so you can put down people or objects that you're carrying
  ... by pressing E ... Also if you're hit carrying a throwable object it should fall from your
  hands and trigger an explosion or just smash on the ground ... I'm also having trouble finding a
  city dweller who will give me a task to complete." Followed by two screenshot-backed reports:
  "The quest details is over the minimap" and "I think I already destroyed the chests it's asking
  about but nothing happened."
  - **E now puts things down, not just picks them up.** `dropCarry()` took a `violent` argument and
    a real `isProp` branch: a lifted animal is released back into `kennelPets`; any other lifted
    prop (crate, chair, tv, barrel, firebarrel, cementmixer, firework) respawns via `mkProp` —
    gently and intact on a deliberate E-press, or additionally destroyed via the same
    `hurtProp(tp, tp.hp+50, {team:'wild'})` reuse trick used all session for thrown-and-landed props
    when a hit knocked it loose. `tryInteract()` gained `if (player.carrying){ dropCarry(false);
    return; }` as its very first check, ahead of every other interaction — the village keepsake
    slot (`player.holding`) already had its own working E-drop, so both carry slots now cover both
    zones.
  - **Getting hit hard while carrying now knocks it loose for real.** `damage()`'s existing
    `dropCarry();` call site (fired on `heavy || dmg > 14`) became `dropCarry(true);` — a barrel or
    firebarrel dropped this way genuinely explodes, a crate/chair/tv just breaks, entirely for free
    via each type's existing per-type `hurtProp` branch.
  - **Quest discoverability**: raised the base "will this civ offer something" roll from 50% to 75%,
    and replaced the old single dice-roll dispatch (where a failed prerequisite for beat/wreck just
    silently fell through to ordinary chatter — a "wasted" success indistinguishable from a decline)
    with `tryBeat`/`tryWreck`/`tryFetch` tried in a randomized order, falling back through the list.
    `tryFetch` has no prerequisites and always succeeds, so once the 75% roll hits, a quest is now
    guaranteed, never a silent no-op.
  - **`#questlog` no longer overlaps the minimap.** Its `top:46px` was meant to clear the
    canvas-drawn minimap but visibly didn't (per the user's screenshot); moved to the opposite
    corner (`left:12px; top:150px`), below the main HUD block and clear of both the minimap and the
    bottom-left toast.
  - **The actual "I destroyed it, nothing happened" root cause**: a wreck quest's 2-3 marked
    crates/barrels (`p._questMark`) had zero visual distinction from ordinary ones anywhere in
    `drawProp` — the only hint was the minimap's single blue diamond pointing at the nearest one,
    useless for picking the right box out of a cluttered scene up close. Added a pulsing sky-blue
    dashed ring + a small "!" over any prop with `p._questMark && !p._questMark.done`, reusing the
    same `#7fd4ff`-family color already used for quest markers elsewhere.
  - Verified live in an isolated tab, atomically to dodge the open world's own streaming/culling
    between tool calls: E-drop of a lifted crate respawns it intact; a heavy `damage()` hit on a
    carried barrel drops+explodes it (`dead:true` via the explosion branch), a carried chair drops
    and just breaks, and a light hit (`dmg<15`, no heavy knock) correctly leaves a carry untouched;
    a real city civilian run through `tryInteract()` rolled no eligible thug/crate targets and fell
    back to `tryFetch`, producing a real pickup-backed fetch quest with no thrown errors; a
    hand-tagged `_questMark` crate rendered its dashed ring correctly in a live screenshot; and
    `#questlog`'s live bounding rect (`left:12, top:150, 190×45`) sits well clear of the minimap.
    (Found along the way, not a bug: a brief post-zone-entry `player.invuln` window was masking the
    violent-drop test until accounted for — expected spawn-protection behavior, not a defect.)

- **2026-09-16p — the mission-end walk-in: real speed, a real path, real control.** User (mid-turn,
  same session): "after a mission when the player runs from the edge of the screen to the campfire,
  can you make that the normal in-game walking speed, slightly not a perfect line ... and so the
  player can take over the controls at any time instead of having to wait."
  - The `villageArrival` walk-in (`enterZone`/`updatePlayer`) covered whatever distance it rolled in
    a fixed 1.3s no matter what, in a dead-straight line, with `p.vx/vy` pinned to 0 and player
    input completely ignored until it finished.
  - `dur` is now `distance / 210` — the same base speed real WASD movement uses — so the walk-in
    always reads as an ordinary walk, not a scripted dash. A perpendicular unit vector (`px, py`)
    and a random signed `bend` (30-70px) are computed once at arrival time; `updatePlayer` scales
    that lateral offset by `Math.sin(k * Math.PI)` each frame — zero at both endpoints, peaking
    mid-walk — bowing the path into a gentle arc while still landing exactly on the real spawn spot.
    Facing direction now follows the actual frame-to-frame movement vector instead of a single
    fixed heading toward the destination, so it turns through the curve instead of crab-walking it.
  - Any movement key (WASD/arrows) now clears `villageArrival` immediately and calls
    `showRunRecap()` right away instead of waiting for the scripted walk to finish, then falls
    through into ordinary input handling the same frame — no dead window where the player holds a
    key and nothing happens.
  - Verified by calling the exposed `updatePlayer(dt)` directly in a controlled loop (bypassing
    real-time/rAF drift entirely): lateral distance from the old dead-straight path rose smoothly
    from 0 to ~37px by the midpoint and back to 0 exactly at arrival, landing on the intended spot
    to the sub-pixel; a synthetic `keys['d']=true` frame during the walk-in cleared `villageArrival`
    and `pendingRunRecap` on the spot and moved the player under normal control that same frame.

- **2026-09-16q — making active traits/mutators actually visible.** User (original ask, same
  session as the carry/quest batch): "if you have a 'trait/mutator' activated, can it be visible
  somewhere on the HUD stating very briefly what it does and it's trigger button.... I never know if
  I have anything applied. A detailed explaination of your active trait/mutator should be noted in
  the ESC screen."
  - The only prior hint was `#help-active`, a generic "Q / F perk active abilities" line buried in
    the bottom-right control legend — shown whenever something was active, but never saying WHAT it
    was or what the key actually does. Left it in place (harmless) and added real content elsewhere.
  - New `#traithud` panel, mirroring `#questlog` on the opposite side of the screen (`right:12px;
    top:150px`, same distance below the HUD, clear of the minimap) — driven by `updateTraitHUD()`,
    hooked into the end of `applyPlayerPerks()` so it's always in sync with whatever's actually
    equipped/granted with zero extra bookkeeping. Each entry shows the perk's icon + name, a `[Q]`/
    `[F]` key badge for the (at most two) traits that actually get a keybinding, and a one-line
    blurb — for a keyed trait, that's specifically the ACTIVE half of its `desc` (the part after
    "ACTIVE ", i.e. what the key actually does), since that's what the badge is about; passive-only
    traits (not every perk defines an active ability — e.g. Second Wind) show their own short desc
    with no badge.
  - New "ACTIVE TRAITS / MUTATORS" section in the ESC/settings panel (`#set-traits`, built by
    `buildTraitSettingsUI()`, same `applyPlayerPerks()` hook), listing the full unabridged `desc`
    for each trait (both the passive and ACTIVE halves) plus where it came from — "equipped Legacy
    perk" vs. "this run only — quest reward" — so a temporary quest-reward sample doesn't read the
    same as something deliberately chosen in the Legacy menu.
  - Verified live: granting Vampire (active, keyed) and Second Wind (passive-only) via
    `grantTempTrait` populated `#traithud` correctly, including the ACTIVE-half extraction for the
    keyed one; `clearTempTraits()` with nothing equipped hid both panels entirely; equipping a real
    Legacy perk (Lucky) through `toggleEquip` showed up in the settings panel correctly labeled
    "equipped Legacy perk" rather than a quest reward. Caught and fixed one bug during verification:
    a passive-only trait's already-period-terminated desc was getting a second `.` appended in the
    HUD blurb ("...health..") — the blurb logic now only appends a period when it actually split off
    the ACTIVE half.

- **2026-09-16r — chimneys with smoke on some village roofs.** User (mid-turn): "Oh can some roof
  types in the village include a chimney with gentle smoke effects?"
  - `recomputeRoofs()` now rolls `hasChimney` off the same seed already used for the roof's colour
    (`sd % 3 === 0`, ~1/3 of roofs — stable across reloads, not re-randomized every time the roof
    list rebuilds), and when true picks a `chimX`/`chimY` sat on the darker half of the pitch (see
    `drawRoofs`' light/dark gradient split), offset toward one gable end rather than dead-center, so
    it reads as built into the slope rather than a sticker glued to the middle.
  - New `drawChimney`/`drawChimneySmoke` helpers (just above `drawRoofs`): a small shaded brick
    stack with a cap, plus 4 soft translucent puffs drifting up and gently sideways, entirely
    procedural off `performance.now()` and the roof's own seed — same technique as `torchFlame`/the
    campfire flames, so it needs no persistent particle state and just loops forever. Drawn inside
    the existing per-roof loop in `drawRoofs`, after the outline stroke, while the roof's own fade
    (`a`, 1 outside → 0 once you're inside) is still the active `globalAlpha` — the chimney and its
    smoke fade and disappear together with the roof, no separate bookkeeping needed.
  - Verified live: a hand-placed test roof with `hasChimney:true` rendered a visible chimney with
    drifting smoke in a live screenshot, with zero console errors; moving the player inside that
    roof's interior faded the roof AND the chimney/smoke out together, matching the existing
    house-privacy behavior exactly. A 200-sample offline check of the seed math held the chimney
    rate at 35% (matches "some roof types") with every sampled chimney position landing inside its
    own roof's bounds for both ridge orientations.

- **2026-09-16s — raised the quest-reward perk odds.** User: "I've done a ton of quests but only
  ever received the money reward.. Maybe I'm just unlucky. Could we make it 40% perk and the other
  two 35%?" (35/35 for the other two doesn't sum to 100 with 40 — confirmed with the user they meant
  40% perk / 30% weapon / 30% money, keeping the original even split between weapon and money.)
  `completeQuest()`'s 3-way roll thresholds moved from 0.3/0.6 to 0.4/0.7. Verified live by mocking
  `Math.random()` at each boundary (0.10, 0.39, 0.40, 0.69, 0.70, 0.99) and calling the exposed
  `completeQuest()` directly: the perk branch fired (and actually granted a trait) up to 0.39, the
  weapon branch (a real pickup spawned) from 0.40–0.69, and the cash branch (`+$35` matching the
  test quest's `cash`) from 0.70 on — exactly the new 40/30/30 split, no off-by-one at the
  boundaries.

- **2026-09-16t — wreck quests only counted a manual melee kill.** User: "if I do those mini quests
  to destroy barrels or boxes it only counts it as destroyed if I manually break it. It doesn't
  count explosion damage or throwing - which breaks the quest when they break the 'wrong' way."
  - Root cause: `hurtProp`'s decrement check (`p._questMark`) was always fine, in fact already fires
    correctly for explosion damage on its own (`explode()` calls `hurtProp` on every nearby prop,
    marked or not) — the actual break was one step earlier. Picking a marked crate/barrel UP at all
    (`tryInteract`'s lift branch) killed the original prop with a bare `liftP.dead = true` and no
    `hurtProp` call whatsoever, and handed the player a brand-new plain `{isProp, propType, w, h}`
    carry descriptor with no memory of the mark. Every single thing that could happen next — a
    gentle E-drop, a hit-triggered violent drop, or an actual throw — was already working with an
    unmarked stand-in prop, so nothing downstream had any way to know it used to be a quest target.
    Manually punching it to death without ever picking it up was the only path that never hit this,
    which is exactly the "only counts if I manually break it" the user described.
  - Fixed by threading the mark all the way through instead of dropping it at the first handoff: the
    lift now stores `qm` (the quest) and `qmSrc` (the exact prop reference it's replacing) on the
    carry descriptor; a new `reattachQuestMark(tp, qm, qmSrc)` helper re-attaches `_questMark` to
    whatever fresh prop object shows up next — `dropCarry`'s gentle/violent respawn, and
    `updateThrown`'s thrown-and-landed branch — and also swaps the quest's own `props` tracking list
    over to that new object so the minimap marker (`questTargetPos`) keeps pointing at whichever
    object is currently the live stand-in instead of a `dead` original. A thrown barrel/firebarrel
    goes one step further (it becomes a `rollingBarrels` entry, not a `props` entry, until it
    detonates) — carried the mark onto that entry too and replicated `hurtProp`'s exact decrement
    logic in `updateRollingBarrels`' own explosion branch, since there's no prop object there for
    `hurtProp` to act on at all.
  - Verified live, all four ways a lifted marked prop can actually end its life: lift → gentle
    E-drop → manual smash; lift a barrel → hit-triggered violent drop (real explosion); lift a crate
    → throw → lands and breaks; lift a barrel → throw → rolls → detonates on its fuse. Each one
    decremented `propsLeft` correctly (verified via the exposed `tryInteract`/`damage`/`updateThrown`
    /`updateRollingBarrels`, using hand-built quest/prop objects so no real gameplay RNG was needed);
    a single-prop quest completed (`q.done` flipped) the moment its one marked crate was thrown and
    broke.

- **2026-09-16u — a temp perk's active ability could get stuck on forever.** User: "after I ended
  my city mission and I went home I left the city with my stealth ability activated. So now that
  I'm back in the village I'm ALWAYS invisible. Can you make sure abilities get turned off before
  you get in the car to leave the city?"
  - Root cause: an active ability's timed effect (Ninja's Vanish, `player._invisibleT`) only ever
    counts back down inside that trait's own `tick(p,dt)` — and `tick` only runs for traits still
    present in `player._traits`. `clearTempTraits()` (called on every zone change, wiping any
    quest-reward "free for this run" perk) simply deleted the trait from the list with no regard for
    whether its active effect was still running — orphaning the timer stuck above 0 forever, since
    nothing was left to ever count it back down. Ninja's Vanish reads as "permanently invisible";
    the exact same freeze would've hit any other temp trait's timed buff (Vampire's Wing Out
    noclip, Berserker's Bloodlust, Juggernaut's Bulwark, Glass Cannon's Overcharge, Adrenaline's
    Overdrive, Thick Skinned's Taunt shield, Cannibal's Feast) just as permanently.
  - An **equipped** (permanent Legacy) copy of the same perk was never affected — `applyPlayerPerks`
    always re-includes equipped perks on every zone entry, so their `tick` never stops running and
    the effect decays normally in the new zone. The bug was specific to the temporary, quest-granted
    copy getting deleted out from under a running effect.
  - Fixed in `clearTempTraits()` itself (the single call site, from `enterZone`): before actually
    removing each temp trait, a new `TEMP_TRAIT_ACTIVE_FIELD` lookup (only the traits whose active
    leaves a real player-side timed effect behind — one-shot actives and ones that only touch
    enemies/allies don't need this, `enterZone` already wipes the enemies list for free) zeroes the
    running timer and replicates that trait's own end-of-effect cleanup (`clearPerkAura`, plus
    Vampire's extra noclip-off + unstick-from-the-wall step) right there, instead of leaving it to
    a `tick` that will never fire again.
  - Verified live: granting a temporary Ninja, firing Vanish (`_invisibleT` confirmed at 4), then
    calling `enterZone('village')` — the exact "end mission, drive home" transition — left
    `_invisibleT` at a clean 0 and the trait gone, instead of stuck permanently above 0. Re-ran the
    same sequence with Ninja **equipped** instead of temporary: `_invisibleT` correctly stayed at 4
    and the trait stayed in `_traits` across the same transition, confirming the fix only touches
    temporary perks and doesn't cut a legitimately-persistent equipped one short.

- **2026-09-16v — village slowdown, round 2: a real profiler breakdown, plus a genuine leak.** User
  shared an F8 perf-readout screenshot: "frame 54.0ms step 0.5 draw 37.2 ... props 822 ... zone
  village" — "I'm playing in the village and it's still very slow" (a follow-up to the earlier
  window-rendering-lag fix, which didn't fully resolve it).
  - `step` at 0.5ms vs. `draw` at 37.2ms says the entire problem is in rendering, not simulation —
    but the temporary F8 overlay (added during an earlier pass at this same complaint) only ever
    reported one lump `draw` number, with no way to tell WHICH of its several phases (background/
    chunk blit, ground-detail overlays like worn paths and dug holes, building + sorting the
    y-sorted draw list, the sorted entity/prop draw pass, or roofs + lighting) actually eats the
    time on the reporter's own machine.
  - Instrumented `draw()` with named segment timers (`bg`, `ground`, `listsort`, `entities`,
    `roofslight`, `tail` — see the `_mark`/`_segSums` calls threaded through it) and extended the F8
    readout with the collection sizes several of those phases scale with regardless of what's
    actually on screen (`roofs`, `worn`, `dabs` (pathDabs), `holes`, `parts`, `bullets`, `chunks`) —
    turns "draw is slow" into "which phase, and against how much data," instead of guessing.
  - While tracing what actually walks the full `props` list every frame independent of the visible-
    prop culling in the y-sort builder, found a real, if unproven-as-the-whole-story, leak: `props`
    only ever gets compacted back down to the living ones inside `applyVillageProps()` — which itself
    only runs on village (re-)entry. A crate someone smashed, a picked-bare bush, a taken gift — all
    of it just flips `.dead = true` and then sits in the array forever (a dead prop is never drawn —
    the y-sort builder already skips them — so this is pure invisible dead weight, not a rendering
    bug of its own), still walked by every one of the dozen-plus `for (const p of props)` loops in
    both `step()` and `draw()`, for as long as the player stays in one zone without a round trip back
    out and in again to trigger that cleanup. A long, uninterrupted village stay (heavy building/
    foraging/sleeping-through-days without ever visiting the city) never gets that natural flush.
  - Added a throttled `pruneDeadProps()` (checked in `step()`, actually filters at most once every
    8 real seconds — a dead prop is invisible either way, so there's no visual reason to rush it, and
    filtering+reallocating the array every single frame would just be its own pointless cost) as a
    standing safety net, independent of zone transitions.
  - Verified live: forced ~10s of simulated time via the exposed `tick()` debug helper with several
    props hand-marked `dead` first — the count dropped by exactly that many, zero dead entries
    remained afterward, and a separate, untouched live prop's object identity (checked via reference
    equality, not just its data) survived the array being rebuilt underneath it, confirming the prune
    doesn't disturb anything still holding a reference to a live prop (relevant given the wreck-quest
    `_questMark`/`q.props` tracking from a few entries up depends on exactly that). Re-ran the new
    segmented profiler at both a 1024×768 and a 1920×926 canvas on this machine with ~885 real
    village props in view: draw stayed at 2–3ms total either way, meaning the slowdown the user is
    seeing does NOT reproduce on this machine/save even at their exact reported prop count and canvas
    resolution — the newly-detailed breakdown is what's actually needed next: asked the user to press
    F8 again in the real laggy village and share a fresh screenshot so the specific slow phase (and
    whether the dead-prop leak was actually a meaningful contributor) can be confirmed on their
    hardware/save rather than guessed at further.

- **2026-09-16w — the profiler itself was comparing apples to oranges.** User sent a fresh F8
  screenshot from the actually-laggy village: `frame 7.6ms step 1.1 draw 20.8` but the new segment
  breakdown summed to only `bg 0.1 + ground 0.1 + listsort 0.6 + entities 1.9 + roofslight 0.1 +
  tail 0.6 = 3.4ms` — nowhere close to the reported 20.8ms draw.
  - Root cause, in the profiler itself, not the game: `step`/`draw` were always just the MOST
    RECENT frame's time (reassigned fresh every frame, never accumulated), while `frame` and the new
    segment breakdown are true averages over the ~0.5s sampling window. A rare, spiky frame — a
    chunk generating, a village autosave serializing, whatever — shows up in full in the
    instantaneous `draw` number whenever the sample happens to land on it, but gets diluted to
    near-nothing once spread across ~30 frames' worth of segment averages. The two numbers were never
    actually comparable, which is exactly why they looked so inconsistent.
  - Added a running MAX alongside the existing average for every one of frame/step/draw and each
    segment, all reset on the same 0.5s cycle — the overlay now reads `frame avg/max`, `step avg/max`,
    `draw avg/max`, and `segment avg/max` for every segment, so an occasional bad frame shows up as a
    high max on whichever segment actually owns it, instead of vanishing into an average.
  - Verified live: the new avg/max format renders correctly with no console errors on a normal
    (non-spiky) run, where avg and max naturally sit close together — confirming the mechanism itself
    works correctly, ready to actually show a real spike the next time the user reports one.

- **2026-09-16x — E couldn't both put down a captive AND drive off with them.** User: "When
  capturing villagers in the city scene and trying to load them in the car, it'll place down the
  villager but not take off in the car - as both use the E button. So can you have it so the capture
  is a success if you place the captive in the 'exit zone' near your car."
  - Regression from this same session's own earlier E-drop fix: `tryInteract()` gained a top-of-
    function `if (player.carrying){ dropCarry(false); return; }` check so E always means "put this
    down first." That check sat ABOVE the existing exit-zone leave logic (`mission.exitRect` +
    `inRect(...)`, further down the function) — which is exactly where a kidnap target actually gets
    delivered: `urgeMet()` just checks that `player.carrying.isTarget` is still true once you're
    standing in that rect, and `_missionResult`/`beginGetaway()` take it from there. With the generic
    drop check running first, walking into the exit zone and pressing E just dropped the captive on
    the spot (into a loose, no-longer-marked enemy) instead of ever reaching that logic — a second
    E-press then found nothing left to carry home.
  - Fix wasn't the user's literal suggestion (treating a drop-in-the-zone as success) — reordering
    the two checks gets the actually-intended one-button flow instead: the exit-zone leave check now
    runs BEFORE the generic carrying-drop, so reaching it while still carrying the target completes
    the mission and starts the getaway in one E-press, exactly like it did before the drop feature
    existed. The generic drop still fires normally everywhere else in the city.
  - Verified live via the exposed `tryInteract()`: carrying a synthetic kidnap target into a real
    mission's `exitRect` and pressing E left `enemies.length` unchanged (confirming `dropCarry`'s
    "they slipped free" branch — which pushes a new loose enemy — did NOT fire) and progressed the
    mission toward its getaway/village-return sequence; the same carry pressed away from the exit
    zone still correctly dropped normally (`enemies.length` +1, carrying cleared), confirming the
    reorder didn't disturb the ordinary drop-anywhere-else behavior.

- **2026-09-16y — water conducts, villagers actually sleep in bed.** User: "Can you make it that if
  anything is wet and electricity is discharged nearby - i.e. exploding TV or a taser etc, then
  everyone in the area is zapped. The damage can reduce the further from the source, but it'll be
  good to see the zaps spread through the water. When villagers sleep at night can you also put them
  in their assigned beds?"
  - The wet+electricity chain (`electrocute()`, shared by the spark hazard's tick, `weaponFx`'s spark
    case, and lightning) already existed from an earlier session — a broken TV already dropped a real
    `spark` hazard. The actual gaps: (1) both the hazard's per-tick damage and `electrocute`'s chain
    damage were flat regardless of distance; (2) a taser/prod/zapstaff's DIRECT hit only ever
    mattered if that one target happened to already be wet — it never left a real discharge field
    behind, so a dry direct hit next to a wet bystander did nothing to them; (3) the visual was
    always a straight actor-to-actor line, never anything reading as "found the wet ground."
  - Added real distance falloff to both `HAZ.spark.tick` (linear taper from full strength at the
    hazard's centre down to a third of it at the edge) and `electrocute()` (now threads the ORIGIN
    point through every recursive hop, so a target three links down a chain is judged against the
    real source, not its immediate neighbour, tapering to 30% at 260px out).
  - `weaponFx`'s spark case now drops a brief real `spark` hazard (r:36, 1.1s) at every taser/prod/
    zapstaff hit, team-tagged off the attacker — the exact "exploding TV or a taser… everyone in the
    area" case from the request, not just an already-wet direct target.
  - New `sparkThroughPuddles(x,y)`, called from `addHazard` on every new spark hazard and again each
    time an existing one re-triggers its wet-chain: traces a quick wobbly arc of spark particles out
    to every puddle hazard within 160px — purely cosmetic, reusing the same particle system as
    everything else, giving the "spreads through the water" look the request asked for.
  - Villagers used to just get within 22px of their assigned bed, stand there facing a fixed angle,
    and post an occasional "z" — never actually IN the bed. Housed villagers now snap exactly onto
    their bed's own coordinates once asleep (`e._inBed`), are excluded from the normal standing-actor
    draw pass while there, and a new `bedSleeper(p)` lets the bed prop's own `drawProp` branch render
    them properly lying in it — a head + hair at the pillow with closed eyes, a soft blanket-bump over
    the mattress, both tinted from the sleeper's own colours. Unhoused villagers sleeping rough by the
    fire are untouched (no bed to snap to).
  - Verified live: mocked taser hits at three distances from a wet-actor cluster showed clearly
    decreasing damage with distance (59 / 52.8 / 48.8 over 0.5s); a direct `weaponFx` taser call
    confirmed a real `spark` hazard now spawns at the hit point every time; a housed villager forced
    through a full night cycle via the exposed `tick()` helper ended up with `_asleep`/`_inBed` both
    true and position exactly equal to their bed's coordinates, with no console errors.

- **2026-09-16z — two regressions from the last two turns' fixes.** User: "The perk description is
  overlapping the minimap again. Also the village area is slow again," with a fresh screenshot of
  each.
  - **Minimap overlap**: `#traithud`'s `top:150px` (from the trait-HUD feature two turns back) was
    never actually clear of the minimap — `drawMinimap`'s `my=48,mh=118` puts its real bottom edge at
    a fixed 166px in canvas/CSS pixels (the canvas is 1:1 with CSS px here, so this holds at any
    window size), 16px past where the panel started. The earlier verification screenshot for that
    fix just didn't happen to show enough content to make the 16px collision obviously visible.
    Moved to `top:180px`, clearing the minimap's actual bottom edge with real margin this time.
  - **Village slowdown, round 3**: fresh F8 data (`frame 61.6/72.6 draw 47.2/66.4`) finally pointed
    somewhere real: `tail 46.0/60.9` — nearly the entire frame, and (unlike the last report) with
    avg and max close together, meaning this is a steady per-frame cost, not a rare spike. `tail` at
    that point still covered everything after the lighting pass in one lump: the offscreen→visible
    blit, every full-res overlay, the vignette, the minimap, the sky clock. Split it into `blit`,
    `postfx` (text/weather/vignette/low-hp flash), `minimap`, and a now much smaller `tail`
    (sky clock + whichever modal panels happen to be open) so the next reading says which one it
    actually is instead of "still tail." Also spotted a real, if so-far-unconfirmed, candidate while
    tracing this: `drawActorTranslucent` (used only while the PLAYER is see-through — Ninja's Vanish,
    a van/car, Ghost's passive) does a `getImageData`/`putImageData` round-trip every frame it's
    active, which can force a full GPU→CPU sync of an entire frame's queued canvas work onto whatever
    runs right after it — a plausible mechanism for exactly this kind of "one segment eats everything
    else's deferred cost" profile, though the user's own screenshot showed Scavenger equipped (no
    translucency reason active), so it isn't the culprit for *this* specific reading and needs its
    own dedicated test regardless of what the next split shows.
  - Verified live: both new segment markers (`blit`/`postfx`/`minimap`/`tail`) render correctly with
    real numbers and no errors; the trait panel now sits with a clean visible gap below the minimap
    in a live screenshot. Still waiting on the user's next F8 screenshot to actually localize the
    46ms — this is now the third round of this same investigation, and each round has been narrowing
    the target rather than guessing at a fix outright.

- **2026-09-17 — the guard villager.** User's son's idea, via the user: "we may need a villager who
  can guard the village from wild beasts (and maybe on later levels they can be double as a lookout
  to warn the cult of incoming raids?) but if there was a guard villager type then they can race away
  and defeat any zombies, wolves or homeless men that attack the villagers as they sleep." Confirmed
  as v1-worth-building (own earlier note: needs a real threat to exist first, and the raid-lookout
  idea is a real later hook once village-raids are a thing) before writing any of it.
  - **New `guard` job**, added to `JOBS`/`JOB_META` with a new shield-and-boss `ICONS.guard` icon —
    shows up in the existing assignment menu (`drawAssign`/`doAssign`) with zero UI-side special
    casing needed, since that panel is already fully data-driven off those two structures.
  - Unlike every other job, picking `guard` doesn't route through the peaceful job/anchor AI at
    all: a new per-frame sync at the top of `updateEnemy` notices `rec.job === 'guard'` and
    permanently promotes that villager to a real soldier (`promoteGuard`, `e.soldier = true`) —
    which means the entire existing mustered-raid-squad combat AI (`updateSoldier`: approach,
    attack, morale/rout) just works for a guard too, day or night, with no separate combat system
    to write or maintain. Demoting is equally free — reused the *already-existing* `demoteSoldier`
    (previously only called by `muster()`'s stand-down) as-is; if the job changes away from `guard`,
    or a raid muster briefly promotes them into a squad and then lets go, the same sync check
    settles them back into the right state next frame either way.
  - `updateSoldier`'s "no threat" idle behavior was hard-coded to orbit a slot around the player
    (`e._fx/_fy`) — fine for a raid squad, wrong for a village guard. Added an `e._guardPost` check
    ahead of that: when set (only true for a `promoteGuard`-made guard, never a mustered soldier),
    they hold a fixed spot near the campfire instead, spread out from other guards via the same
    random-ring-offset trick `promoteSoldier` already uses for squad spacing.
  - **Night intruder**: rolled at most once per calendar day, at the exact moment night fully sets
    in (reusing the existing `village._nightHoldDay` once-per-day guard, right next to the "Night
    has fallen" flash) — a modest 22% chance, gated to day 2 onward so it can't ambush a brand-new
    save before the player even understands the game. Spawned via the ordinary `spawnEnemy('thug',
    …)` city-grunt path — harmless to call from the village since every one of `spawnEnemy`'s own
    city-only embellishments (faction weapons, traits, patrol, gang backup) is already gated behind
    `zone === 'city'`. Tagged `_villageThreat`, given a short lifespan (it slinks off if never
    fought), and deliberately modest (34 HP, no weapon) — real stakes for an unguarded village
    without a punishing ambush.
  - A plain hostile's own `attack()` only ever swings at the player or a soldier (see `attack()`'s
    foes list) — it would never actually hit an ordinary sleeping villager even if it walked right
    up to one. Rather than broadening that shared list (used everywhere, including raids), gave the
    intruder its own small self-contained hunt loop, `updateVillageThreat` — same shape as the
    existing `updateKennelPets` (hunt the nearest valid target, hit it directly via `damage()`,
    `team:'wild'` so it's never blamed on the player) — restricted to ordinary villagers (never the
    player, since village damage to the player is already a hard no-op; never another guard, since
    that's who should be hunting *it*).
  - One honest scope cut: it reuses the plain human "thug" sprite for every flavor (wolf, zombie,
    "homeless man" alike) rather than drawing distinct creature art — the flash-text flavor line
    ("a gaunt figure slips over the fence" / "something is prowling the tree line" / "a stray dog
    has gone feral tonight") carries the variety instead. Distinct sprites are a reasonable follow-up
    if this first pass earns its place.
  - Verified live end-to-end: assigning `guard` through the real assignment-menu UI (a genuine
    click, not a debug shortcut) correctly set the job and promoted the villager (`soldier:true`,
    `hp:80`, `weapon:'bat'` — confirming `promoteGuard` specifically, not a stray `promoteSoldier`
    call); moving the player 700+ units away and simulating ~6s left the guard sitting within 26px
    of their post, confirming they hold ground instead of tailing the player; a manually-spawned
    intruder placed near an on-duty guard was found, closed on, and killed within ~9 simulated
    seconds with the guard taking zero damage; the same intruder placed next to a *demoted* (idle)
    villager instead chased them down and did real, escalating damage (80 → 17 HP) completely
    unopposed. No console errors at any step, and the new job renders correctly (icon + label + no
    layout break) in the live assignment menu.

- **2026-09-17b — a "ready again" cue for perk cooldowns, and confirming Esc already pauses.**
  User: "with the 'perks' they have a cooldown. Can you have a little 'burp' and sound to notify
  the player that it's recharged and ready to reuse? Also can you make the 'esc' key also pause
  the game."
  - Before this, the only cooldown feedback was the `#traithud` key badge (static, no countdown)
    and a "Xs" popup if you tried to use it too early — nothing ever told you the moment it actually
    became available again. Added a check right at the cooldown decrement in `updatePlayer`, on the
    exact frame `player._activeCD[id]` crosses from >0 to 0 (guarded by the same `>0` the decrement
    already ran under, so it can only ever fire once per use, never on every later frame it just
    sits at 0): a new comedic little `A.S.perkReady()` — a quick two-note wobble on the same
    sawtooth palette as `screech`, on-brand for a dark-comedy game rather than a plain chime — plus
    a "🧛 ready!"-style popup over the player using the trait's own icon.
  - Investigated the Esc request before touching anything, since the code already looked like it
    should pause: Esc's fallback case (when no other panel/modal has already claimed it) calls
    `toggleSettings()`, which sets `paused = true` in the same breath as opening the settings panel
    — and the main loop skips `step(dt)` entirely whenever `paused` is true, so nothing in the
    world can move, attack, or tick while it's open. Verified live rather than assuming: spawned a
    hostile in the city, dispatched a genuine `Escape` keydown (not a debug shortcut), confirmed
    `paused` flipped true and the settings panel opened, then let 3 real seconds pass — the enemy's
    x/y were bit-for-bit identical before and after. **No change needed** — Esc already pauses the
    game fully; happy to add a separate lighter-weight "just pause, no menu" binding if that's
    specifically what was wanted instead of what's already there.
  - Verified live: spying on `A.S.perkReady`, granting a temp trait with a real active ability,
    using it, and fast-forwarding past its cooldown via the exposed `tick()` helper showed the cue
    fired exactly once (`burpCount: 1`) right as the cooldown hit 0, not repeatedly afterward.

- **2026-09-17c — Ogre's Ground Pound: bigger, real damage, actually wrecks the place.** User: "for
  the Ogre attack, can you please increase the AOE area and [add] a animation of a ripple of dust
  leaving the ogre as his seismic slam ripples through the ground. I also want it to damage/destroy
  nearby objects and NPCs" (part of a broader "improve the visuals on electricity/ice/slime" goal —
  noted for a future pass, this entry is just the concrete Ground Pound ask).
  - Was knockback + a brief stun only, `r:150`, no damage, nothing touched the world. Radius bumped
    to 240 (a real, meaningfully bigger blast, not a token increase). Added genuine distance-falloff
    damage (`12` to `42` depending how central the hit was) alongside the existing knockback — the
    knockback stays a hand-set velocity rather than `damage()`'s own, so the two don't stack (see
    the `knock:0` passed to `damage()`).
  - Now actually wrecks nearby props too, via `hurtProp` — the same "an AOE gets every prop type's
    own per-type destruction for free" trick every explosion in the game already relies on, so a
    crate/barrel/car caught in the blast just breaks/explodes exactly like it would from any other
    hit, with zero new per-type code.
  - Caught and fixed a real gap while in there: the original enemy-loop had no `o.villager`
    exclusion at all (`nearestFoe` and most other combat code do) — harmless back when this was
    knockback-only, but with real damage now added it would have let the ability hurt or kill the
    player's own villagers if ever used at home. Excluded villagers explicitly.
  - New visual: two staggered expanding "shock ring" effects (reusing the exact same `fx.push({t:
    'shock', ...})` shape `explode()` already uses for blast rings — no new rendering code needed)
    in dusty tan/brown tones, plus a scatter of dust particles kicked up along the ring's leading
    edge for the "ripple of dust ... slam ripples through the ground" look specifically asked for.
  - Verified live: three enemies planted at 80/190/300px — 190px is the key case, inside the NEW
    240 radius but outside the OLD 150 one — took 32 / 18.25 / 0 damage respectively, confirming the
    radius increase is real and the falloff behaves; a villager planted at just 60px (point-blank)
    took zero damage, confirming the new exclusion holds even at the worst-case distance; a nearby
    crate was destroyed by the same trigger. A live screenshot shows both shock rings expanding
    together with dust kicked up along the front one's edge, and the updated in-HUD perk
    description ("a wide seismic shockwave that knocks back, damages, and wrecks…") rendering
    correctly. Zero console errors.

- **2026-09-17d — electricity visuals, and two real animal-rendering bugs.** User: "Let's do the
  electricity effects next. Also animals suck. They don't match the existing style at all and the
  weird perspective often has them running upside down or floating on top of things."
  - **Electricity**: the wet-chain damage logic already existed, but every part of its VISUAL was
    thin — the `spark` hazard fell through to the same flat translucent oval every hazard type gets
    by default (nothing about it read as electric), and `electrocute()`'s inter-actor arc was a
    handful of static dots jittered along a straight line, not anything that looked like lightning.
    Added a reusable jagged `'bolt'` `fx` type (drawFx) — a zigzag re-jittered fresh on every single
    draw call rather than fixed at creation, so it genuinely flickers/crackles instead of holding
    one static shape — and used it in three places: `electrocute()`'s chain arc, a proper crackling
    ground-glow + radiating mini-bolts for the `spark` hazard itself (`drawHazards`), and a burst of
    short bolts on every direct taser/prod/zapstaff hit (`weaponFx`) so a plain zap reads as electric
    on its own, not just a yellow burst + a light flash.
  - Caught a real bug while wiring the last of those in: `weaponFx`'s own top line was
    `const fx = wp.hitFx;` — a LOCAL variable named `fx` that shadowed the module-level `fx` array
    (the visual-effects list) for the entire function, so `fx.push(...)` inside it was actually
    calling `.push()` on a *string* like `'spark'`, not the effects list. Renamed the local to
    `kind` throughout that one function; everything reads from the real array again.
  - **Animals**: `drawDog` (every kennel pet — dog/cat/lion/bear) used to rotate its ENTIRE
    silhouette by its raw movement angle (`octx.rotate(dog.ang)`). Past a quarter-turn that's a
    creature drawn sideways or genuinely upside down — every other actor in the game (`drawActor`)
    stays a fixed top-down silhouette and only ever flips left/right, never spins, which is exactly
    the "existing style" mismatch reported. Its ground shadow was ALSO drawn inside that same
    rotated space, so it swung around with the body instead of staying planted on the ground — the
    "floating" half of the report. Rewrote to match `drawActor`'s own convention: fixed orientation,
    mirrored left/right off the sign of the movement angle's cosine (falling back to facing right
    when there's no `.ang` at all, which is genuinely true for a leashed dogwalker's companion — a
    second, previously-latent bug: `drawDog` reused for that case would have rotated by `undefined`,
    i.e. `NaN`, every single frame), shadow drawn in world space before any transform.
  - Second, separate "floating on top of things" cause: loose kennel pets (owner-less, i.e. escaped
    from a broken kennel prop) were drawn in their own pass placed AFTER the entire y-sorted prop/
    actor list, so one always rendered on top of every wall and prop regardless of its actual depth
    — walking behind a car still drew in front of it. Given a real sort slot in the same `_dl` list
    everything else uses (new `kind` 12), and the old always-on-top pass removed. A leashed
    dogwalker's companion was never affected by this specific bug (it's drawn from inside its
    owner's own already-correctly-sorted `drawActor` call) — only the loose, ownerless case was.
  - Verified live: a bear planted moving left (the exact case that used to render upside down)
    rendered as a normal right-side-up mirrored silhouette with its shadow correctly underneath, not
    swung off to one side; the same bear placed just behind a parked car had its lower half correctly
    occluded by the car with only its head/back poking out above it, instead of drawing fully on top;
    triggering a taser hit between two wet actors produced a real jagged crackling bolt (screenshot
    confirmed) with zero console errors, where the fx-array/local-variable collision would previously
    have thrown on every single spark-flavoured hit.

- **2026-09-17e — guards get real weapon variety and actually patrol the beds.** User: "Can you
  give the guard profession a variety of basic weapons too? Nothing that'll burn down the village.
  Also can they patrol the base? or at least the sleeping areas where the sleeping villagers would
  be the most vulnerable? Let me know if you can set that route yourself or if it's easier for the
  player to designate an area for the guard to patrol?"
  - **Weapons**: was hard-coded to `'bat'` for every guard. New `GUARD_WEAPONS` pool (`bat, pipe,
    knife, sledge, spear, whip, springfist, katana, prod, zapstaff, trout`) — melee only, and
    nothing with `hitFx:'fire'`, so nothing in the pool can ever ignite a building. `promoteGuard`
    now rolls one at random per guard, so several guards visibly carry different weapons.
  - **Patrol — went with the automatic route** rather than a player-drawn one: a new
    `guardPatrolPoints()` reads every currently-bedded villager's `rec.bed` LIVE (not a route
    captured once at promotion time), so a guard's beat automatically follows wherever beds actually
    are as the village grows or gets rebuilt, with nothing for the player to draw, save, or keep in
    sync by hand — falls back to the campfire if nobody has a bed yet. `updateSoldier`'s idle branch
    (previously a single fixed `_guardPost`) now walks the guard between these points in sequence,
    pausing 2.5–5s at each like an actual watch stop before moving on, only while no threat is
    present — a threat still fully interrupts the beat and engages exactly as before. A manual
    player-drawn patrol area would need a whole new path-drawing UI, persistence, and per-guard
    route editing for comparatively little gain over "just follow the beds" once the beds are
    already the thing being protected — happy to revisit if the automatic route ever falls short in
    practice (e.g. a very spread-out village).
  - `e._guardPost` (a single point) replaced by `e._isGuard` (the marker the promote/demote sync and
    `updateSoldier` now key off) + live per-frame `guardPatrolPoints()` lookups; `demoteSoldier`
    (shared with `muster()`'s ordinary stand-down) now also clears the guard-specific fields so a
    later, unrelated raid-squad promotion can't inherit a stale patrol.
  - Verified live: 4 villagers given beds at different points and assigned `guard` all promoted with
    genuinely different weapons (`prod`, `sledge`, `springfist`, `pipe`) and staggered starting
    patrol indices; simulating 30s of real movement showed guards actually walking between different
    bed positions, not standing still at one fixed spot; a threat spawned mid-patrol was still found
    and killed with zero damage taken, confirming combat still fully overrides patrol. Zero console
    errors.

- **2026-09-17f — mission failure now gets announced, with a road home.** User (mid-conversation):
  "if you accidentally kill the target of the kidnap missions - can you announce that the target is
  dead and then direct the player towards the exit. Same for all the mission types (i.e. collect
  item)." Two real gaps, found by tracing `damage()`/`urgeMet()` rather than guessing: a kidnap
  target's protection in `damage()` only holds while `!t.dazed` — once bonked senseless (the normal
  way you're meant to subdue one), a follow-up hit or an explosion falls straight through to real
  death, with nothing ever telling the player it happened; an errand item already flashed a
  transient "destroyed!" popText on the spot but never said what to do next, and the mission's own
  "have you got it" check (`gotObject`/`player.carrying`) just quietly kept failing forever after.
  - New `failMissionObjective(reason)` — sets `mission._objFailed`/`_objFailReason` once (a second
    call on the same trip is a no-op, verified) and raises a `flash()`. Hooked into `killActor()`
    right where a target actually dies (only when it's *the* mission's `targetRef`, and not if the
    player is mid-carry — grabbing them alive still wins normally), and into both branches of
    `breakNearbyErrandItem()` (a carried object smashed, or a dropped one destroyed before pickup).
  - The exit itself (`mission.exitRect`) was already always signposted from the moment a mission
    starts — blue while in progress, green once done — it just had no failure colour. Added a third,
    amber state to that same signposting: `drawExitStrip`'s pulse/dash/line-width, and
    `drawObjectiveHUD`'s label + off-screen chevron, all now switch to amber and point at the exit
    the instant `_objFailed` flips, using the exact same "which road" math the done-state already
    had — no new pointing/visibility logic needed, just a third branch on top of it. The exit-zone
    leave flash in `tryInteract` picks a matching amber/consolation line ("no shame in it — there's
    always next time") instead of the normal one when leaving after a failure.
  - Verified live: killing a dazed (not-yet-grabbed) kidnap target set `_objFailed` with the right
    reason string exactly once, even when the kill was repeated; smashing a carried errand item
    cleared `player.carrying` and set the same flag with an item-specific reason; drawing several
    frames with `_objFailed` true (amber exit strip + HUD) threw no errors.

- **2026-09-17g — Mole rebuilt into a steerable underground tunnel.** User (mid-conversation): "an
  animation of the player tunneling through the ground cracking the ground above it - as well as a
  hole where he jumped in through the ground causing AOE damage. Then the player can maneuver
  beneath the ground damaging anything above it. I want the player to be able to steer the
  tunneling and then once it's 5s duration is over he bursts back up through the ground doing AOE
  damage." The old Mole active was an instant, durationless short teleport — none of that survived.
  - `p.noclip` — the exact field Vampire's Wing Out already uses (`moveActor`'s `if (a.noclip)`
    branch bypasses collision and clamps to zone bounds) — does the entire "steerable AND passes
    through walls" job for free: normal WASD in `updatePlayer` is completely untouched, `noclip` just
    stops the collision check, so the tunnel is driven by the same input the player already has.
  - New `active.use`: sets `_moleT = 5`, flips `noclip` on, fires an entry `moleBurst` (knockback +
    damage to nearby enemies, `hurtProp` to nearby destructible props — same "AOE gets every prop's
    own destruction for free" trick the Ogre's Ground Pound uses). New `tick(p,dt)`: counts `_moleT`
    down, calls `moleDamagePulse` roughly every 0.22s ("damaging anything above it" as it travels,
    not just at the two ends), scatters dirt particles and bakes a fading cracked-earth decal trail
    behind the burrow. At `_moleT <= 0`: clears `noclip`, nudges the player out of any solid geometry
    it might have popped up inside (same safety loop pattern as everywhere else that reuses noclip),
    and fires an exit `moleBurst` — the "bursts back up through the ground doing AOE damage" beat.
    New `drawMoleForm` replaces the normal sprite the whole time: a squat mound with a lighter cap
    and a few whisker-lines that slowly rotate, wobbling gently, shadow drawn separately so it
    doesn't float. `TEMP_TRAIT_ACTIVE_FIELD`/`clearTempTraits()` extended (`mole: '_moleT'`) so a
    temp Mole wiped mid-tunnel (e.g. a zone change) also resets `noclip` and unsticks the player,
    same as the existing Vampire case.
  - Verified live end-to-end: activating set `noclip`/`_moleT` correctly and the entry burst
    genuinely damaged/knocked back a nearby test enemy; over the 5s window `moleDamagePulse` chipped
    away at an enemy standing over the tunnel in several distinct hits, not one lump; at `_moleT`'s
    natural expiry `noclip` reset to `false` and the exit burst fired its own separate damage/
    knockback; `drawMoleForm` rendered several frames with zero console/draw errors both mid-tunnel
    and at rest. (Tripped over an unrelated pre-existing engine quirk while testing: `updatePlayer`
    briefly no-ops for a fixed window right after a raw debug `enterZone()` call, unrelated to Mole —
    worked around it in the test harness, not a real gameplay bug since a normal zone entry doesn't
    hit it the same way.)

- **2026-09-17h — pausing looked complete but the weather never actually stopped.** User: "Pausing
  seems to stop the people but things keep occuring that shake the screen - as if the environment
  is not paused." Correct: `step()` (all actor/combat simulation) is fully skipped while `paused`,
  but `updateAmbient()` — rain, wind, and lightning — was called unconditionally from `draw()`,
  which runs every real frame regardless of `paused`. A lightning strike during a storm calls
  `shake()`, can genuinely zap a wet actor or blow out a lamppost via `hurtProp`, and none of that
  cared whether the settings menu was open. Fixed with one guard: `if (!paused) updateAmbient(_dz);`
  — weather now freezes solid the instant the game pauses, same as everything else. Verified live:
  with rain forced to maximum and the game paused via a real `Escape` keypress, the weather clock
  (`weather.t`) stayed at exactly 0 across repeated render passes representing several seconds of
  real time; unpausing let it start advancing again immediately.

- **2026-09-17i — electricity now actually rides the rain.** User: "I just broke a TV in the rain
  and it barely spread at all. Don't forget I asked for the electricity to pass through the water.
  So if it's raining then the electricity damage should spread MUCH MUCH further." The spark
  hazard's radius, `electrocute()`'s actor-to-actor chain distance and falloff, and the cosmetic
  puddle-arcing were all fixed numbers with no idea the weather existed. New `rainConductMul()`
  (`1 + weather.rain * 3`, city only) feeds all three, so a downpour makes a single zap reach up to
  4x further across the board — one helper, so a lightning strike, a taser hit, a Tesla Grenade, and
  a TV/arcade blowing up all get the same treatment, not just whichever one prompted the report.
  Verified live: an identical spark hazard's radius measured 50px bone dry vs. 200px at full rain;
  a chain test with two wet enemies 220px apart showed zero damage reaching the far one while dry
  (outside the old fixed 100px chain range) and real chain damage reaching it while raining.

- **2026-09-17j — guard patrol becomes a player-drawn circle.** Follow-up to 2026-09-17e, where
  "went with the automatic route" (follow the beds) was the call made at the time. Once actually
  watching it in a spread-out village, the user reported it back: "the guard is just sticking hard
  against the beds. Could the player choose an area (circle) where the guard patrols. The circle
  should be about as big as the circle in [a reference screenshot]. That way if the village is
  spread out the player can decide where needs to be patrolled." Bed positions are packed tight in
  a small hut, so several guards' offsets (a few px each) all landed in nearly the same spot — reads
  as "stuck," not "patrolling."
  - Reused build mode's existing input pattern wholesale rather than inventing a new one: aim with
    the mouse while WASD keeps moving the player, click to confirm, right-click/Esc to cancel (new
    `guardZoneMode` + `toggleGuardZoneMode`, slotting into the same `mousedown`/Escape-priority
    chains `buildMode` already uses). Entry point is a new row in the per-villager Assign panel that
    only appears once someone's actually a guard: "Set/Move patrol area."
  - `village.guardZone = { x, y, r, pts }` — `pts` (a ring of 6 stops scattered through the circle,
    `makeGuardZonePts`) is rolled ONCE, the moment the zone is dropped, and stored on the zone
    itself. `guardPatrolPoints()` now returns that fixed set when a zone exists, falling back to the
    old bed-based beat (then the campfire) otherwise — deliberately NOT regenerated on every call
    (it's read every frame per guard), which would have jittered every stop's position constantly
    instead of giving guards an actual fixed beat to walk. Dropping a new zone re-staggers every
    existing guard onto it immediately. A faint permanent ring marks a set zone; a bright dashed one
    follows the mouse while aiming.
  - Verified live: a hand-placed guard, given a zone 300+ world units from its spawn, walked itself
    into the zone and then visited 7 distinct points scattered through the circle over 60 simulated
    seconds — not clustered on one spot — landing within the zone's actual radius the whole time.

- **2026-09-17k — patrol zones go per-guard, with an adjustable radius.** Immediate follow-up to
  2026-09-17j, before it even got used in practice: "Could you make the patrol area size adjustable
  with the scroll wheel? Also can you bring up the dialogue to set or adjust the patrol area when
  assigning that individual guard? Otherwise EVERY guard will be stuck patrolling the same area."
  Correct catch — `village.guardZone` was a single village-wide field, so every guard read the exact
  same zone; a second guard could never be given a different beat.
  - Moved the zone onto the individual villager record instead: `rec.guardZone = { x, y, r, pts }`,
    keyed by that guard's own `_vid`. `guardPatrolPoints(e)` now takes the guard and looks up ITS OWN
    record's zone first, falling back to the shared bed-based beat only for a guard who hasn't been
    given one yet — so a village can freely mix "this one covers the north gate," "that one covers
    the sleeping huts," and "this other one just follows the old bed beat," all at once.
  - The Assign-panel entry point already existed (2026-09-17j put it there); the fix was making it
    open placement mode FOR that specific villager (`guardZoneTargetVid`, set from `doAssign`'s
    `assignRec()`) rather than for the village as a whole, and having the confirm-click write onto
    `rec.guardZone` instead of a shared field. "Move patrol area" on an existing guard now seeds the
    radius from THEIR current zone, not a fresh default, so nudging one guard's beat doesn't reset
    its size.
  - Scroll wheel resizes while aiming (new `guardZoneRadius`, ±14 world units per wheel tick, clamped
    60–480), same wheel slot `buildMode` already uses to cycle its piece carousel — the two modes are
    mutually exclusive so there's no conflict. The dashed preview circle and the hint text
    ("scroll to resize") both reflect the live radius as it's adjusted.
  - The persistent-marker draw pass now walks every villager and draws a faint ring for each one's
    own zone (skipping only whichever guard is actively being re-aimed, so its bright preview isn't
    doubled by its own faint ring underneath) — so a village with several independently-zoned guards
    shows all of their beats at a glance, not just one.
  - Verified live through the real UI path, not just the underlying data: opened the Assign panel for
    a test guard, clicked "Set patrol area," scrolled to grow the preview circle, moved the mouse and
    clicked to confirm — the resulting `rec.guardZone` landed exactly at the clicked world position
    with the enlarged radius, and the guard's `_patrolIdx`/`_patrolWaitT` reset cleanly. Separately,
    two guards given zones on opposite sides of the village (800+ units apart) each settled and
    patrolled within their OWN zone's radius, never drifting into the other's — confirming the
    original "every guard stuck on the same area" bug is actually gone, not just hidden.

- **2026-09-17l — Marksman's Called Shot becomes a real traveling round; Cannibal's Feast becomes
  a real mess.** User: "With the marksman perk - can you make the bullet visible and make a big
  puff of smoke appear from the player before the bullet rips through the enemies. Make blood spray
  from any NPCs hit by the bullet and building and items take damage as the bullet passes through.
  With the cannibal trait, when using 'feast' can you make the body being eaten explode into blood/
  gore, leaving uneaten body parts and bones behind. Player should have blood appear around their
  mouth and shirt while active."
  - **Called Shot** used to be pure instant math: every enemy in a narrow cone got damaged in the
    same frame, with one small burst() at the muzzle and nothing else — no travel, no visible round,
    and `lineBlocked` meant a prop standing in the way silently protected whoever was behind it
    instead of taking any damage itself.
  - New `gunSmokePuff(x,y,dir)` — a big, slow, grey-white cloud (bigger/softer particles than the
    sharp little `burst()` used for ordinary hit impacts) fired from the muzzle the instant the
    ability triggers, before the round itself starts moving.
  - New `fireCalledShot(p)` / `updateCalledShots(dt)` / `drawCalledShot(s)`, backed by a dedicated
    `calledShots` array — deliberately NOT the shared `bullets` array, since `bullets` breaks on its
    first hit (see `updateBullets`) and rewriting that shared behavior risked changing every other
    gun in the game to pierce things it shouldn't. `fireCalledShot` does the same angle/range enemy
    search as before (minus the `lineBlocked` exclusion) PLUS a walk down the ray for the first real
    wall (an absolute stop) and every destructible prop crossing the line before that wall (pierced
    through, not skipped past), then sorts everything by distance. `updateCalledShots` walks a point
    down that precomputed line over time (1700 px/s) and fires each hit's damage/effects at the
    moment the visible round actually reaches it — blood spray + a handful of flung particles for an
    enemy, `hurtProp` for a prop, `damageCell` if it ends at a real wall — instead of all at once at
    t=0. `drawCalledShot` renders a bright tracer with a fading tail behind the actual travel point,
    so "the bullet visible" is genuinely a moving thing on screen, not a flash.
  - **Feast** used to just set the eaten body's `corpseT` sky-high so the ordinary corpse-cleanup
    sweep removed it next frame — nothing ever actually appeared where the body had been, and the
    one `burst()` was centred on the PLAYER, not the corpse. New `goreExplode(x,y)` (called at the
    corpse's own position): a big blood burst plus chunkier flung "meat" gib particles (bigger,
    slower, browner — read as separate from the fine blood mist), then real PERSISTENT decals baked
    into the ground via `bakeDecal` — several overlapping blood-pool blobs plus a few pale bone/
    gristle fragments through it — since the corpse itself still vanishes almost immediately, these
    decals are what's actually left behind to look at.
  - The player's own mouth/shirt blood is drawn in `drawActor`, gated on `_feastT > 0`: a smear
    across the mouth/chin, a drip below it, and a stain soaked into the shirt front, all fading in
    over Feast's first ~1.2s and back out over its last ~1.2s (`_feastT` counts down from 6) rather
    than popping on/off at full strength.
  - Verified live: activating Called Shot queued a traveling shot with zero damage applied yet
    (confirming it's no longer instant); 0.6s later, a near enemy (60px) and a far enemy (250px)
    both took damage — the far one noticeably MORE, correctly preserving Marksman's own "farther hit
    lands harder" distance scaling — and a destructible crate placed directly between them was
    destroyed WITHOUT stopping the round from reaching the far enemy, confirming real piercing
    through props. The `calledShots` list correctly emptied itself out again a few frames later.
    Feast: activating on a corpse healed the player exactly 35% of max HP, set a 6s `_feastT`, and
    marked the corpse for cleanup; rendering several frames with `_feastT` active (the new mouth/
    shirt overlay) threw zero errors.

- **2026-09-17m — Called Shot: nothing stops it, twice the reach.** Immediate follow-up. User:
  "Nothing should stop that 'called shot' and its distance should reach twice further than it
  currently does." Range doubled, 500 → 1000. The real-wall stop from 2026-09-17l was removed
  outright: a solid wall cell on the line is now just another thing on the precomputed hit list
  (deduplicated per distinct cell so a whole run of wall along the shot's path each takes its own
  hit, not just the first one touched) — damaged via the same `damageCell` a wall already takes from
  anything else, but no longer a hard stop that cut the shot short and hid everything behind it.
  Enemies and props past a wall are now fully hittable, same as they already were past each other.
  Verified live: fired straight at a real city building wall with one enemy just past it (400px) and
  a second sitting near the new 1000px limit (950px, well outside the OLD 500px range) — the wall
  cell itself took enough damage to break (`cellSolid` flipped from `true` to `false`), AND both
  enemies behind/beyond it took real damage from the same shot, which the pre-follow-up version
  would have completely blocked at the wall and never even attempted.

- **2026-09-17n — found the actual cause of the persistent village lag.** User, a third time on the
  same F8 report: "It still is laggy if I return to the village after dying in the city due to big
  explosions or in this case from electricity." The earlier "try reloading the page" answer treated
  this as a browser hiccup; going back to actually read what `blit` (the one segment eating nearly
  all of `draw`'s time, both times reported) does in the code turned up a real, permanent bug
  instead — `drawActorTranslucent` (used to render the player see-through — Ninja's Vanish, Ghost's
  passive, hidden in/behind a van, **or driving any commandeered car**) calls `octx.getImageData()`
  / `putImageData()` directly on the MAIN offscreen canvas to do a true per-pixel blend, since
  `drawActor`'s hundred-plus `octx.fillRect(...)` calls can't cheaply be redirected to a scratch
  canvas instead. Reading pixels back off a canvas like that is a well-documented way to knock a
  Chromium canvas off the GPU-accelerated path — once it happens even ONCE, every later draw to
  that same canvas element (including `blit`'s own single full-screen `drawImage`) gets dramatically
  slower, and it doesn't recover on its own, since the canvas element itself isn't recreated on a
  zone change — only a full page reload gets a fresh one. "Big explosions" and "electricity" were
  the trigger the user happened to notice, but the actual likely culprit is far more mundane and far
  more frequent: `playerVisualAlpha` returns exactly `0` (fully invisible) while driving a car, mid-
  van-intro, or mid-getaway, and the OLD code ran the full getImageData/putImageData round trip for
  those too — meaning any city visit that included so much as a few seconds behind the wheel of a
  commandeered car (an advertised, common thing to do in this game) could have already poisoned the
  canvas for the rest of the session, well before whatever explosion or shock actually killed the
  player. The village slowdown afterward was just that pre-existing damage finally being reported.
  - Fix: when computed alpha is exactly `0`, skip the draw entirely instead of calling
    `drawActorTranslucent` — "blend nothing at full transparency" and "don't draw at all" are the
    same visual result, so this is a free, zero-risk win that removes the getImageData call from the
    driving/van-hidden cases completely. Ninja's Vanish (0.22) and Ghost's passive (0.55) still need
    a real partial blend and still go through the getImageData path — much rarer in practice (a
    handful of seconds every 15s+ cooldown, instead of the entire time spent driving) and left alone
    for now rather than risk a deeper rewrite of `drawActorTranslucent` under time pressure.
  - Verified live by monkey-patching `CanvasRenderingContext2D.prototype.getImageData` to count
    calls: entering a car and rendering 5 frames while driving produced ZERO getImageData calls
    (previously: one full pixel-readback round trip on the main canvas per frame, indefinitely, for
    as long as the player kept driving); activating Ninja's Vanish and rendering 5 frames still
    correctly produced 10 calls (2 per frame, the legitimate before/after snapshot), confirming the
    real translucency effect was left intact for the cases that actually need it. Zero draw errors
    in either case.

- **2026-09-18 — a broader improvement pass: visuals, onboarding, (enemy/mission variety and perf
  still to come).** User, asked for open-ended suggestions: "Please do all of them except for the
  trait/perk balance pass. I'm hoping to work on each of those individually and then balance them
  once they look more like what I envisioned."
  - **Finishing the elemental visual pass** (started 2026-09-17d with electricity): ice and slime
    hits were still using a plain round `burst()`, the flattest-looking impacts left in an otherwise
    flashy combat system. New `'shard'` fx type (`drawFx`) — a handful of jagged crystal spikes
    radiating from the hit point, growing fast then fading, same "few cheap re-jittered shapes"
    approach as electricity's `'bolt'` fx — used on every ice hit. Slime hits now fling 6 chunkier
    globs (up from 3 tiny particles) AND bake a real lingering splash decal into the ground via
    `bakeDecal`, since a "real glob" that vanished without a trace never actually looked like it had
    landed. Acid got the same decal-and-bigger-splash treatment for consistency (it's visually the
    same "goo" family as slime). Verified live: triggering `weaponFx` with each of `ice`/`slime`/
    `acid` and rendering several frames produced zero draw errors.
  - **Onboarding**: the game already has a persistent on-screen control legend (WASD/E/craft/build
    keys), so the actual gap was WHY and WHEN, not WHICH button. New `tip(id, title, col, text)` —
    reuses the existing `flash()` banner (no new UI) and `store` (so, like every other save, it's
    per profile and never repeats once seen) — fired at four natural first-encounters: heading into
    the city for the first time (objective/exit/Wanted), first opening the craft menu, first
    entering build mode, and first assigning someone as a guard (which also plugs the brand new
    patrol-area feature — "open their Assign panel again to draw a custom patrol area"). Verified
    live: opening craft and build twice each only recorded (and only would have shown) the tip once;
    `sb_tips` correctly accumulated `["craft1","build1"]` in storage.
  - **Mission variety**: every existing urge (`URGES`) was a fetch quest — bring home a person, an
    object, cash, or groceries. New `grudge` urge is the odd one out on purpose: find someone in the
    city and beat them down, nothing to carry home. Reuses the exact same `isTarget`/`dazeHp` "bonk
    them senseless" mechanic kidnap already has end to end (`missionSpawnObjective`, `damage()`'s
    isTarget branch) rather than inventing a new one — completion is just `mission.targetRef.dazed`
    (`urgeMet`), no bodyguards spawned (a private grudge, not a guarded kidnap target), and
    `grabTarget` short-circuits with a flavour line instead of accidentally starting to carry them
    when the player presses E nearby. The dazed-target "E carry them" HUD prompt and the "keep
    bonking"/"out cold" flash lines are all worded appropriately for a grudge instead of a real
    kidnap. Verified live end-to-end: fixated a grudge urge, entered the city, confirmed the target
    spawned with `isTarget`/`dazeHp` and no bodyguards, damaged it to `dazed`, and confirmed a real
    `tryInteract()` E-press beside it left `player.carrying` untouched (no accidental grab) — the
    exact bug this needed to avoid.
  - **Enemy variety**: `freezeray`/`slimegun`/`acidspray` existed as real weapons (craftable, and in
    the AI-generated roster's own gun pool) but a base `gunner` enemy could never actually roll one
    — meaning a normal street fight almost never triggered the ice/slime/acid hit visuals just
    finished above. Gave `gunner` a dedicated ~18% slice of its weapon roll for exactly those three,
    so the new visuals actually see regular play instead of sitting mostly unused. (A deeper new
    enemy archetype was more integration surface — faction weapon pools, elite-alt lists, ambient
    population weighting — than felt safe to take on blind in the same pass; flagged as a possible
    follow-up rather than rushed.) Verified live: 400 sampled `gunner` spawns produced freezeray/
    slimegun/acidspray at ~6% each, matching the intended slice.
  - **Perf pass**: `pruneDeadProps` (added earlier this project) already fixed exactly this problem
    for `props` — a corpse past its own fade window was still being swept with a full
    `enemies = enemies.filter(...)` EVERY SINGLE FRAME, unconditionally, the identical
    "filter+reallocate every tick" cost already identified and fixed for props, just never carried
    over to `enemies`. New `pruneDeadEnemies`, throttled the same way (a dead entry is already
    nearly free to leave sitting in the array a few extra seconds — `updateEnemy`'s very first line
    is `if (e.dead){ e.corpseT += dt; return; }` — so throttling costs nothing visible). Verified
    live: a corpse past its fade window stayed in the `enemies` array through 2 simulated seconds
    (below the throttle window) and was gone by 5 (past it). Full chunk unloading (chunks stream in
    as the city is explored but never unload during a visit — flagged in an existing code comment as
    "a real gap") was deliberately NOT attempted here: chunks are regenerated from a seeded RNG with
    no memory of what was destroyed/looted, so unloading one for real needs a per-chunk persistence
    layer to avoid a "leave and come back to reset everything" exploit — a bigger, riskier feature
    than fit safely alongside everything else in this pass.

- **2026-09-18b — animals actually redrawn this time, and grudge missions pay out.** User: "Did you
  ever redraw the animals to better match the style of the humans? (less round - more pixeled)
  Please do that." Honest answer at the time: no — 2026-09-17d only fixed the rotation/shadow/
  z-order bugs while keeping the exact same shape language. `drawDog` was still two smooth ellipses
  (body, head) plus an ellipse eye and a curved tail, where every human (`drawActor`) is built
  entirely out of flat-shaded `fillRect` blocks — round next to blocky, the actual complaint. Now
  rebuilt out of the same rect/straight-line vocabulary: the body and head are outlined rects
  (`fillRect`+`strokeRect`) instead of ellipses, the eye is a small filled square instead of a
  circle, and the tail is a straight 2-segment bent line instead of a smooth `quadraticCurveTo`
  swoop. Ear triangles and the mane were already angular/kept a chunky rect treatment respectively
  — those weren't the problem. Verified live: spawning a dog and a bear kennel pet and rendering
  several frames produced zero draw errors (a full DOM-overlay screenshot proved awkward in the
  debug harness, same title-panel artifact as earlier in the session, but the render path itself is
  confirmed exception-free).
  - Separately, user: "what is the benefit of doing those grudge missions? The player needs a reward
    otherwise they'll always just choose the kidnap missions." Fair catch — `completeUrge` had no
    `grudge` branch at all, so it fell through to the generic 35 XP default while kidnap grows the
    village and errand/money/groceries hand back a keepsake or real resources. A grudge doesn't
    bring anything material home BY DESIGN (that's the point of it), so the payoff is real cash
    instead — "shook them down while they were still down," scaled with village prestige the same
    way the money urge's own demand already is — plus a higher XP payout (55) than the other fetch
    quests (25–30), since it's a straight fight with no bodyguards to lean on for cover. Verified
    live: completing a grudge urge with `village.prestige = 3` paid out $50 (within the intended
    15 + prestige*8 + 0-14 range) and incremented prestige as normal.

- **2026-09-18c — guards actually patrol properly, and a villager's death finally sticks.** User:
  "The patrol system still doesn't work well for the guard job. Could you make them move at a
  normal walk while passively patrolling and only run when they spot something." A guard's "no
  threat" branch shared the same catch-up-speed logic a raid-mustered squad member uses to keep
  from falling behind the player (`if (d > 320) spd = 250; else if (d > 190) spd = 205`) — since a
  patrol point can easily be that far away, a guard on its own beat was almost always "jogging,"
  never actually strolling. Guards now skip that catch-up entirely (their own base speed, ~150, IS
  the calm patrol pace) and instead get a real speed BURST (235) the instant `nearestFoe` actually
  finds something — a clean, visible walk-then-run distinction that didn't exist before (even
  combat approach was previously at the same speed as everything else). Verified live: an idle
  guard covered ~131 world units in 1 simulated second (matches its own ~150 base speed, not the
  old 205-250 catch-up); the same guard with a hostile in sight covered ~228 in 1 second, matching
  the new 235 run speed.
  - Mid-conversation follow-up: "he seems to just bash off any walls and get trapped inside
    buildings - Could I instead draw a path that he walks along? Or make him walk the circumference
    of the circle you draw? Whatever you think will work best." Root cause: a patrol point was
    steered toward in a dead straight line, with only `squadAvoid`'s short 30px look-ahead deflection
    as a safety net — fine for swerving around a single obstacle directly ahead, hopeless for
    actually navigating out of a room. Went with a combination rather than a whole new freehand-path
    UI to build and maintain (there's already one of those for build-mode paving, which would have
    meant a second, parallel drawing system): `makeGuardZonePts` now places its stops evenly on the
    drawn circle's own CIRCUMFERENCE instead of scattered through the interior (reuses the shape the
    player already drew, reads as patrolling a boundary), and guard movement toward its current stop
    now runs through the exact same bounded A* (`findPath`) the "lost sight, route to last-seen
    position" chase logic already relies on — own dedicated fields (`_patrolPath`/`_patrolPathIdx`/
    `_patrolPathT`) so the two pathfinding consumers never collide, recomputed only every ~0.6-1.0s
    or when the destination itself changes, falling back to the old straight line only when a route
    genuinely can't be found (out of the 512×512px search box, or truly enclosed). Verified live,
    the hard way: found a real building with two open points on either side of it (a straight line
    between them provably crosses a solid cell), confirmed `findPath` returns a real 34-waypoint
    route around it, dropped an actual guard actor there, and watched it consume that exact route
    and close 40% of the distance to the far side over 20 simulated seconds — genuinely routing
    around the obstacle instead of grinding against it. (Chased a red herring for a while first: an
    early version of this same test kept snapping the guard 80px toward the player out of nowhere —
    turned out to be `zoneBounds()`'s hard position clamp, because the test's own patrol target
    happened to sit right at the edge of the currently-generated city, nothing to do with the guard
    code itself. A second false alarm right after — a live re-test that stubbornly showed no
    pathfinding activity at all — was the debug tab simply still running the page from before this
    edit landed; a reload fixed it, not a code change.)
  - Separately, user (mid-conversation): "if the guard fails and something attacks and kills a
    villager - it should be a permadeath for them." A fallen soldier/guard already gets this — see
    2026-09-18b's note on `completeUrge`, or rather the pre-existing `t.soldier` branch in
    `killActor` — but an ordinary villager never did: their `enemies` actor just faded like any
    corpse while the `village.villagers` record sat untouched, and `spawnVillagers` walks that whole
    list unconditionally on every village load — so they'd simply reappear next visit as if nothing
    had happened. Struck from the roster in `killActor` now too, the same way a fallen follower
    already is, with a matching "[name] didn't make it — gone for good" flash. Verified live: killing
    a villager-flagged actor removed their record from `village.villagers` immediately (confirmed
    `false` on an `.some()` roster check right after), which by itself rules out `spawnVillagers`
    ever bringing them back — there's no record left for it to iterate.

- **2026-09-18d — the actual reason a guard kept "dashing/running everywhere."** User: "He still
  dashes/runs everywhere - the guard. Can you make him walk unless he's actively chasing
  something." 2026-09-18c's walk/run speed fix was real but not the whole story — village threats
  are rare (a 22% roll, once a night, one at a time), so a guard shouldn't have been in "spotted
  something, run" mode nearly often enough to look like a constant problem. The actual culprit was
  one level down: "stuck recovery" (the shuffle-then-teleport safety net for when a wall eats an
  actor's whole intended move for too long — see `_stuckT` in `updateSoldier`) always aimed itself
  at the PLAYER, unconditionally, regardless of what the actor was actually trying to reach. That's
  the right target for a raid-mustered squad member trailing the player around; for a guard walking
  its own patrol beat, it meant every stall — and real village geometry stalls a pathfinding actor
  sometimes even when the route is basically fine — yanked it toward wherever the player currently
  was, anywhere from across the village to a different zone entirely. At the 2.5s escalation that's
  a hard position SNAP up to 220px in one frame, not a walk, which is exactly what reads as
  "dashing/running everywhere": not a speed problem at all, a wrong-target teleport dressed up as
  one. Fixed with a single `recX,recY` "what should recovery aim at" reference — the chased foe's
  position while fighting, the player while trailing them (mustered squad, unchanged), and now the
  guard's OWN current patrol point while on its beat — used by both the 0.8s shuffle and the 2.5s
  teleport instead of hardcoded `player.x/y`. The 2.5s teleport also now drops any in-flight
  `_patrolPath` (`e._patrolPath = null`), since a route computed from the pre-teleport position is
  meaningless from the new one. Verified live: forced a guard into the "badly stuck" state
  (`_stuckT = 3`) with the player placed 7000+ units away in an unrelated direction and a patrol
  target in a third, distinct direction — the recovery teleport moved the guard measurably CLOSER
  to its own patrol point and dramatically farther from the player, confirming it no longer
  chases the player's position at all.

- **2026-09-18e — New Game+ (skeleton).** User, brainstorming depth/replayability: "we could make
  it a NEW country each time... carry over the perks you've unlocked... unlock new research items
  too." Correctly called out as much bigger than a single feature — agreed on a phased build,
  starting with the bare loop everything else plugs into: win, get offered a fresh (harder) country,
  keep everything about the player. Tileset variety, new city objects, new gameplay elements, and
  per-cycle research unlocks are deliberate follow-ups, not attempted here.
  - **The trigger**: "what happens after you win" was, honestly, nothing — closing the mandatory
    post-conquest Legacy stop (`toggleLegacy`'s `legacyForced` case, set by `closeWinScreen`) just
    resumed play on the same, now fully-conquered map with nowhere left to go. That exact moment —
    dismissing that specific stop — is now the New Game+ trigger (`startNewGamePlus`): increments a
    new `village.ngPlus` counter, clears `conquered`/`_winSeen`/`defections`, and regenerates
    `village.country` from scratch.
  - **What carries over vs. resets**: deliberately, only the country map resets. The player's
    village, buildings, villagers, weapon/material codices, and Legacy-unlocked perks all live in
    separate storage/state `startNewGamePlus` never touches — carrying over "for free" was the
    point, not something that needed new plumbing.
  - **Genuine variation, not a reshuffle of the same thing**: `genCountry`'s own seed now folds in
    `ngPlus` (`village.seed ^ 0x9e3779b9 ^ imul(ngPlus+1, 0x2545f491)`) — deliberately NOT touching
    `village.seed` itself, which also drives the player's own home village terrain/chunk generation
    and villager IDs; reseeding that would risk reshuffling the village out from under them on their
    next load. The result: region/tier assignment, node names, and the country's own name genuinely
    differ each cycle, from the exact same save.
  - **"Tougher factions, better loot"**: a flat `ngMul = 1 + ngPlus*0.18` on top of the existing
    tier-based scaling, applied to both the raid boss and every grunt's HP in `spawnRaidFaction`,
    plus the same multiplier on the Legacy Point payout for actually taking a city (capital,
    revolt-retaken, or ordinary) — a harder second campaign pays out more, not just costs more.
  - Verified live end-to-end through the REAL trigger path (not just calling the function directly):
    forced a win state, opened the win screen, clicked the real "Continue" button, then closed the
    resulting Legacy panel through `toggleLegacy(false)` exactly as a player would — `ngPlus`
    incremented, the country name and node layout changed, `conquered` reset to `false`. Separately
    confirmed `spawnRaidFaction`'s boss HP scaled by exactly the intended ratio (1.36x at
    `ngPlus=2`) with a like-for-like same-type comparison.

- **2026-09-19 — New Game+ becomes a genuinely new village, with a flee cutscene.** User, pushing
  the skeleton further: "new village each time. Maybe show a cutscene of you fleeing your capital
  city after being overthrown... you'll get to start your village again but building on your
  learnings and using your unlocks from the previous run and you'll have to build larger and more
  populated villages each time to be able to beat the harder country." Flagged the real tradeoff
  before building it: village relationships/buildings are the most personally-invested layer of
  the game, so a full wipe every cycle risks feeling like punishment unless the carryover is
  generous. User picked (of three offered options) perks + full discovery codex + a resource
  stipend that grows every cycle.
  - **The reset**: `startNewGamePlus` now builds a genuinely fresh `freshVillage()` — population,
    buildings, cult status, day count, every relationship gone — rather than reusing the old
    village object. Carried forward onto it: `codex`/`weaponCodex`/`npcCodex` (the full weapon and
    material discovery knowledge — "you remember how to make things even if you're rebuilding from
    nothing") and a stipend (`20 + ngPlus*15` wood, `10 + ngPlus*10` stone) that grows every cycle,
    so cycle 3 doesn't start from the exact same zero as cycle 1 — a concrete, visible answer to
    "why is this easier to start than the first one." Legacy perks needed no new plumbing at all —
    they already live in entirely separate storage untouched by any of this.
  - **The cutscene**: a new `#ngplusflee` panel (same structural pattern as `#winscreen`) with its
    own small dedicated canvas (`drawFleeArt`), reusing the exact same lightweight "plain 2D draw
    calls, no new animation pipeline" approach the title screen's own little diorama already uses
    (`drawTitleArt`) — including its `drawRunner` silhouette helper for the player figure. A
    burning capital skyline, rising embers, and a line of flavour text naming the country that was
    just lost, with its own "Found a new village" button (and Escape support, matching the
    win-screen's own "Escape also just proceeds" convention) that actually triggers the reset —
    dismissing the mandatory post-win Legacy stop now shows this FIRST, and `startNewGamePlus`
    itself only runs once it's dismissed.
  - Player position needs no special handling — `enterZone('village')`, called at the end of the
    reset, already unconditionally plants the player on the new village's own canonical spawn
    point; an earlier draft that manually forced `player.x/y` to `0,0` first was dead code once
    that was noticed, and got removed. `carrying`/`holding` are cleared — you fled with your own
    two hands, not a kidnapped target or a bulky object from a village that (from the new one's
    perspective) no longer exists.
  - Verified live end-to-end through the real UI path (win screen → real "Continue" click → real
    Legacy-panel close → real "Found a new village" click) with realistically-shaped carryover
    fixtures (a full villager record via the game's own `randPerson()`, a properly-shaped codex
    material AND weapon entry, complete with the `.name`/`.spec` fields `registerCodexMaterial`/
    `registerCodexWeapon` actually need): the new village generated all 25 chunks cleanly, the old
    village's population and buildings were gone, both discovery codices survived intact, the
    resource stipend matched the formula exactly, and the player landed on the correct spawn point.
    (Chased three self-inflicted false alarms getting there — hand-rolled codex/weapon test
    fixtures missing fields like `.name` or `.spec` that real discovered entries always have threw
    deep inside pre-existing, unmodified codex-registration code, aborting the village reset
    partway through and briefly looking like a real bug in the new feature. It wasn't — every
    failure traced back to invalid test data, not the shipped code.)

- **DESIGN (agreed, NOT built yet) — town progression, Favor, shrines, blacksmith, research tree.**
  Worked out in conversation with the user before any code; each decision below was theirs.
  - **Direction:** each conquered country permanently unlocks new gameplay (buildings, research,
    an opposition cult) so replays offer something new (tourists) and something to collect
    (completionists). Unlocks persist through the NG+ village reset, stored alongside Legacy perks;
    the Legacy screen gets an "unlocked features" list as the completionist tracker. Per-raid
    mutators (optional gambles with a real cost AND upside) are a separate, later layer.
  - **Village tiers (3):** Hamlet (cap 24, today's) → Village (cap 40) → Town (cap 60). Cap of 60
    chosen from measurement: AI cost ~0.05ms/villager (24→2.9ms, 60→4.5ms, 120→8.2ms per frame,
    idle villagers, empty village — unproven beyond 60), and UI clutter (Assign panel is one row per
    villager) is the tighter limit than CPU. A tier requires BOTH population AND buildings, so
    kidnapping alone can't reach Town: e.g. Village = ~20 pop, ~12 housed, a few shrines + a
    blacksmith; Town = ~36 pop, ~24 housed, many shrines + temple + barracks + market (exact
    numbers to be tuned when built). Visuals should change per tier (paving, footprints, gate).
  - **Favor:** its own resource, separate from conviction (which stays the brainwashing rate-gate).
    Earned per day from shrines, scaled by nearby devoted villagers; spent on blacksmith work,
    faith/war research, cult powers.
  - **Shrines:** many small ones (supports the town-sprawl look), each a modest passive Favor source.
  - **Blacksmith:** upgrades weapons on the armory rack (tiers) AND applies elemental infusions
    (ice/slime/acid/spark blades and so on, reusing the elemental hit effects), with appearance
    customisation (colour/head style, via the existing weapon-spec appearance data). Costs Favor +
    materials. Cosmetic customisation is a wanted feature, not an afterthought.
  - **Other buildings (unlocked by research):** Temple (upgrades altar/HQ, raises conviction cap
    above 12), Barracks (more guard/squad slots), Market/Granary (trade + food buffer for a bigger
    population), Watchtower/Gate (patrols reach it, earlier threat spotting), Scriptorium
    (research speed, advanced tree). Buildings carry daily upkeep so expanding is a trade-off.
  - **Research:** split from one flat economy list (plough, sawmill, quarry, smokehouse, carts,
    comforts, paving) into Economy / Faith / War / Civic branches, ~3 tiers each, higher tiers
    gated by village tier + an earlier building. New branches/tiers arrive with new countries.
  - **Country pacing (proposed):** Country 1 = base + shrines/blacksmith intro; Country 2 =
    opposition cult + Temple + Barracks + Faith counter-research; Country 3 = Town tier +
    Market/Watchtower/Scriptorium + top research tiers.
  - **Suggested build order:** tiers + Favor → shrines → blacksmith (tiers, then infusions, then
    cosmetics) → research tree → opposition cult last (needs the rest in place).
  - **BUILT — step 1 (tiers + Favor), 2026-09-19.** `TOWN_TIERS` (Hamlet 24 / Village 40 / Town 60)
    with a data-driven `need: { pop, housed, build: {prop: count} }`; later steps just add entries
    to `build` (shrine, blacksmith, temple...). Tier is a ratchet (`village.tier`, never drops).
    `villagerCap()` replaces the old fixed `VILLAGER_CAP`. `checkTownTier()` runs on village entry
    and every day tick, flashing "You are now a Village". Current requirements are placeholders
    using buildings that already exist (Village: 20 pop, 12 housed, altar; Town: 36 pop, 24 housed,
    altar + weapon rack) — tune after testing. Favor is `village.stores.favor`, shown in the HUD
    once the cult exists; stopgap income is `1 + 0.5 × devoted villagers` per day until shrines
    replace it. The HUD panel title now shows the tier and what the next tier still needs; people
    shows `n/cap`. Verified live: population alone did NOT advance the tier; population + 12 housed
    + an altar did (cap 24 → 40); removing the altar afterwards did not demote; a day tick
    granted Favor. Existing over-cap villages aren't culled (only new arrivals are refused).
  - **BUILT — step 2 (shrines), 2026-09-19.** A one-tile `shrine` prop (stone plinth, cairn, flickering
    candle; icon + in-world draw in the same flat-rect style as the altar), recipe 2 wood + 3 stone,
    unlocked with the cult alongside the altar/rack (`registerCultBuild`), wired into every prop table
    the altar uses (material, indestructible HP, size, non-solid, fixed, sort bias, removal, save
    reload, wipe-save regex). Favor income is now: 1/day from the cult + per shrine `min(3, 1 + 0.5 ×
    devoted villagers whose home is within 260px)`. Per-shrine cap (`SHRINE_CAP`) stops stacking many
    shrines around the same few believers from multiplying them — more Favor needs more shrines near
    MORE devoted people. Tier requirements now include shrines (Village: 2, Town: 6 — placeholders).
    Verified live: 4 devoted villagers with 2 nearby shrines + 1 far shrine paid exactly the
    predicted 8 Favor; the piece registers in the build menu and places/persists through the real
    `placeBuildAt`; no draw errors. Not yet done for shrines: gating behind research (currently
    unlocks with the cult), a click-to-pray interaction, and any visual variety between shrines.
  - **BUILT — step 3 (blacksmith), 2026-09-19.** A 2×1 `blacksmith` prop (anvil + glowing forge;
    recipe 4 wood + 10 stone; unlocks with the cult; wired into the same prop tables as the altar).
    Press E beside it to open **The Smithy** (HTML panel, Escape closes it), which works on weapons
    in the armory rack plus your own quick slots/pack (tools and fists excluded):
    - **Tiers:** +1..+3, each +20% damage; tier n→n+1 costs `8(n+1)` Favor + `3(n+1)` stone.
    - **Infusions:** ice / slime / acid / spark / fire, 12 Favor + 2 stone; sets the weapon's
      `hitFx`, so it reuses every existing elemental hit effect (ice/slime also apply `slow`).
      "Remove infusion" is free.
    - **Appearance:** 8 colour swatches (1 Favor); draws a coloured trim along the weapon plus a
      pulsing element-coloured glow at the tip.
    - **How it's stored:** a forged weapon is a self-describing id, `base|tier|fx|hex` (e.g.
      `bat|2|ice|d05a4a`). `WEAPONS` is now a Proxy over `WEAPONS_RAW` that builds the stat block the
      first time such an id is looked up, so the armory, quick slots, pack and a villager's `armed`
      already save it with no new save data, it survives reloads, and the hundred-plus existing
      `WEAPONS[id]` reads needed no changes. `drawActor` draws a forged weapon as its base
      (`wkey`) plus the trim.
    - Tier requirements now also need a blacksmith (Village and Town — placeholders).
    - Verified live: costs charged exactly (100 → 79 Favor for +1, slime, colour); the id rebuilt
      after deleting the built entry (Proxy path == reload path); stats scaled (Bat 22 → 31 at +2);
      a real `attack()` with a forged bat ran without error and dealt damage; four forged weapon
      variants (melee/gun/each element) drew with zero draw errors; the panel rows/buttons/swatches
      worked through real DOM clicks; Escape closes it. NOT eyeballed: how the trim/glow actually
      looks on the character (test village was too crowded to see) — worth checking in play.
    - Not done: research gating, a forge animation/sound, spark-fire safety for villagers armed with
      fire weapons, and per-weapon (not per-base) appearance for guns beyond the trim.

---

## Difficulty curve

- **Cities:** garrison tier rises as you go; the ruling faction gets bigger, tougher, and
  more elaborately themed. The capital's faction is a proper boss gauntlet.
- **Supply raids** (the existing kidnap / errand / grocery urges) also scale — later towns
  are more hostile, targets better-guarded — so the cozy sustenance loop keeps pace with the
  war.
- **Empire drag:** more captured cities = faster order decay everywhere = more cash and
  attention just to stand still.

---

## Design guardrails

- **The village-sim never becomes vestigial.** Post-cult it's your **war economy** — food
  feeds soldiers, research buys better gear, beds house recruits and prisoners, the HQ is the
  seat of it all.
- **Raids are bounded, not slaughter.** Kill a specific roster + hold a zone. No "clear the
  whole map of people."
- **Captured cities stay alive.** They're populated assets (tribute, recruits, fast-travel),
  not ghost towns.
- **No spreadsheet management.** Small country, light per-city controls.
- **Tone stays dark-comic.** Escalation of "forced hospitality", not grimdark. The
  brainwashing is **absurd played straight, then sinister** — deadpan-ridiculous objections
  that crack into real tears when you hit the wound underneath. Funny-uncomfortable, not bleak.
- **Ollama is optional.** Every AI-generated beat has a hand-authored fallback.

---

## Suggested build order

1. **Cult threshold + HQ validation** — small, reuses the roof flood-fill.
2. **Stop dumping weapons + the armory** — repurpose the dump prop.
3. **Villager combat AI** — the big one. Prove it on a normal city run first.
4. **The map** — ~10 city nodes, reuse the signpost UI.
5. **Raid mode** — generated faction + town-square objective + scattering civilians.
6. **Empire management** — order meter, cash upgrades, governors, revolts.
7. **Brainwashing minigame** — beliefs / ideology / devotion + the Ollama conversation.
8. **Post-raid generation** — themed unlocks + fallback pools.

---

## Open questions

- What raises **conviction** (the brainwashing rate-gate)? HQ pulpit, raid wins, research, a
  combination?
- Do **prisoners** (captured raid bosses / enemies) go through the same brainwashing flow, a
  harder variant, or a cell/"re-education" building first?
- Does the player pick their **ideology tenets** up front, or accrue them from choices made
  during raids and conversations?
- **Map structure:** free choice of any adjacent city, or a branching path with a couple of
  routes to the capital?
- Should conquered cities be **defensible** — can a rival faction / rebellion try to take one
  back, forcing you to garrison?

### 2026-09-19e — Town progression step 4 BUILT: research tree
Research is now 4 tabbed branches (Economy / Faith / War / Civic), 16 items, with `req` prerequisites, `tier` (village rank) gating and optional Favor cost (`favor`). Old item ids unchanged so saves stay valid.
- Economy: plow, sawmill, quarry, smokehouse, carts + NEW Crop Rotation (needs plow; plough 1.5x->1.75x), The Ledger (Village rank; +floor(pop*0.6) cash/day).
- Faith (NEW): Vespers (+1 Favor/shrine/day), Sacred Fire (needs Vespers; unlocks smithy infusions), Tithing (needs Vespers; +25% city tribute), Reliquary (needs Vespers, Village rank; conviction cap 12->16 via convictionCap()).
- War (NEW): Tempering (smithy tiers past +1), Drill (guards 80->100 HP, soldiers 64->80).
- Civic: comfort, paving (moved) + Wells (needs comfort; +0.1 mood).
Verified live: prereq/tier/favor gating, Favor deducted, cap 12->16, smithy fx/tier quotes gated. Tab-click via real mousedown not confirmed to switch tab. Suggested-later (need unbuilt buildings): Temple, Barracks, Market/Granary, Watchtower, Scriptorium research.

### 2026-09-19f — Visual tells for research (step 1 of the agreed build order) BUILT
hasRes(id) helper. Tells: Plough -> 20% of farmers carry a plough instead of a hoe (40% with Crop Rotation; `_plowRoll`/`_plow`, drawn in the hoe branch of drawActor); Drill -> iron cap on guards/mustered soldiers in the village, plume on guards; Shrine: Vespers candles, Sacred Fire hotter flame + sparks, Tithing coin bowl, Reliquary halo + relic (altar gets the same + second banner); Tempering -> white-hot forge + anvil sparks; Ledger -> coin glint over the study; Comforts -> rug + flower box at beds.
Verified: no draw errors with all research on; 7 plough carriers and 10 helmeted soldiers flagged in a 93-person test village. NOT eyeballed (too crowded) — ask user to look.
NOT DONE (need new world props): Sawmill log pile, Quarry stone pile, Smokehouse smoke/rack, Carts, Wells prop, Crop Rotation field colours, Paving already visible.
Agreed next: walls (palisade->stone->gate) + HAND-DRAWN guard patrol routes (user chose waypoint option 1; NOTE a guard patrol *circle* already exists — see guardPatrolPoints ~line 5016/11985 — the waypoint route should extend/replace it), then Temple/Barracks/Market/Watchtower/Scriptorium + research, then opposition cult.

### 2026-09-19g — Hand-drawn guard routes + 4 town buildings BUILT
- Guard patrol ROUTES: Assign panel on a guard now has "Draw a patrol route" beside the circle. Click waypoints (Enter / right-click finishes, Backspace undoes, Esc cancels); stored in rec.guardZone as {route:true, r:0, pts}. Guards walk the drawn loop exactly (no random offset, 0.1-0.5s pauses instead of 2.5-5s). Routes drawn as dashed polylines. Verified with real mousedown/Enter events: a guard looped all 4 points repeatedly, no errors. (Walls already exist as build pieces: fence, plank, stick, fieldstone, doors — no new wall piece was added; a Gate/Watchtower is still open.)
- Town buildings (TOWN_BUILDINGS, cap TOWN_BUILD_CAP=3 per kind counts for yield): Market Stall (+8 cash/day), Scriptorium (+4 research/day), Temple (+3 favor/day, needs cult), Granary (+5 food/day). Registered with the cult (registerCultBuild) — NOT yet gated per-country. Town tier now also needs temple:1 + market:1. Verified: all 4 register, place, yield, draw with 0 errors, and look right in a screenshot.
STILL TO DO: Barracks, Watchtower/Gate, world props for Sawmill/Quarry/Smokehouse/Carts/Wells/Crop-Rotation fields, per-country unlock gating, Legacy "unlocked features" list, opposition cult (last).

### 2026-09-19h — Barracks, Watchtower, yard decor, per-country unlock table + Legacy feature list BUILT
- Barracks (+2 muster squad each, via squadCap(), cap 3 counted) and Watchtower (guards within 420px of one get dmgMul 1.25, refreshed each second in the villager tick). Both in TOWN_BUILDINGS; sprites/icons added; placed+registered+rendered with 0 errors.
- drawYardDecor() (called from the campfire prop draw): Sawmill log pile+sawhorse, Quarry stone heap, Smokehouse curing rack + smoke, Carts hand-cart, Wells stone well, Crop Rotation sheaves. Visible in a screenshot (well, cart, sheaves seen).
- FEATURES table (near TOWN_BUILD_IDS): each feature has a `country` (1-based; countryNumber() = ngPlus+1). ALL SET TO 1 while testing — proposed pacing Temple/Barracks/cult=2, Watchtower/Town tier=3. registerTownBuilds() (idempotent, called from checkTownTier) only registers unlocked buildings; townMissing skips locked reqs and says 'a later country' if Town tier itself is locked. Legacy screen shows a "Village features unlocked" list (✓ / 🔒 country N) — verified 10 entries. (Note toggleLegacy only opens from the title screen or forced end-of-campaign.)
- Walls: no new piece; guards' hand-drawn routes (2026-09-19g) are the wall-following mechanism. Gate not built (doors exist).
STILL TO DO: opposition cult (needs a design chat first — no mechanics agreed yet), per-raid mutators, unique weapons, village events, rival faction. User to test everything.

### 2026-09-19i — Opposition (rival) cult BUILT (step 5)
Three faces, all gated by FEATURES 'cult' (country 1 while testing; proposed 2) and village.cult:
1. DARK SHRINES (prop 'darkshrine', hp 70, spawn on the village fringe 420-560px from the fire, max 2, 30%/day from day 2; persisted in placedProps). Daily darkShrineDrain(): villagers whose home is within 340px un-flip one belief (50%; 25% with Warding) UNLESS one of your shrine/altar (260px) or temple (420px) stands near their home. Raze it (hurtProp -> razeDarkShrine) for +4 favor +6 research. Day report says "The rival cult turned N villagers".
2. VILLAGE RAIDS: maybeCultRaid() at nightfall (14% + 7%/dark shrine, halved by Warding, from day 3): 3 + day/8 (max +3) + ngPlus robed cultists reuse the _villageThreat hunt-a-villager AI (70-100s life), guards fight them.
3. CITY AMBUSHES: cultCityTick(dt): casual runs every 70-120s a squad of 2 (+ngPlus/2); during a takeover (mission.raid) every 35-60s a squad of 3+ (tier-scaled) incl. a zapstaff caster; max 4 alive; hunt the player for their first 30s (_huntT overrides the 5s lose-sight rule) and fight anyone (incl. the raid squad) on the way. Robed hooded cultists with glowing eyes (drawActor `a.cultist`).
New research: Warding (Faith, needs Vespers, 60rp+10 favor). Verified live: shrine spawns/persists, drain protected=0 vs unprotected=5, raze +4 favor & unpersists, village raid spawns 3 raiders, city ambush spawns and one closed to melee range; cultists render hooded. NOT verified: cultists vs the mustered raid squad in a real takeover; balance of any numbers.
Unique-weapon drop from razing a shrine was pitched but NOT built (unique weapons don't exist yet).

### 2026-09-19j — Wagers (per-run mutators) BUILT
Before any city trip (campaign-map takeover OR signpost casual run, only when leaving the village) a Wagers panel (reuses #travel overlay; Esc/Cancel aborts the trip) lets you take up to 2 optional wagers: Ironclad (+40% enemy HP, +50% pay), Glass Cannon (you take +75%, deal +50%, +25% pay), Reinforcements (gang of 3 every ~40s that hunts you, +60%), Bounty on Your Head (start with heat 40, +40%), Hunted (needs cult; cult ambushes 2x as often, +50% and +6 favor). Payout: takeover Legacy Points x wagerPayMul() (folded into ngLootMul); casual/any return: bonus cash = run gain x (mul-1), plus wager favor. State: pendingWagers -> runWagers (set when the city is entered, cleared on return). wagerTick() in the city loop applies Ironclad HP once per enemy and runs Reinforcements.
Verified live: panel opens, max-2 enforced, live multiplier (x1.75 for Ironclad+Glass), Go/Cancel, enterZone with wagers, Ironclad scaled 10 enemies (e.g. 77 hp), Reinforcements spawns 3 hunters, no errors. NOT verified: cash bonus on return (game money var not reachable from the test harness), Glass Cannon damage numbers, Bounty heat value, Hunted cadence.

### 2026-09-19k — CALAMITY wagers BUILT (crazy set-pieces)
Seven new wagers (flag `calamity`, engine = calamityTick/drawCalamities, state in `CAL`, called from wagerTick; draw hook next to drawGuardZone): The Terminator (+80%; indestructible robot via `_indestructible` guard in damage(), speed 142, hunts the whole run, spawns after 6s), Air Raid (+60%; red warning rings then explode(), hurts enemies too, ramps up), Meteor Shower (+60%; big slow meteors + fire hazard), Zombie Outbreak (+60%; waves of 4+ every 6.5s, cap 26, some runners), Twister (+70%; wandering tornado drags actors/props in, damages at the core), Alien Invasion (+90%; 2 UFOs beam telegraphed circles + green zapstaff squads every ~34s), Sandworms (+80%; 2 worms tunnel to you, warn ring, then erupt: 38 dmg you / 70 enemies + knockback, rest 4.5s). Max 2 wagers still applies. Spawn points use solidBoxHit-checked open ground (first robot spawned inside a wall and never moved).
Verified live: all 7 run with 0 errors; robot moves/chases and hp stays 99999; zombies 12 in 20s; 9 worm eruptions in 40s; screenshot shows worm maw, bomb rings, UFO, beam ring, tornado. NOT eyeballed: robot/zombie/alien character looks; balance of every number.
IDEAS NOT BUILT: Stampede, Giant's Footsteps (huge telegraphed stomp), Earthquake, Rising Flood, Kaiju, Blackout/fog.

### 2026-09-19l — 5 more calamities + 13 UNIQUE WEAPONS + VILLAGE EVENTS BUILT
- Calamity wagers added: Stampede (+60%, telegraphed lane then 8 cattle sweep through), Giant's Footsteps (+70%, huge purple footprint ring, stomp r105), Earthquake (+50%, 4 fissures telegraph then damage + shake), Flash Flood (+60%, water wall sweeps, pushes/wets/damages), Blackout (+40%, radial darkness + glowing enemy eyes). (Sweeps use CAL.sweeps, quake uses CAL.cracks/quakeT.)
- UNIQUE WEAPONS (UNIQUES table, in WEAPONS_RAW with unique:true; draw as their _base; buildForged now keeps b._base so uniques can be forged): one per calamity earned by SURVIVING+returning from a run with that wager (grantUnique -> village.armory, once each, persists through NG+): Chrome Servo-Fist (robot), Stormcaller (tornado), Ka-Boom Bat (airraid), Meteorite Blade (meteor), Grave Digger (zombies, lifesteal), Ray Staff (aliens, chain zaps), Wormtooth Spear (worms, pulls), Bullhorn Lance (stampede), Titan's Club (giant), Faultline Pick (quake), Tidebreaker (flood), Nightblade (blackout, assassinates unaware), + Heretic's Kris (25% when razing a dark shrine, lifesteal).
- VILLAGE EVENTS: rollVillageEvent each morning from day 2 (38%): Harvest festival, Bountiful harvest, Drought, Sickness (villagers laid up 2 days, Wells halves the chance), Meteorite (+stone/research), and two choice events via the #travel overlay: Travelling Merchant (buy wood/stone/mystery weapon $90, 20% a unique) and Bandits (pay $40 or fight — spawns bandits using the village-threat AI).
Verified live: all 13 uniques resolve; grant once only; events distribution; stampede/flood sweep the full lane, quake makes 4 cracks, giant stomps, blackout runs; screenshot of stampede + flood lane + crack; merchant buy (+20 wood) and bandits fight (3 spawned). Weakly verified: unique on-hit effects in combat (chrome, boombat, ray showed effects; kris healing and stormcaller not confirmed — test swings were unreliable). NOT verified: sickness in real play, merchant unique roll.

### 2026-09-19m — Rival warband (rival faction) BUILT
No mechanics had been agreed, so I designed it (user said "Go for it. Rival faction"). village.rival = {name, boss, color, power 1-5, next}. Appears once you hold a city (feature 'rival', country 1). rivalTick() (from countryTick, every 4-6 days): either SEIZES an open non-capital city (n.rival=true; capped at 2 + power/2 = 2-4 strongholds so the map never goes solid) or MARCHES on your weakest held city (order -22; if order<40 or a 20% chance and no governor it FALLS to them: raided=false, rival=true, tribute stops). Rival strongholds show orange ⚑ on the map + legend with power; still raidable but the faction is renamed/recoloured to the rival's, boss "the Marshal" etc., tier +1 (tougher). Breaking one (rivalBroken): +6 favor, +3 legacy (x ngLootMul x wager mul), rival power -1, 30% a random unowned unique weapon. At power>=3 the rival also raids the village at night (maybeRivalRaid, 8% x power, bat-armed rival-coloured fighters, village-threat AI). News lines shown via reportCountryTick. Never touches the capital.
Verified live: rise/seizure/attack cadence over 60 days, cap held at 4, map shows ⚑ and legend, clicking a rival node -> wager screen -> city with rival boss ('the Marshal', hp 376, rival shirt colour, tier+1), night raid triggered, rivalBroken pays 6 favor and lowers power. NOT verified: the actual win block clearing n.rival on a real conquest, city falling to rival in real play, balance.
Ideas left: rival envoys/diplomacy, rival appears in casual city runs, alliance with the rival.

### 2026-09-19n — HELP screen BUILT
Tabbed, searchable Help overlay (#help, z-index 30): opens from the title screen ("Help" button), the pause menu ("help (F1)" button), or F1 anywhere; Esc/F1/close button closes (capturing keydown listener stops game hotkeys while open). 12 sections: Getting started (controls, game loop), Village life (jobs, day, live rank table), Buildings (live TOWN_BUILDINGS), Research (live RESEARCH by branch with costs/prereqs), Faith & the cult, Guards & defence (patrol circle/route), Weapons & the smithy (live UNIQUES list), City runs & takeovers, Wagers (live WAGERS split standard/calamity), Rivals (cult + warband), Village events, Legacy & unlocks (live FEATURES with country). "replay tips" button clears sb_tips. Lists are generated from the game's own tables so they stay current — when adding a new wager/building/research/unique/feature it appears automatically; prose sections (helpSections in index.html) need hand edits for new systems.
Verified: 12 sections render with no undefined/NaN, search works, Esc/F1 work, screenshot checked (fixed inherited right-alignment).

### 2026-09-19o — Perk FX: Storm Caller strike, Hypnotist trance, Executioner beheading
- Storm Caller active: charge-up (gathering sparks) then a huge forked sky bolt (fx 'skybolt', thick glow/core + forks + ground flash) slams the player (untouched); stormStrike(): white flash, shake, 2 shockwave rings, 8 crawling ground arcs, splash 24 dmg + stun to enemies within 150, then the old chain (up to 5, 26 dmg) drawn as real bolt fx between targets. Kill-zap (passive) also draws an arc.
- Hypnotist: Mesmerize casts a spinning spiral fx + converging rings at the target; while the trance lasts (_hypno && _thrall): spiral eyes, a spinning halo of 4 orbs with ☯, and a shimmering purple tether (drawHypnoLinks) from player to each thrall. Passive terror (_fearT) gets spiral eyes + a smaller halo + 'terrified!'.
- Executioner active: now beheads the STRONGEST (highest maxhp) non-boss enemy within 240: beheadActor() — slash fx, blood burst, body drops headless (drawActor hides head via globalAlpha 0 + draws a stump; hat parts skipped), blood fountain from the neck ~1.5s, head thrown along the ground (bounces twice, rolls, friction, wall bounce) leaving a blood trail (heads[]/spurts[]; updateHeads/drawHeads; cleared on zone change). Bosses/mission targets/robot excluded.
Verified live: skybolt renders (screenshot), hypnosis rings/halo render, strongest died & weaker survived, head flew ~180px and stopped, blood trail visible; 0 errors. Not seen mid-roll at close range.

### 2026-09-19p — Wagers are now RANDOM (no choice screen)
rollWagers() runs when leaving the village for any city (map takeover or signpost run); WAGER_ODDS by country (ngPlus+1, capped at 3): C1 30% one; C2 50% one, then 20% a second; C3+ 70% one, then 50% a second (the "additional" chance is conditional on the first landing). WAGER_TIER gates the pool: tier1 = the 5 standard wagers (country 1), tier2 adds zombies/airraid/meteor/quake/blackout/stampede/flood, tier3 adds robot/tornado/aliens/worms/giant. Hunted only if the cult is on. Arrival flash: "Fate strikes" / "Fate strikes twice" + names + the first curse. Payouts and unique-weapon rewards unchanged. openWagers() (the old picker) is kept in the file but no longer called. Help > Wagers rewritten. Verified: 6000-roll distributions match (C1 29.8% one; C2 40.1% one + 10.1% two; C3 35.8% + 34.0%), tier pools correct, a real trip carried the wager into the city, no errors.
- **2026-09-19p (correction)**: user clarified the two-wager odds are OVERALL, not conditional: C2 = 50% any wager (30% one, 20% two); C3+ = 70% any (20% one, 50% two); C1 = 30% one. rollWagers uses one shared roll (x<two -> two, x<one -> one). Help text updated.

### 2026-09-19q — Wager outcome report + no reward for failed raids
Wagers now only PAY when the run succeeds: not dead (runDied set in the death handler) AND, for a takeover (runTakeover = mission.node), the raid was actually won (_lastWonTakeover). Otherwise no cash bonus, no favor, no unique weapon (and a takeover Legacy payout only ever happens on a win). Casual runs: paid on returning alive. Each return builds _wagerReport {ok, why, items[], bonusPts, bonusCash, favor, unique}; wagerReportRows() turns it into lines: per wager "survived — +N% payout (+favor)" or "no reward — the raid failed / you went down", plus a "wager rewards" total (Legacy Points share via payLegacy(), cash, favor, UNIQUE weapon). Shown on the takeover SPOILS screen (won) or the run RECAP (casual / failed / died). Verified: failed takeover -> 'no reward — the raid failed'; won takeover spoils screen lists "wager · Ironclad survived — +50% payout" and "+2 Legacy Points"; casual run reports ok. NOT verified: the died path live (same code branch), a wager with a unique/favor reward in the panel.

### 2026-09-20 — Cosmetics pass 2, END-GAME TEST PANEL, staging, unfinished items
- COSMETICS: ~75 new ITEMS recipes (ITEM_SLOT + Object.assign(ITEMS) block above the ROSTER-SCHEMA marker): 20 hats (cowboy, wizard, pirate, fez, chef, viking, halo, horns, flower crown, headphones, kabuto, santa, propeller, bucket, bowler, turban, straw, cat ears, hood-up, nurse), 10 hair styles (afro, ponytail, mullet, side part, pigtails, dreads, bob, faux-hawk, braids, big bun), 18 faces (moustache, handlebar, goatee, stubble, sideburns, eye patch, monocle, round glasses, scar, freckles, fangs, bandage, tattoo, cyber eye, surgical/ninja mask, tears, clown paint), 11 tops (hoodie, trench, overalls, robe, armour, lab coat, poncho, tux, stripes, kimono, leather), 6 necks, 5 backs (quiver, sword, guitar, satchel, jetpack), 4 waists (kilt, skirt, holster, fanny pack), 4 shoes. Character creator now has 14 rows (added Hair style, Top, Neck, Back, Waist, Shoes; Hat/Face lists expanded; CHAR_OPTIONS.* pushes after the base table). Villagers (_look) got afro/sidepart/mullet/dreads hair, cowboy/fez/chef/wizard/pirate hats, moustaches and marks (scar, freckles, eye patch, monocle). AI roster can use the new items too (RS.items = Object.keys(ITEM_SLOT)). Verified: all 113 creator options draw with no errors on a contact sheet; creator opens with 14 rows; START puts the outfit on the in-world player.
- ADMIN / TEST PANEL: roster panel (\ or the lab button) now starts with END-GAME TESTING: country selector (sets ngPlus, so feature gates + wager odds follow), new map, start NG+, cult on, HQ+map, village rank buttons, take next city / all but capital / capital (win screen), +resources (food/wood/stone/favor/research/cash), all research, +5 villagers, skip 1/5 days, trigger any village event, dark shrine, cult raid, rival +1/spawn, rival move, rival raid, wager checkboxes with 'use on next trip' (dbgWagers overrides rollWagers) / 'apply to this run' / 'back to random', grant all uniques. Force args added: rollVillageEvent(V,id), maybeCultRaid(force), maybeSpawnDarkShrine(force), maybeRivalRaid(force). Verified live (buttons, forced wagers carried into the city, raids spawn, events fire). NB: skipping days with no food makes villagers walk out.
- STAGING: FEATURES now gated: Temple/Barracks/rival cult/rival warband = country 2; Watchtower/Town rank = country 3. Use the admin country dropdown to jump ahead.
- ASSIGN PANEL: two columns once >8 rows (it overflowed the screen for a guard in a cult village). LEGACY: 'Unique weapons n/13' collection grid (? until earned, shows the source). Gate piece NOT built (doors already do the job); rival diplomacy NOT built.

### 2026-09-20b — Sandworm + Twister finesse, and honest death summary
- SANDWORM: while tunnelling it now tears up the ground (wormTear): a fading ridge of churned earth trails behind it (drawn + baked decals), dirt sprays up, screen rumbles near you, and every 0.18s it damages + shoves PROPS and rips at BUILDING cells within 42px (never actors). The launch (wormBurst) is an explosion of earth: 60 flying earth chunks with gravity (CAL.debris), 3 brown shockwaves, dust cloud, crater decals, prop + building damage in a 90-100px radius, the usual 38/70 damage + knockback to actors. Drawn as a segmented worm body launching out of the hole in an arc with a toothed head, over a crater.
- TWISTER: now bigger (pull radius 240 on actors, 340 on objects), damages EVERYONE incl. civilians (11 you / 22 others per 0.4s at the core) and rips buildings (damageCell r66 every 0.16s + rubble chunks + scuff decals). ~190 wind particles spiral in and up around it (streaks, leaves, paper, grit) + dust whipped off the ground + lightning inside the cloud; 14-ring funnel. Throwable props (non-fixed, <=42px, not cars/trees/rocks...) are dragged in by the wind and, on reaching the centre, are flung into the air at random (pr._fly, lifted via pr._z in drawProp), landing with damage. Verified: 10 worm eruptions/40s with 124 debris + 30-point trails; 4 props airborne at once; screenshot shows worm launch, funnel, wind, debris, torn walls.
- DEATH SUMMARY FIX (user: "when I die... that little summary makes it seem like I still kept the cash"): dying now genuinely loses the run's cash and score (money/score reset to the run-start snapshot — matching the existing 'you lost this run's haul' message; XP/levels/kills kept) and the recap shows a red "YOU WENT DOWN — lost: $X cash, N wood, N stone, N items / you keep your XP and levels" instead of "+$X cash". Verified wood/stone/items path; cash path shares the same code (couldn't set money from the harness).

### 2026-09-20c — Yard buildings are now placeable (no more campfire clutter)
The research-driven decor that used to be auto-drawn round the campfire (drawYardDecor, now unused and its call removed) is now six real, player-placed pieces (YARD_BUILDINGS): Well (Wells research), Log Pile (Sawmill), Stone Heap (Quarry), Smoke Rack (Smokehouse), Hand-cart (Carts), Sheaves (Crop Rotation). registerYardBuilds() (called from checkTownTier on village entry/day tick and from doResearch) adds each one's craft recipe + build-menu entry as soon as its research is owned; the research flash says "you can now build a X (C to craft, B to place)". Cheap (2-10 wood / stone), cosmetic, non-solid, persisted like other placed props (placedProps), included in TOWN_BUILD_IDS so all the existing prop plumbing applies. Help > Buildings lists them. Verified: 0 -> 6 build items after real doResearch calls, all six placed far from the fire and saved, sprites visible. Existing saves keep their research but must build the pieces.
Also: dying now truly loses the run's cash (user confirmed 'Lose cash').

### 2026-09-20d — Build menu rows wrap
drawBuildUI: a category with more pieces than fit across the screen (Home had ~24) used to be clipped ("Market…" cut off). Rows now wrap onto extra rows (continuation rows are labelled "·"), boxes shrink to fit, and the block is re-centred on where the old block sat, kept between the HUD (y>=124) and the hotbar. Click rects are per-piece so wrapped rows work the same.

### 2026-09-20e — CRAFT menu rows wrap (the one in the user's screenshot)
(The 2026-09-20d change was to the BUILD carousel; the user meant the CRAFT carousel drawn by drawCraftUI.) craftSlots (stable per-recipe slots) now wrap: slots 0..cap-1 stay on the original row, overflow stacks in extra rows ABOVE it (rowPitch = box+34), boxes shrink (down to 34px) so the top row stays under the HUD (y>=106). drawOptScreen labels now shrink (to 8px) then truncate with … to fit under their box. Verified with all materials on the ground: 39 recipes in 3 rows, readable, clear of the HUD (tested in a small 800x450 window; roomier at full size).

### 2026-09-20f — Admin panel wood/stone fix
"+50 wood"/"+50 stone" were adding to village.stores (a store nothing you craft with reads). Wood, stone and (new) sticks now go into player.res — your pack, the amounts shown in the HUD and used by crafting. Food/favor/research still go to the village stores. Verified: +50 each in player.res.

### 2026-09-20g — Admin: "▶ NEXT COUNTRY" button
The existing 'start NG+' button (startNewGamePlus: fresh village, brand-new country map, keeps unique weapons/codex, bumps ngPlus) is now labelled "▶ NEXT COUNTRY". The dropdown is relabelled "features as country N" (it only changes which features/wager odds apply to the CURRENT village; it does not start a new one). Verified: click -> ngPlus +1, new country name, uniques kept; clickable repeatedly.

### 2026-09-20h — Hover text in the craft + build menus
pieceInfo(id,name) + drawPieceTip(): a word-wrapped card by the mouse showing name, plain-English description and extras. Descriptions: hand-written PIECE_DESC for walls/doors/floors/furniture/tools/altar/shrine/smithy/rack; generated from the game's tables for town + yard buildings (their `blurb`) and weapons (kind/damage/reach); generic fallback for path materials and anything new. Craft cards add "Needs: …  Makes: ×n" and click hints; build cards add "You have N ready / craft some first". Hit-tested against craftOpts / buildOptRects. Verified with real mouse hovers on Barracks, Bed (craft) and Bed (build). NB: unknown new pieces get a generic line — add to PIECE_DESC when adding pieces.

### 2026-09-20i — PLANNED (not built): per-country visual style
User: "change the appearance of the new countries, slightly randomised so the villages and cities look different — we should work on that eventually." Proposal: each country gets a seeded `style` object in genCountry (persist on village.country): terrain/grass tint, tree + flower palette, river colour/width, building wall/roof/stone palettes, weather + light bias, people palettes (clothing/hair/hats/face items from cosmetics pass 2), faction colour bias. Build order: (1) terrain/tree/building tints + weather bias, (2) people styling, (3) city layout variants (block size, road width, density). Open questions for the user: subtle vs dramatic; should the home village change per country or stay recognisable.

### 2026-09-20j — Country style, step 1 BUILT (village + cities)
User: "subtle but noticeable, and the village should change too". countryStyle() (COUNTRY_STYLES: Verdant Hills, Golden Autumn, Dry Plains, Cool Highlands, Misty Moors, Warm Dusk, Lush Wetlands, Faded Frontier) is derived deterministically from country name + New Game+ cycle (ngPlus>0; country 1 stays the neutral 'Home Country'), nudged ±6° hue / ±0.05 sat so no two match. It is applied as a canvas colour GRADE (ctx.filter hue-rotate/saturate/brightness/contrast/sepia) at the single world blit in draw() — so grass, trees, water, roads, buildings and people all shift, in the village AND the cities — and villagers' shirt colours come from the style's own palette (randPerson). Style name shows under the country name on the campaign map and in the NEXT COUNTRY flash. Debug: window.__noGrade=true disables it. Verified: 6 countries give 6 distinct grades; screenshots of Faded Frontier / Dry Plains (olive) / Lush Wetlands (blue-green). Not measured: filter cost at large window sizes (only applies for countries 2+; if it hurts frame rate, bake the tint into the ground/tree palettes instead). NEXT (planned): people cosmetics per country, terrain/tree/building palette variants baked at source, weather bias, city layout variants.

### 2026-09-20k — Country style, steps 2-5 BUILT
COUNTRY_STYLES entries now also carry: pine (conifer share of trees, mkTree), heat + clear (weather bias in updateWeather: chance a dry spell is a heatwave / fair-spell length multiplier), lot + size (city density: share of lots with a building, and a building-size bump, genCityChunk), wall [colour, amount] (applyMatStyle blends brick/timber/stone MAT_COL toward the country's material tint and recomputes WALL_TOP/FACE(_D); neutral restores MAT_COL_BASE), and look (people: hats list + chance, extra hair styles, beard/mark/glasses chances, used by rollLook — villagers only). Neutral values reproduce the original game, so country 1 is unchanged. Examples: Dry Plains = sandy walls, sparse conifers, more heatwaves, larger sparser cities, cowboy hats/fezes; Cool Highlands = slate walls, 50% conifers, dense small cities, beanies/hoods/beards; Lush Wetlands = long rains, big-leaf trees. Verified: brick colour differs per country and resets on country 1; city loads in Dry Plains style with no errors; screenshot of sandy-brick city. NOT done: city (civilian/enemy) cosmetics per country (only villagers use rollLook), baking the grade into ground/tree palettes (filter still used), road layout variants.

### 2026-09-20l — Country style: city civilians + street enemies
(civilians/thugs/bruisers/gunners already got a `_look` via applyLook -> rollLook, so the country's hat list and beard/mark/glasses odds already reached them.) makeActor now also: civilians wear the country's shirt palette outright; thugs/bruisers/gunners ~50% (slightly darkened; faction enemies keep faction colours via tintFaction; cops keep uniforms; roster/AI spec enemies untouched); STYLE_HAIR biases hair colour for ~half of civs/thugs and for villagers (randPerson). Verified with 400 generated actors per style: hat + hair mixes differ per country (e.g. Dry Plains sun/band/fez hats + dark hair; Misty Moors hoods/beanies + grey hair). Skin tones deliberately NOT tied to countries. Still not done: baking the grade into ground/tree palettes, road layout variants.

### 2026-09-20m — Country style: road layouts; grade perf measured
- STYLE_ROAD: road width in cells (Cool Highlands / Misty Moors 2 = narrow lanes; Dry Plains / Faded Frontier 4 = wide roads; others 3 = the classic 48px) and centre-line paint (colour / faint / none) per country; used by bakeCityGround, genCityChunk (RD) and sidewalkSpot (street furniture lane scales with road width). Country 1 unchanged. Verified: cities generate and play in Dry Plains (wide, faint lines) and Misty Moors (narrow, unmarked) with no errors.
- PERF: the colour grade costs ~0.7ms/frame at 1280x720 (software-rendered test browser, worst case), so baking it into the ground/tree palettes is NOT needed; window.__noGrade=true disables it if ever wanted.
- Country style is now COMPLETE for the agreed plan (grade, people, weather, density, materials, roads). Remaining ideas: rival diplomacy, a Gate wall piece.

### 2026-09-20n — PLANNED (brainstorm, not built): country BIOME KITS
User: "I don't see the tree or rock mix in the newer countries... just different colours of the same trees. Change how rivers and paths are generated (wider rivers with rocks/rapids/waterfalls), lakes (swamps), different flowers, shrubs, insects/animals instead of butterflies, different campfire styles, the travel sign in different places/looks. Brainstorm first." Honest note: the 'pine' share only changes the dark-conifer tint of the SAME tree drawing (_tint); rocks/flowers/water/fauna don't vary. Proposal: each style gets a biome kit — (1) tree species (acacia, dead, birch/maple, palm/mangrove/willow, tall pine), rock types (sandstone, mossy, standing stones, boulders), flower sets, shrubs (heather, cactus, fern, scrub); (2) ambient fauna replacing butterflies (dragonflies, fireflies, crows, lizards, rabbits, frogs, deer, vultures) that flee; (3) campfire styles + travel-marker styles/locations; (4) river variants (wide/rocky/rapids/dry bed/slow) + lake variants (swamp, oasis, tarn, hot spring, pond); (5) waterfalls/cliffs (hardest, top-down). Style->kit: Dry Plains=acacia/cacti/sandstone/dry riverbed/oasis/tumbleweed; Wetlands=swamp/willow/frogs/fireflies; Highlands=pines/boulders/rapids/hares; Autumn=birch+maple/falling leaves/deer; Moors=heather/standing stones/bog/crows; Frontier=bare trees/ruins/vultures; Dusk=hot springs; Verdant=meadows+butterflies. Open questions: gameplay effects (swamp slows, rapids block)? huntable wildlife? realistic vs fantasy? one step at a time (1->2->3) or a bigger first pass? Recommended start: step 1 + campfire + travel sign.

### 2026-09-20o — BIOME KITS BUILT (later countries only; country 1 untouched)
User approved the brainstorm: rocks/logs/waterfalls treated like walls (top + one face, solid); YES to gameplay effects (deep river needs a bridge); wildlife ambient + killable-but-unrewarded; fantasy touches welcome; my lead on scope.
- KITS (BIOME_KITS + KIT_EXTRA, keyed by country style name; biomeKit() is null for ngPlus 0): tree SPECIES via mkTree (_sp: birch, maple(colours), acacia, dead, willow, palm, giant glowing mushroom; oak/pine remain), drawTreeSp; ROCK kinds via mkRock (_rk: slab (sandstone, box3D top+face), menhir (tall standing stone, glowing rune, indestructible), crystal (glowing), mossy; drawRockKind); fallen LOGS (prop 'log', solid); FLOWER kinds (_fk: daisy, tulip, aster, sunflower, poppy, bluebell, heather, lavender, lily, orchid); SHRUB kinds (_bk: fern, heather, gorse, cactus (thorny — prickles you, updateThorns), scrub, cattail); glowing props (_glow) light up at night.
- WILDLIFE (critters[], updateCritters/drawCritters; replaces butterflies unless the kit lists them): rabbit, hare, deer, squirrel, lizard, frog, crow (flies off), vulture (circling + shadow), bee, moth, dragonfly, bat, tumbleweed (rolls with the wind), wisp (glowing marsh light). They wander/graze and flee. hitCritters(): the player can kill them but there is NO reward (no food/loot/XP); after 3 kills a quiet "the wild goes quiet" message.
- CAMPFIRE styles (_fs): ring, pyre, brazier, hearth, pot (cauldron w/ steam), lantern, spirit (teal witch-fire in a toadstool ring), barrel. TRAVEL SIGN styles (_ss): post, cairn, totem, arch, milestone, banner, hitch, lantern — AND its location moves (SIGN_POS chosen per country from 7 spots clear of water; the campfire->sign trail follows).
- WATER: river kinds (RIVER_KIND: normal, wide 1.7x muddy, rocky 1.25x w/ white water + boulders in the stream + a downstream current, peat, dry (cracked bed w/ the odd pool), shallow), lake types (pond, oasis w/ palms, tarn, hotspring (heals, steams), swamp (murky, slows, dead trees + toadstools), bog, salt) with per-type palettes and sizes. DEEP WATER BLOCKS movement in kit countries (waterAt > 0.6, DEEP_BLOCK; all actors) unless a BRIDGE: new craftable "Bridge Deck" floor piece (texture 'bridge', drag-lay in build mode; BRIDGES set makes waterAt 0 under it; persisted via village.floors). Hint popup + tip when blocked. WATERFALL (highland rivers): a solid rock ledge across the river with animated falling water + mist (prop 'waterfall').
- Help gains "The world & biomes". Verified in the browser: every biome loads with 0 errors, ~4ms step; Dry Plains/Wetlands/Highlands screenshots (acacias, cacti, slabs, totem sign + brazier; willows, palms, glowing mushrooms, logs; rapids w/ boulders, menhir, waterfall, milestone); deep river blocked then crossed after laying 36 bridge decks; waterfall blocks; critters spawn per kit and killing gives nothing; country 1 unchanged (0 critters, no species, normal river).
- NOT done / ideas: fauna that can be foraged, swamp mist particles, ford stones, cliffs/ravines as real terrain, glowing ruins (Frontier), cold/snow effects, drowning?, villager pathing around deep water (they just bump), house/wall material kits per country.

### 2026-09-20p — Stump matching, Snowfields + Endless Desert, showpiece trees
- STUMPS match their tree: felling stores species+colour per tile (village.treeSp[key]='sp|colour'); stumps restore `_sp/_mc` on reload; fell bursts use species colours (mushroom stumps are no longer brown).
- SNOWFIELDS biome: white ground bake, snowpines/dead/birch, snowy/ice/menhir rocks, snowdrop/frostbloom, snowbush + snowmen, frozen river & lake (walkable, slippery), hot spring, snowring campfire, snowman sign, penguins/foxes/hares, snowfall, night aurora.
- ENDLESS DESERT biome: sand ground, sparse saguaro/joshua/dead/acacia, slabs/pillars, bones, agave/cactus/scrub, dry river + oasis, dune campfire, obelisk sign, camels/scorpions/lizards/vultures/tumbleweeds, blowing sand.
- Snowpine, willow and dead swamp tree redrawn larger (1.2-1.4x) and richer (tiers/icicles/drifts, mossy fronds, gnarled roots/branches).

### 2026-09-20q — Three more biomes + snow pine redesign + critter sorting
- STEAMING JUNGLE: deep-green ground, tall `jungle` giants (buttress roots, layered crown, hanging vines, blooms) + palms + toadstools, hibiscus/orchid/lily, ferns, wide river, swamp lakes; parrots, frogs, dragonflies, moths; pot campfire, totem sign.
- ASHLANDS: charcoal ground with ember flecks, burnt `charred` trees (glowing cracks), obsidian/slab/pillar rocks, emberbloom flowers, LAVA river + lava lakes (deep = blocked, needs bridges; smoke/sparks), rising embers + falling ash; bats, crows, salamanders, vultures; brazier + obelisk.
- BLOSSOM GROVE: `sakura` trees (pink clouds, falling petals), maple/birch/willow, azalea shrubs, blossom/lavender/tulip; deer, rabbits, butterflies, bees; lantern campfire, arch sign; drifting petals.
- Fixed: willow, palm and joshua branches in drawTreeSp were empty (duplicate headers) — they draw again. Snow pines redrawn (stacked snow-capped tiers, per-tree variation, no ground ring). Ground critters are y-sorted so they walk behind trees.
- Ideas left: cliffs/ravines, swamp mist, lava damage/burning, wall-material kits, foraged fauna.

### 2026-09-20r — Bamboo Vale + mist
- BAMBOO VALE (14th country style): segmented swaying `bamboo` clumps with leaf tufts, willow/sakura mix, shallow river, pond + swamp lakes, lantern campfire, arch sign; pandas, cranes, frogs, dragonflies.
- MIST: soft radial mist puffs (`soft` particles, no drag) drift low over Bamboo Vale, Lush Wetlands and Misty Moors.

### 2026-09-20s — Cliffs, chasms, scorching lava
- `cliff` prop (solid like the waterfall/walls: top + one face, strata, cracks): ridges of 3-5 segments with a pass through, per-biome palette (snow-capped, sandstone, ash w/ lava seams, grey w/ grass tufts). `_cv:1` = chasm (dark pit, near lip + rim stones, ash chasms glow). Odds per kit in `KIT_TERRAIN` (Highlands, Frontier, Ashlands, Desert, Snowfields, Bamboo, Moors, Dry Plains). Kept 340px clear of the start.
- LAVA now scorches the player wading in (6 hp / 0.7s, bounces you back, never below 1 hp in the village); deep lava still needs bridges. Tip + Help entry added.

### 2026-09-20t — Ashlands glow at night
- (cracks are thin, angular and forking — `crackData`/`strokeCrack`.) Lava rivers/pools cast orange light at night (soft blobs + a bright molten core down the river); charred trees glow red further (r 84); glowing lava cracks (hash-cell fissures, `ashCracks`/`drawAshCracks`) are decals on the ash soil by day and light up (plus a soft orange pool each) at night.
- 2026-09-20u: crack decals now draw under worn paths/holes/actors (skipped on trails, buildings, water); at night they glow as soft orange light along the fractures instead of lines drawn over everything.
- 2026-09-20v: lava glow no longer fades near the player — their silhouette is punched out of the glow (clip) instead. Ashlands particles: sparks + ash puffs spit from soil cracks, charred trees breathe embers, lava bubbles rise and pop into sparks (`nd` no-drag particles, `pop` bursts; kept bright in the night pass). Fireflies now only in Verdant Hills / Golden Autumn / Warm Dusk / Lush Wetlands / Steaming Jungle / Blossom Grove / Bamboo Vale (`FIREFLY_BIOMES`) — not snow, desert, ash, highlands, moors, plains, frontier.

### 2026-09-20w — Biome-themed cities (city work, part 1)
- Cities in later countries take on the country's biome (`CITY_GROUNDS`/`cityGroundFor`, `cityGroundDress`): snow-covered blocks with kerb drifts + slush tracks (Snowfields), dune-rippled sand with sand blown across the streets (Desert), charcoal ground with glowing lava cracks (Ashlands), moss/creepers (Jungle), petals (Blossom), leaf litter (Autumn), dust (Plains/Frontier), moss (Bamboo/Hills/Wetlands/Moors), bare stone (Highlands). Road surface colour per country.
- Empty lots + pavements get the country's own trees, shrubs, rocks and snowmen (`cityKitItem`); roofs are snow-capped with icicles / sand-drifted / soot-black / mossy / petal-strewn (`drawRoofBiome`); the country's weather now falls in cities too (`kitAtmosphere`: snow, petals, blown sand, ash, sparks, mist).
- Plan for the rest (user picked all four): districts & layout, building/interior variety, city life & atmosphere.

### 2026-09-20x — City districts (city work, part 2)
- Six seeded districts per city (`cityDistrictAt`, Voronoi over the 7x7 chunk grid; centre is always Downtown): Downtown (dense big buildings, offices/diners/bars/gyms, extra lamps, benches), Market Square (paved cobble plaza, fountain or statue, rows of striped-awning stalls, crowd), The Slums (small cramped buildings, litter, fire barrels + dumpsters, few lamps), Industrial Yards (big warehouses/hideouts, shipping containers, crates/barrels, oil + hazard chevrons), City Park (lawn, gravel paths, fountain, benches, trees, flowers), Old Town (cobbles, statues, benches, terracotta roofs).
- New solid `landmark` prop (`_lm`: fountain [animated water; ice/dry/lava variants per biome], statue, stall, bench, container). District place preferences in `pickCityPlace`, district roof tints, per-district ground dressing (`districtGroundDress`), and a district name banner under the city name when you cross a border (`updateDistrictTag`). Works in every country and stacks with the biome city dressing.

### 2026-09-20y — More districts + unique landmark buildings (city work, part 3)
- 10 districts per city now: + Civic Quarter, Fairground, City Zoo, The Suburbs (`_distBuild`: 10 seeds, every chunk ranked by distance from its district's heart; rank 0/1/2 host the unique buildings via `UNIQUE_BY`/`uniqueAt`).
- Unique buildings (`UNIQUE_PLACES`, always get their lot; bigger footprints, rooftop emblems via `drawRoofUnique`): Police Station (Beat Cops + Patrol Officers, flashing red/blue lights, pistol loot), Fire Station (Fire Marshals + a parked fire engine landmark), City Hospital (beds, healing loot), The Big Top (striped tent roof, clowns + a Ringmaster), St. Marrow's Church, City Museum, First City Bank (guards, safes, cash).
- Fairground plazas: ferris wheel or carousel (animated landmarks), stalls, crowds. City Zoo: fenced habitat pens (savanna / arctic / forest / desert ground) with wandering zoo animals (lion, elephant, giraffe, zebra + existing critters) that can be hit but give nothing (`updateZooCritters`, `hitCritters` now works in cities). Suburbs: small houses, lawns, trees, cars.
- New enemy specs: beatcop, copgunner, ringmaster. New kinds added to HOSTILE_KINDS (police/firestation/circus/bank).

### 2026-09-20z — Drivable themed vehicles
- `mkVehicle(x,y,vk)`: police cruiser, ambulance, fire engine are real `car` props (`_vk`) — commandeer + drive like any car, with their own colours/markings/flashing lights (`VEH_COLORS`, `drawVehicleDeco`). The fire engine is parked inside the Fire Station (80px, 220 hp); police stations get 2 cruisers at the kerb, hospitals an ambulance, civic-district streets the odd one.
- Driving the fire engine: hold attack (mouse / J) to blast the hose (`WEAPONS.watergun` bullets, 2 per 0.035s, forward — or out the back while reversing).
- Districts/unique buildings/zoo are not gated on NG+, so the starting country's city gets them too (only the biome ground/roof dressing needs a later country).

### 2026-09-21 — Bigger, destructible carnival rides
- Ferris wheel ~9 player-heights across (radius 112, 12 swinging gondolas, rim lights); carousel a full-size merry-go-round (124x64 footprint, 8 bobbing horses, striped canopy). Only ONE ferris wheel and ONE carousel per city (fairground ranks 1 and 2); other fairground blocks are stall rows.
- Rides are destructible (320 / 240 hp): the carousel detonates in a big blast + a ring of secondary explosions + fire; the ferris wheel's base explodes and the wheel breaks loose and ROLLS (`rollingWheels`) — tearing through walls, props and people for ~4s — before exploding itself. `destroyRide`, `updateRollingWheels`, `drawRollingWheel`.
- Defensive guards on two HUD weapon-name lookups (WEAPONS[id] undefined would throw).

### 2026-09-21b — Building + interior variety (city work, part 4)
- 16 new hand-authored places (`EXTRA_PLACES`, mixed into `pickCityPlace` and favoured by the matching districts): bakery, public library, nightclub, pharmacy, laundromat, arcade hall, pawn shop, jazz bar, hotel lobby, school, cinema, aquarium shop, barber, restaurant, garage (with a car inside), gallery.
- New furniture prop `furn` (`FURN`/`mkFurn`, placeable via the same fixture lists): bookcase, piano, stage (walkable, red curtain), display case, washing machine, stove, jukebox (animated), desk, fish tank (animated fish), pew, cell bars. Generic buildings draw from the wider pool too.
- Rugs on some interior floors (spec `rug`, random for plain buildings).
- Rooftops: shops tint + name their roofs (`drawRoofKind`, `KIND_ROOF`), and every roof gets a few AC units (spinning fan), skylights, antennas or satellite dishes (`drawRoofDetails`).

### 2026-09-21c — City life & atmosphere (city work, part 5)
- District folk (`DIST_JOBS`/`jobFor`): suits (fast commuters), tourists (snap photos: flash + *click*), buskers (drifting ♪ notes), parkgoers, plus homeless in the slums, joggers/dog-walkers in parks & suburbs, workers in industrial yards; market stalls get their own vendors.
- Street vendors: a food cart with an umbrella (landmark `cart`) + vendor in downtown/old town/civic/suburbs; walk up and press E to buy a hot meal — $5 heals 30 hp (works on stall vendors too). They bark their wares.
- Pigeons peck about plazas and pavements and burst into the air (`coo!`) when you get close.
- Neon-sign shops spill coloured light onto the street at night.
- Fireworks every ~16-34s over the fairground / park / downtown / market when you're there (rocket trail, coloured burst, flash).
- Beat cops walk the Civic Quarter's streets (calm until you're wanted).

### 2026-09-21d — Country-gated districts, buildings and places
Cities grow new neighbourhoods as you progress (`DISTRICT_TIER`, `cityCountryNo`; districts are seeded from the worldSeed + country number, so every country's city is laid out fresh):
- Country 1: Downtown, Market, Slums, Industrial, Park, Suburbs — landmarks: First City Bank, City Hall, Marrow Foundry.
- Country 2: + Civic Quarter (Police, Fire Station, Hospital), Old Town (Church, Museum).
- Country 3: + Fairground (Big Top, ferris wheel, carousel), City Zoo.
- Country 4: + The Docks (Lighthouse, Customs House, cranes, containers), University Campus (University, Observatory).
- Country 5: + The Strip (Lucky Seven Casino, Wedding Chapel, neon everywhere), Sports Quarter (Marrow Arena with a boxing ring, car parks).
- Country 6+: + Old Cemetery (graves, the Old Crypt), Science Quarter (Research Lab, radio dishes).
- Ordinary shops are tiered too (`PLACE_MIN`): e.g. cinema/nightclub/arcade/gallery from country 3, sushi bar/tattoo parlour from 4, pinball hall 5, day spa 6.
- New pieces: boxing-ring furniture, crane / grave / radio-dish landmarks, new rooftop emblems (lighthouse beam, casino 777, stadium pitch, observatory dome, crypt, lab atom, city hall columns, foundry flame).

### 2026-09-21e — Two more districts per country (tiers 1-6), up to 20 neighbourhoods
New districts (each with its own ground, props, plaza content, jobs, roof emblem and a unique building):
- C1: Central Station Yards (Central Station, rails + locomotives), The Shopping Centre (Marrow Mall, car parks).
- C2: Night Bazaar (Jade Pagoda, ring of lantern-lit stalls), Financial District (Stock Exchange, tower helipads, +4 building size).
- C3: The Boardwalk (Sea Life Aquarium, beach umbrellas + ice-cream cart), Film Studios (Marrow Pictures Soundstage, searchlights).
- C4: The Aerodrome (Hangar with a plane, apron + runway), Army Barracks (Marrow Garrison — Garrison Guards + Drill Sergeant, new enemies).
- C5: Botanical Gardens (Crystal Greenhouse, hedges, fountain), Temple Hill (Hilltop Monastery, pagoda + lanterns).
- C6: Ancient Ruins (Dig Site Camp, columns), The Spaceport (Mission Control, launch pad + rocket).
- District seeding now uses up to 20 seeds; the newest two tiers get priority, the rest fill in at random (so some older districts drop out at higher countries, and small districts may lose their unique building).
- New landmarks: train, plane, rocket, pagoda, hedge, column, umbrella.

### 2026-09-21f — Launchable spaceport rockets
- Every ~55-110s a spaceport rocket lifts off (`updateRockets`, `startRocketFlight`): rises on a flame + smoke trail, disappears for 6-10s, then a warning ("INCOMING", pulsing red 300px impact zone, screech) and a 1.3s descent. Target: random spot on the map, or 25% straight at the player.
- Impact (`rocketImpact`): 300-radius blast, walls/props/people wrecked, crater decals, ring of secondary explosions, ~9 lingering fires, then ~110 pieces of burning debris raining down for ~7s over a 460px area (each a small blast + damage + fire). The pad shows a scorched, empty circle and a fresh rocket rolls out ~100s later.
- Admin panel → "city events": 🚀 rocket → random spot / 🚀 rocket → ME.

### 2026-09-21g — Rocket: double size, board it, hit-to-launch; trains
- Rocket is 2x (344px tall, launch-pad rings 2x) with a visible boarding hatch. Press E beside it to CLIMB ABOARD (5s countdown): you're hidden + invulnerable for the whole flight, the camera follows you up, then across the map to the landing spot, and you walk out of the crater unhurt (12s of invulnerability) while everything around is flattened (`boardRocket`, `rocketRideStep`).
- Any attack (or a nearby explosion) on a waiting rocket now ignites it: 2.6s countdown ("3-2-1", flame + shake) then liftoff (`ignite` phase).
- Rail yards have two tracks now (parked locomotives on one) and a train thunders through on the other every ~22-45s: horn, screen shake, flattens props and hits anyone on the tracks (`updateCityTrains`, `trainRuns`).

### 2026-09-21h — Light flicker fix + runaway trains
- Light flicker no longer has per-frame random blackouts/surges (they read as the screen shaking); it's now a slow soft sag (`flicker` lights and lamppost heads).
- Hit a parked locomotive and it takes off — randomly forwards or backwards, accelerating to ~700px/s, tearing through walls, props and people (heavy damage + knockback) for ~3s, then explodes into a burning train wreck (charred hulk, fires that burn ~30s, smoke; `igniteTrain`, `trainWreckBlast`, `runawayTrains`, `trainWrecks`).

### 2026-09-21i — Zoo breakout
- Every ~110-200s (once you're within ~2600px of a pen) a pen's fence blows apart and its animals escape (`zooBreakout`, `updateZooBreakout`): "ZOO BREAKOUT" alarm + explosions at the fence corners.
- Escapees (`c.esc`, `BEAST` table, `beastStep`): lions/foxes/scorpions/pandas hunt the nearest person (player, civilians, cops) and bite; the elephant tramples in a wandering line through walls, props and people; camels/zebras/giraffes/deer stampede and barge into anyone in the way; penguins etc. are harmless. They take several melee hits or bullets to kill (`hitCritters` / `updateBullets` handle `esc`), still with no reward.
- Admin panel → city events → 🦁 zoo breakout (nearest pen).

### 2026-09-21j — Police helicopters + ferris wheel ride
- Police helicopters (`updateHelicopters`, `drawHelicopters`, `helis`): at 3★ (wanted 60+) one chopper flies in, circles the player and shines a searchlight; at 4★ it opens fire in bursts; at 5★ there are two and they rope down SWAT every ~16s. They leave once heat drops. Shoot them (bullets), blow them up (explosions) — they spiral down and explode (+$150, fires). Admin panel → city events: 🚁 police chopper (3★) / 🚁 max heat (5★).
- Ferris wheel ride: press E at the base to climb into the nearest gondola and ride one full turn (~15s, wheel speeds up, camera rides up with you; you're hidden + invulnerable; you step off at the bottom). If the wheel is wrecked mid-ride you drop out unharmed (`boardFerris`, `ferrisRideStep`, `FERRIS_PADS`).

### 2026-09-21k — Crash sweep + frame-rate check (city)
- Swept all 49 chunks of the city in every country 1-6 (every district + unique building): 0 script errors, 0 draw errors, 0 console errors.
- Frame rate: draw is cheap (~2-3ms) in every district; the cost was the SIMULATION — every person in the whole explored city was simulated every frame (step ~13ms with ~180 people, frame ~25ms). Fixed: city folk more than 1500px from the player who aren't hunting/targets/responders/soldiers now wait frozen until you come near (`updateEnemy` cull in step). Same city with 239 people: step 5.0ms, frame 8.3ms.

### 2026-09-21l — Heists
- Any safe in a city can be cracked: stand next to it and press E, then stay put ~10s (`startHeist`, `updateHeist`, progress bar over the safe, sparks). Leaving the safe drains the progress (bail after a few seconds). The alarm rings (red/blue flashing light), heat jumps to 3★ so choppers + cops come.
- Payout by place kind (`SAFE_LOOT`): bank $700, exchange $600, casino $550, customs $350, museum $300, lab $260, hotel $220, office $200, other $150. Cracked safes show an open door with cash stacks.
- CLEAN GETAWAY: escape the heat (wanted back to 0, no chopper overhead) after a heist for a 40% bonus on everything you cracked.
- 2026-09-21m: police chopper drawn 2x (hit radius/bullet origin/shadow scaled); searchlight cone fades to fully transparent at the ground and the ground spot is far fainter.
- 2026-09-21n: three new strong biomes — Cursed Wasteland (purple blight soil, green slime rivers/pools, twisted slime-beaded trees, slimelings, drifting spores), Haunted Marsh (murky ground, ghost trees with hanging moss, gravestones, thick fog, wisps, murk river), Crystal Caverns (dark blue stone, crystal-shard trees, stalagmites, glowcaps, glowing crystal pools, cyan glints). Each has its own ground, city ground/roofs, flora, water, night glow and weather. New countries now DEAL their biome from a per-run shuffled deck (no repeats until all 17 are seen; country 1 stays the plain forest; older saves keep their biome). UNTESTED IN-BROWSER (127.0.0.1 navigation was denied) — parse-checked only.
- 2026-09-21o: Crystal Caverns rework per feedback — rocks are now big 'geode' clusters (stone base, 7 softly glowing crystals, 1.55x); trees are crystal bonsai (gnarled dark trunk on a stone mound, canopy of crystal petals in 3 clumps). Also fixed: new rock kinds (geode/stalag/tomb/blightstone) weren't in the drawProp whitelist so they fell back to plain boulders. Deck verified: 17 countries in a row, no repeats.
- 2026-09-21p: Crystal Caverns rocks redrawn as rounded shaded boulders with crystals sprouting from the top at varied angles (no more rectangular base).
- IDEA (user, 2026-09-21, not started): give the country/world map more detail than dots and lines — show land beneath, rivers, oceans/coast, biome-tinted regions, so countries read as places.
- 2026-09-21q: GIANT SLIME raid boss — some cities (deterministic per city; ~34% in country 1 from tier 2, ~48% later; never the capital/rival/revolt cities) are held by a Giant Slime instead of a faction + hold-the-square. Moves: Slam (shadow, shockwave), Spit (acid globs -> damaging pools), Split (slimelings), Roll (charge that flattens walls/props), Absorb (eats slimelings to heal), phases at 66%/33%; core exposed (+60% damage) after slam/roll; untouchable mid-air/roar. Boss HP bar with phase ticks; kill = +1 SLIME DNA (village.dna.slime; +2 at tier 3+) — DNA is stored but mutations not built yet. Lumpy melting scary look (bloodshot slit eyes, toothy maw, drool, spines, swallowed skull). Admin: 'Giant Slime boss' button. Also: Jade Pagoda (temple district) is now 3x size with a health bar (700 hp), cracks/smoke as it's damaged, collapses in a burning blast; mkLandmark exported on debug hook. IDEA logged: more detailed world map.
- 2026-09-21r: MUTATION LAB. Buildable 'Mutation Lab' (cult OR holding any DNA; craft/build menu; E beside it opens the lab, reusing the #smithy overlay). Spend 1 slime DNA to mutate a villager: RANDOM look (Slime Arm / Slimed Face / Gel Torso / Glowing Eyes / Slime Crest / Goo Feet, 4 slime colours) + RANDOM gift (Gelatinous Might +35% dmg, Jelly Hide +50% hp when mustered, Regenerating Goo, Toxic Touch slows enemies, Slime Slide +25% speed, Sticky Hands +30% work); max 3 per villager; live animated close-up portrait in the lab (drawMutPortrait — reusable for the upcoming villager conversations); mutations drawn on the in-world villagers (drawMutOverlays); stored on village.villagers[].mut, DNA carries into New Game+. Admin: '+3 slime DNA + lab'. Boss: health bar now floats over its head (with phase ticks) even for admin-spawned bosses; explosions do 3x damage to it. Debug hook exports mkProp/openMutLab/mutateVillager.
- 2026-09-21s: FIVE MORE BIOME BOSSES on a shared fight engine (BK table): Magma Golem (Ashlands; eruptions, lava spit, boulder charge, ember imps), Frost Colossus (Snowfields; ice spikes, icicle rings, slowing pools, frost sprites), Bog Lich (Haunted Marsh; blinks next to you, grasping hands that root, soul ring, skeleton minions), Crystal Titan (Crystal Caverns; shard rings, crystal spikes, shardlings), Thorn Horror (Steaming Jungle; vine lashes, poison spit, sprouts). Country 1 = Giant Slime; other biomes without their own boss draw a random kind per city. New shared moves: 'strike' (telegraphed hits around/on you, kind-specific effect) and 'ring' (radial shot ring); Bog Lich 'blink'. Each boss drops its own DNA (slime/magma/frost/bone/crystal/thorn). Mutation Lab is now multi-DNA: each type has its own palette, look names and 6 gifts (36 total incl. new effects: ignite, frostbite, guard, thorns, lifesteal); overlays per type (flame crests, ice crowns, antlers, bone ribs, crystal crests, flower crests...). Admin: boss-kind select + spawn, '+3 every DNA'. Verified: all 6 bosses draw, every move x every kind runs with 0 errors, lab UI ok.
- 2026-09-21t: boss redesign after 'too basic/friendly, all slimes': Magma Golem -> MAGMA DRAGON (bat wings with lava veins, horns, fangs, clawed legs, spiked tail, fire in jaws), Frost Colossus -> FROST GIANT (fur boots, horned helm, ice beard, tusks, huge spiked tree-trunk club that raises on attacks), Bog Lich (much bigger; skull staff with green fire, orbiting skulls, rune circle, ribcage), Crystal Titan -> CRYSTAL SCORPION (8 legs, pincers that open, arching tail with glowing stinger, cluster of eyes, crystal spines), Thorn Horror -> THORNWOOD ANCIENT (colossal treant: root legs, hollow glowing face w/ splinter teeth, thorned branch arms + vine whip, canopy crown). All drawn 1.35-1.4x with larger hitboxes (r 32-46); 0 errors across every move.
- 2026-09-21u: Magma Dragon rebuilt as a side-on four-legged dragon (ref: charcoal dragon with gold belly + purple wings): near/far wings that flap (bigger when airborne/roaring), four legs on a real walk cycle (feet swing/lift only while it travels, planted when it stands), swaying tail, neck plates, horned head with hinged jaw, teeth, smoking nostrils, fire breath cone on spit/strike/ring/roar; faces the player (mirrors). Frost Giant legs now step and bob; Crystal Scorpion legs step from real distance travelled. Bosses track a._wk/_mv (distance-driven walk phase).
- 2026-09-21v: bosses now have THREE views chosen by where you stand (side E/W mirrored, front when you're below, back when above; hysteresis in bossView): Magma Dragon (side/front w/ spread wings + back w/ spined back, wings and tail toward you), Frost Giant (side striding w/ club held out front, front, back w/ fur cloak + club on shoulder), Bog Lich (front/side + new back w/ glowing sigil), Crystal Scorpion (side, front, back w/ tail rising), Thornwood Ancient (front/side + back w/ bark back and knot glow). All walk (feet lift by distance travelled). Added fine surface textures (_texEllipse: scales, fur, stone facets, bark) on torsos/heads. Side club now held forward instead of covering the torso. 0 errors across every boss x view x state.
- 2026-09-21w: Bog Lich and Thornwood Ancient got real SIDE views (lich: hunched profile, skull face, ribcage rent, spine, antlers, streaming cape, skull staff, detached casting hand w/ orb, orbiting skulls; ancient: striding trunk legs w/ root toes, hunched thorny trunk, hollow-eyed profile face w/ brow branch + splintered mouth, thorned reaching arm + vine whip, swept canopy). Every boss now has side/front/back (left/right mirrored). New per-boss AURA (drawn under the body): dragon heat glow + embers, giant snow swirl, lich wisps, scorpion orbiting shards + light shafts, ancient falling leaves. 0 errors across all bosses x views x moves.
- 2026-09-21x: RANDOM CHAMPION BOSSES. 12 champions (Necromancer, Zombie Brute, Vampire Lord, Plague Doctor, Storm Witch, Shadow Master, Ogre Chieftain, Ringmaster, Butcher, Time Weaver, Wraith Queen, Arsonist), dealt per run from a shuffled deck (village.champUsed). Each country: two tier-2/3 cities (not capital/rival) are held by a champion (ensureChampions, node.champion) — marked on the map with a purple ring, ☠ and the champion's name so you can pick a path. Beating one grants the matching existing PLAYER_TRAIT (necromancer/zombie/vampire/plaguedoctor/stormcaller/ninja/ogre/hypnotist/cannibal/timebender/ghost/pyromaniac) for the WHOLE playthrough (village.powers, re-applied by applyPlayerPerks, carried into New Game+; duplicate = +3 legacy). Champions ride the biome-boss fight engine (slam/strike/ring/spit/split/roll/absorb/blink, phases, minions incl. new zombie/bat/rat/shadow/goblin/clown) but are drawn as big actors (real front/side/back walking) with signature trimmings; ~60% of a biome boss's HP. Admin boss dropdown lists them. 0 errors across all 12 x all moves; necromancer kill verified granting + applying its power (HUD shows it).
- 2026-09-21y: skeleton thralls (Necromancer perk) now drawn as real skeletons: see-through ribcage (no torso/shirt, no dark backing), spine, sternum/clavicles (front), shoulder blades (back), profile ribs (side), pelvis, bone arms/legs with joints, bare skull with big hollow eye sockets (faint green glint), nose hole and teeth; s._skel flag set in raiseSkeleton. Exports raiseSkeleton on the debug hook.
- 2026-09-21z: zombies (Zombie perk Outbreak converts, wager zombies, player's own Zombie perk look) now KEEP their original clothes: shirt/pants drained + darkened (mutedColor), skin blended toward sickly green (convertZombie), plus per-zombie dirt smudges, torn ragged hem, blood splashes/streaks and red hands (drawZombieGrime); no more universal green shirt. Skeletons keep hats/glasses/beards: raiseSkeleton copies the victim's _look (random look for Raise Dead), drawActorLook 'face' layer is drawn again for skeletons.
- 2026-09-22a: perk info boxes (#traithud) now show recharge: each active perk's box fills left-to-right (purple->gold) as its cooldown recharges, with a live countdown (e.g. 21.0s) top-right; when ready the box gets a gold outline, a pulsing gold fill and 'READY' (updatePerkFill, per frame). Passive perks unchanged.
- 2026-09-22b: berry bushes in Snowfields now frost-bitten (blue-green leaves, snow caps on every clump, snow drifted at the foot, duller berries). Marsh gets passive slimelings. 10 new fantasy critters wander the later biomes: pixie (glowing air fairy), jackalope, raptor, wyvern, unicorn, frostbun, yeti, griffin, crystalbug, phoenix chick (per-biome fauna lists). Zoos in later countries mix in the local fantasy beasts (ZOO_FANTASY) and breakouts know them (BEAST): raptors sprint, yetis/griffins maul, wyverns breathe fire (FWOOSH! fire hazards). Kennels in later countries have ~45% fantasy pets (FANTASY_KENNEL): raptor (fast, hostile), drakelet (breathes fire), yeti, unicorn foal, slimeling.
- 2026-09-22c: Jade Pagoda shadow fixed — it was drawn 45px below the base as a detached blob; now a tight contact shadow hugging the base with a soft wider penumbra.
- 2026-09-22d: Jade Pagoda gets a long angled tiered shadow (falls to the right) AND much more detail: stone platform with steps, balustrade, moss; plinth with block lines, studded red double doors under a gilded plaque, foo-dog guardians, red pillars; each storey has red corner pillars, lattice windows with a warm glow, curved tiled roofs with tile lines/ridges, upturned eaves with gold tips, pulsing hanging lanterns and swaying bells; gilded sōrin ring stack + glowing jewel finial; smoking incense burner. Also detail passes on other large landmarks: locomotive (headlamp glow, brass boiler bands, rivets, lit cab window, number plate, wheels + rod), prop plane (cockpit glass, panel lines, engine cowling, wheels, roundels), rocket (panel seams/rivets, checker band, framed portholes, hazard band, flag, gantry platforms and cables), crane (rust streaks, cab window, hazard stripes, cables, beacon), radio dish (bolted base, struts, mesh rings, beacon), fire truck (light glow, hose reel, door shine, stripes).
- 2026-09-22e: FIRE TRUCK rebuilt (98x36): red cab roof + one big raked windscreen wrapping the whole nose with chrome bumper/grille/wing mirrors, siren light bar across the cab roof (flashing red/blue with glow), ladder racked along the roof (rails, rungs, brackets, yellow tip, turntable), roller-shutter equipment lockers, hazard-chevron tail, rear cannon. It was already drivable (E, hose on attack) but the boarding reach was 50px from its centre so an 84px truck was un-enterable from the ends — reach now scales with vehicle size; hp 220 -> 520, takes 60% less damage, rams 1.5x harder. FERRIS WHEEL: chasing rim bulbs, bulbs up the legs + X bracing, bulbs along every spoke, gondola roofs/doors/windows, animated gold hub, platform, ticket booth, queue rail, sign. CAROUSEL: scalloped canopy edge with gold trim, panel shading, gilded centre pole + mirror panels, painted scenes under the canopy, candy-striped horse poles, manes/tails/saddles/eyes, platform boards, chasing platform bulbs. SLEEPING: the head in a bed is drawn at the standing sprite's true size (hair, closed eyes) instead of a tiny ellipse, and there's a body-shaped bump under the blanket (shoulders, torso, two feet, shadow, highlight, chest fold). PATROLS: village guards patrol at a chill 92 walk (still sprint when they spot a threat); street thugs / beat cops / gang guards patrolling calmly move at half speed; anything stuck 7s gets 1.6s of noclip then is nudged onto open ground (trapTick).
- 2026-09-22f: fire truck made far tougher after it kept blowing up: hp 520 -> 1800, takes 88% less damage (was 60%), and barely loses speed when it rams things (its big 98px footprint clips walls and props constantly, which was grinding the old hp down within seconds).
- 2026-09-22g: vehicle collision physics: head-on hits bounce the car back (speed sign flips, sparks, camera shake), people bowled along the heading with knockback scaled by speed. 2026-09-22h: speed-scaled SMASH — a fast head-on hit does damage ~700*speedFrac^3 to walls/props so a flat-out run bursts through (only bounces if the obstacle survives). KENNEL ANIMALS now real creatures: species HP, damaged by melee/bullets/explosions, knockback, die (hostile ones no longer time out for 40s+). Logic verified by syntax check only; not played live.
- 2026-09-22i: guard patrol routes/zones only drawn while placing one or while talking to the owning guard; villager name tags hidden until you've talked to them (village record .met), quest targets still labelled. Unverified live.
- 2026-09-22j: villager name tags also appear when a villager is hurt or appears in gossip (both speaker and subject). Unverified live.
- 2026-09-22k: guards report to the campfire each new day (warm up ~1.6s) before starting their beat; new progress-based stuck detector (under 30px progress in 3s while trying to move -> 2.2s noclip straight at target) catches corner-jitter that the old raw-movement check missed; squadAvoid skipped while noclipping. Unverified live.
- 2026-09-22l: home country (no biome kit) now has wildlife: rabbits, deer and squirrels wander/graze/flee (up to 10 at a time) using the existing critter system (HOME_FAUNA). Not seen live.
- 2026-09-22m: shovel digging bare ground now also leaves a permanent dirt-path dab (same look as the generated goat trails) — dig a line to make a path from game start; right-click in build mode removes it (no refund). Better paths still come from paving research. Not tested live.
- 2026-09-22n: dirt path is now drawn with the shovel equipped + hold RIGHT mouse and drag in the village (up to 240px from you, free, no water/solid tiles); replaces the swing-dab version. Build-mode right-click still removes dabs. Not tested live.
- 2026-09-22o: shovel dirt path reworked to work exactly like the build-tool path brush: equip shovel, right-drag traces a preview, release lays it (same CELL*0.85 spacing and dab sprites as gravel/cobble, new free 'dirt' texture, no rotation jitter). Reach 260px, skips water/solids. Build-mode right-click still removes. Not tested live.
- 2026-09-22p: shovel path drawing scrapped (user: worse than build mode). Dirt path is now a normal build-mode piece (EARTH category, 1 dirt -> 3 path, drawn with the standard path brush, same trail-look colours) available from game start via registerPaths(true); researched paths unchanged. Shovel description reverted. Not tested live.
- 2026-09-22q: dirt/sand/clay are now craft-bubble materials (shown once you've dug some; new icons) so Dirt Path (and clay/sand researched paths) can actually be crafted. Plot now costs 2 dirt (was 1 wood), Packed Earth floor 1 dirt (was 1 stick). Dirt comes from digging with the shovel. Not tested live.
- 2026-09-22r: stuck villagers: ejectFromWalls/freeSpotNear pop anyone embedded in a wall to the nearest open floor (checked every 0.4s and right on waking from bed), villagers that can't walk for 3.5s get a brief noclip, noclip end now lands on nearest open ground instead of random jitter. Guard morning campfire visit shortened: counts as arrived within 95px, warms 0.7s, gives up after 12s or when stuck (was standing ~40s). Not tested live.
- 2026-09-22s: VILLAGER CHAT. New 'Chat' row in the villager E-menu opens the same close-up face scene as the sit-down (expressions react to what they say). Topics: Any news? (world impact — cities held, revolts/unmanned cities, governors, the rival's advance, capital, cult devotion, hunger, mutation lab, wildlife kills, biome, weather), Gossip (reuses gossipLine; reveals both name tags), How are you? (job/hunger/bed/mutations/quirks/narrative), Need anything?, Give food (-1 food, fixes hunger). Lines authored from live world state so the village's mood reads out your impact. Also: mission 'road home' arrow/exit now follows the getaway van if it moves (syncExitToVan). Chat verified in-browser (scene renders, news works); van fix untested.
- 2026-09-22t: chat/face scenes: full torso + shoulders + arms down to the bottom (chat only), text ~3x faster and drawn on a dark panel, canvas now sized to the window and device pixel ratio (crisp, not stretched). Outdoor scene backdrop now animated: drifting clouds (more/greyer in rain), canopies sway with a gust, falling rain, biome atmosphere (snow, petals, embers+ash, dust, spores, crystal glints, mist/fog; home country gets a few leaves). Verified in Lush Wetlands (mist + clouds).
- 2026-09-22u: guards route around solid props: findPath(avoidProps) treats cells covered by trees/crates (padded by the walker's radius) as blocked; guard patrol uses it (falls back to walls-only), re-plans immediately when held up, and squadAvoid checks props for guards so newly grown trees don't pin them. Not tested live.
- 2026-09-22v: guards nap around midday (tod 0.36-0.42 start, ~0.09 long, staggered per guard): walk to their bed (or beside the campfire), sleep visibly in bed with z's, wake into open floor and resume the beat; any threat wakes them (the threat branch takes over). Not tested live.
- 2026-09-22w: chat/face backdrop: clouds rebuilt (layered puffs, lit tops, shaded flat bases; night/rain palettes) and now drift steadily in ONE direction at fixed per-cloud speeds (the old speed was multiplied by a time-varying gust, which made them stop/reverse); sun and moon now travel an arc across the sky with the time of day, with a halo. Verified visually (clouds); sun position not fully checked.
- 2026-09-22x: chat/face-scene backdrops are per-biome (SCENE_PAL, scenePal/sceneLandscape): sky, ground and landscape match all 16 later countries — pines w/ snow, palms, dunes+cacti, bamboo, willows, bare dead trees (Ashlands adds lava glow), crystal spires (no clouds), rolling hills; home country unchanged. BETS: flying saucers (Alien Invasion) are no longer glued to you: capped speed (150/200 far), periodically lose the trail and wander off 4-8s, only beam you when hunting within 380px. Verified visually via forceScenePal hook; UFO behaviour untested live.
- 2026-09-22y: ROOF ROLES: every enclosed room's roof shows what's inside (classifyRoofs, re-derived on build/prop edits, HQ check and each morning): church (altar/temple/consecrated hall: stone bell tower w/ slate spire + gilded cross + rose window), lab (mutation lab: bubbling green glass domes), observatory (study/scriptorium: copper dome + tracking telescope), forge (blacksmith: glowing sooty stack, smoke, sparks), barracks (weapon rack/barracks/watchtower: waving banner), market (striped awning), granary (grain lid), hall (long/side table: two smoking chimneys), house (beds: plain chimney). Visually verified with test roofs. Villager name tags now only show when you're within ~120px (fading in) AND you've met them; quest targets unchanged.
- 2026-09-22z: village guards' name tags follow the same rule as other villagers (only once met, only within ~120px). Raid-mustered squad members keep theirs.
- 2026-09-23a: study/scriptorium rooftop is now a library sign: an iron bracket out from the wall beside the door with a swaying crimson flag showing an open book (replaces the observatory dome+telescope; role renamed 'library'). Verified with a test roof.
- 2026-09-23b: door book-sign scrapped; library/study roof is a plain chimney for now while a design is chosen.
- 2026-09-23c: library/study roof = skylight: 3-5 framed glass panes along the ridge, sky-blue with a sweeping glint by day, lamplit gold with a soft glow at night. Day look verified with a test roof; night branch not seen (couldn't force night in the test).
- 2026-09-23d: library skylight is now one large opening cut out of the roof (clip evenodd) with a wooden frame + glazing bars and a faint glass tint/glint, so the room (floor, furniture, people) shows through; warm tint at night. Verified with a test roof (over grass).
- 2026-09-23e: WORLD REACTS (#1 slice): conquest banners in each held city's faction colours planted round the village (persisted positions, sway in wind) + the rival's torn standard near the edge once they hold a stronghold; villagers greet you after a raid based on the result (new city taken / you died / plain return) and their devotion; ~28% of ambient barks now draw on world state (chatWorldFacts). Banners verified with faked conquests (reverted); welcome-back not exercised live.
- 2026-09-23f: CHURCH makeover: slate-blue roof (was default grey), cruciform layout with a shaded transept, stone ridge crest + finial, cream eave trim, bigger bell tower with a slate spire and gilded cross, and the 'blue circle' is now a proper 8-segment stained-glass rose window over the crossing (glows at night). Windows in church buildings render as stained glass (coloured leaded panes) on all three window draw paths (isChurchCell/stainedGlass). Roof verified with a test roof; stained-glass windows not seen yet.
- 2026-09-23g: IRREGULAR ROOFS: roofs follow the real floor plan for L / T / notched buildings (interior cells + the wall ring, merged into a clip path, with proper shadow and eave edges) instead of always the bounding rectangle, so they no longer overhang trees and gaps. Room tests (inside-roof reveal, beds, roles, HQ tile count, roomOf) are cell-accurate via inRoom(). Role features (chimney, tower, skylight...) anchor to the nearest floor cell. Rectangular buildings are unchanged. Verified with a temporary L-shaped building (removed).
- 2026-09-23h: church windows: stained glass now shows on the OUTSIDE face too (isChurchCell was missing the south wall row), and every church window is a gothic pointed arch (peaked top, leaded frame, 2x4 coloured mosaic), dropped slightly so the peak clears the roof edge. Verified with a temporary church (removed).
- 2026-09-23i: STAGED UNLOCKS: shrine = cult (10 villagers); market + granary = Village rank; blacksmith + scriptorium = first city taken (ratchet); temple + barracks = country 2; watchtower + Town rank = country 3; Mutation Lab = first boss DNA or country 2 (no longer 'any cult'). Blacksmith split out of registerCultBuild into registerBlacksmith. Locked-feature cards show the actual requirement. Each new unlock flashes 'New: X' once (existing saves are seeded silently). Verified on a country-8 test save (gating + no errors); fresh-game progression not played.
- 2026-09-23j: CHAT FOLLOW-UPS: villagers remember you (fed / helped / chatted / hurt, saved on their record via vmem) and greet you accordingly (gratitude, wariness after a hit, 'been a while'); 'Need anything?' now hands out a small errand (wood/stone/sticks/dirt, 4-12) with a 'Give N x' button, reward = +1 conviction (cult) or favor, mood up, 3-day cooldown, expires after 7 days; gossip now spreads deeds between villagers (repGossip) and 'Any news?' includes your overall reputation (kindness vs having hurt someone). Hitting a villager is remembered. Verified in-browser with two test villagers (errand -> give -> the other villager repeats it); test data removed.
- 2026-09-23k: the 'cult hall still needs...' HUD panel now hides for good once the hall has been consecrated (hqDone), not only while it's currently valid.
- 2026-09-23l: player takes no damage while driving a car or diving into the getaway van; brief invulnerability (1.2s, 2.5s if the car is wrecked) after stepping out.
- 2026-09-23m: cult hall panel now reports on the room that contains the altar (it used to describe whichever room was closest to qualifying, e.g. a bedroom with beds + study), so 'still needs' is about your actual hall.
- 2026-09-23n: CITY WEATHER rebalanced + varied: rain no longer follows every fair spell. Fair spells are longer (34-70s x country factor) and roll into: light shower ~10% (max intensity 0.45-0.7, no lightning), storm ~4% (full rain + lightning), overcast ~22% (grey lid + darker noir wash), fog ~14% (drifting fog banks), windy ~16% (steady gusts: leaves/litter tear across), heatwave per country, else another fair spell (~38%). Not observed live.
- 2026-09-23o: CULT HALL rule relaxed: the hall (>=20 floor tiles, altar + weapon rack inside it) no longer needs the beds/study inside — 3 beds and a study just have to exist anywhere in the village. PERSONAL REQUESTS: villagers with a bed can ask for a couch / pot plant / standing torch in their own room (new craftable Couch + Pot Plant decor, reusing city prop art); when it's in their room, opening the chat completes it (mood up, +1 conviction/favor) and ~70% of the time they gift a small keepsake (dropped at your feet); resource errands gift ~25% of the time. Not tested live.
- 2026-09-23p: (1) guards carry a torch after dark: flickering hand-held flame + a warm light pool that moves with them (off while napping/in bed). (2) Couch/pot-plant are NO LONGER craftable (removed recipes/build pieces). Villager room requests are now fetched objects: couch (new bulky keepsake w/ art), armchair, houseplant (pot plant), desk lamp, snow globe — or a standing torch (buildable). A request adds a bonus 'gimme' errand to the campfire board ('...for Ada's room'); the signpost run fetches it like any errand; set it down in their room (hoard/display) and open the chat to finish -> mood, conviction/favor, ~70% keepsake gift. Verified requests + board offer in-browser; guard torches not seen live.
- 2026-09-23q: NIGHT GLOW for the new glass: library skylight now glows lamplit gold with a bloom; the church rose window lights up as a wheel of coloured glass with a warm halo (both only while the roof is opaque); church windows are lit STAINED GLASS at night (saturated arched mosaic + a coloured pool of light per glass colour spilling on the ground) instead of the uniform yellow pane/halo. Verified visually at night with test buildings (removed); note G.tod setter in the debug hook doesn't reach village.tod - set village.tod directly when testing.
- 2026-09-23r: GRAND SHRINE: new 4x4 town building (unlocked by the cult, wood 24 + stone 36 to craft), ONE per village, costs 5 favor + 5 conviction on placement, gives +2 favor a day, lights its square at night. Placing it opens a chooser of 20 designs (obelisks, torii, pagodas, crystals, statues, trees, fountain, brazier, standing ring, skull altar, orb, crescent gate, sun disc, all-seeing eye...) drawn procedurally; the choice persists (placedProps.v). CHURCH/LIBRARY GLOW: skylight night glow is now the same deep gold as the lit windows (frame + bars); rose window redrawn with perspective on the pitched roof (foreshortened across the slope, raised rim, curved leading, shaded curvature) by day and night, with deeper richer colours. Verified: chooser UI, placement + costs + persistence in-browser (test shrine removed, favor/conviction restored); night roof glows not re-viewed after the recolour.
- 2026-09-23s: the Active Perks box and the minimap are hidden while the craft menu or build mode is open.
- 2026-09-23t: BAMBOO rebuilt (Bamboo Vale trees): six varieties per grove — tall thin green, giant moso (fat stalks), golden, black, young dense shoots, arching/weeping — stalks now ~2.5-3.8x tree height (was ~1.1x), many more nodes, drooping leaf tufts. Chosen per-tree from position so groves vary. Verified visually.
- 2026-09-23u: Grand Shrine now has a proper craft/build icon.
- 2026-09-23v: Grand Shrine icon redrawn to look grand: golden radiance + rays, three-step marble platform, tall spire with glowing gold runes and a gilded tip, flanking flame pillars. (Before this it fell back to the generic wood-pile icon.) Verified.
- 2026-09-23w: (1) Grand Shrine is now SOLID (collision box over its platform, art shifted to sit on it) — you can't walk onto it. (2) TOWN BUILDINGS reworked from miniature houses into OBJECTS for buildings you build yourself: Market Stall (3x2, big striped canopy; works OUTDOORS — group several into a marketplace), Grain Store / Barracks Bunks / Temple Font / Scribe's Desk (work only when placed INSIDE a roofed room you built; a hint pops up if not), and a tall 2x2 Watchtower. Redrawn art + bigger footprints; yields (food/research/favor/cash) and barracks squad bonus now check indoors/outdoors (propIndoors). These pieces still set the roof feature of the building they're in. Verified visually (test props removed).
- 2026-09-23x: Grain Store = +1 food/day each, Barracks Bunks = +1 squad each, both max 5 (placement refused past 5; TOWN_MAX/townCap). Grand Shrine recipe vanishes from the craft menu once one stands (and leftover crafted pieces are voided on placement). EVERYTHING buildable now has substance: all placed props (beds, study, altar, shrine, rack, torch, blacksmith, lab, town pieces, yard pieces) are solid, plus collision for side/long tables, gift piles and display spots (bigger boxes). Actors already inside a solid piece can walk out (fixes being pinned when built around you); sleepers/nappers now arrive within 27px of a bed to allow for its solid box. Verified solid flags after reload; walking-into collision not directly exercised.
- 2026-09-23y: WATCHTOWER STAIRS: the tall tower is replaced by a staircase piece you place inside a 4x4 room you built (refused elsewhere; one per room). That room becomes a watchtower: role 'tower' redraws its roof as a plank lookout platform with a stone parapet, trapdoor and banner. Assign a guard (villager menu 'Man the watchtower' / 'Back to patrol', one guard per tower): they walk to the stairs, climb up (hidden from the ground, invulnerable), are drawn standing on the roof (visible when the roof is), and shoot hostiles within 340px. BARRACKS BUNKS redrawn as two of the real top-down beds stacked (frames, blankets, pillows), corner posts, ladder and pennant; footprint 2x3. Bunks verified visually; tower assignment/climbing/shooting not exercised live.
- 2026-09-23z: the sky/time-of-day clock is hidden while crafting or building (with the minimap and perks box).
- 2026-09-24a: in the village the Active Perks box drops below the sky clock and shrinks to a slim name-only bar (name, key, READY/cooldown); city keeps the full box. Verified visually.
- 2026-09-24b: Watchtower Stairs redrawn as a real staircase and enlarged to 4x2 (64x32), rotatable with R (2x4 when turned; rotation saved). Horizontal = side-on flight climbing right with stringer, risers/treads, handrail + posts and the hatch at the top; rotated = top-down flight climbing up the screen. Still only placeable in a 4x4 room. Verified both orientations visually.
- 2026-09-24c: watchtower stairs redrawn in the walls' oblique perspective (raised treads with full-depth top faces + south-facing risers, rail posts) instead of a flat side profile, in both orientations. The flight is one cell shorter than its 4x2 footprint (body 48x32, centre shifted): the low end is left open as the way on, and assigned guards walk to that open end. Verified visually.
- 2026-09-24d: (1) patrol guards' torches were being drawn before the night wash, so the flame went dark blue; they're now re-stamped bright in the relight pass (verified on a real promoted guard at night: bright hand-held flame + light). (2) Watchtower platform: a brazier (iron bowl on legs, coals, flame + light + warmth) in a corner, flame re-lit at night; the tiny manhole is now a big trapdoor (26x24 stairwell with steps visible, plank leaf propped open, hinges, ring pull). Verified on a test tower roof at night.
- 2026-09-24e: watchtower roof platform redrawn in the same oblique 3D as the walls: sunken plank deck inside a raised stone parapet (lifted tops, near side's outer face + far side's inner face showing, block joints, cast shadows on the deck), merlons with front faces, four corner turrets, banner on the NE turret; trapdoor/brazier/guard sit on the deck. Verified with a test roof.
- 2026-09-24f: tower lookouts are now drawn as THEMSELVES (the real villager sprite via drawActor, with their own clothes/hair/torch) and pace a slow lap round the inside of the parapet instead of standing as a crude figure; they still shoot from wherever they are on the platform. Verified with a promoted guard on a test tower roof.
- 2026-09-24g: no helicopters during city raids/takeovers (mission.node / mission.raid): none spawn and any in the air are removed; they were strafing the mustered villagers. Ordinary runs are unchanged.
- 2026-09-24h: WANTED blame fixed. Cause: every gunshot/grenade by anything on 'team player' (you AND your squad, guards, thralls, skeletons) called markWanted() (+14 each), so a few shots — even ones from your own allies defending you — hit 5 stars and choppers with no crime committed. Now: gunfire heat comes only from YOU (gunHeat), at most once per 1.8s, and not while hostile fighters (non-civ, non-cop) are within 420px; shop/car-alarm/civilian-kill heat is only for actions by you personally (from === player), not your allies. Untested live.
- 2026-09-24i: pixies now glow at night: drawn in the relight pass (drawPixieGlow) with their own colour (pink/blue/green/gold), a soft additive halo and fluttering wings, so the night wash no longer dulls them. Verified: several natural pixies glowing in the Bamboo Vale village at night.
- 2026-09-24j: VILLAGE EVENTS overhaul (part 1). (a) Readable: the morning event is now a card that stays until dismissed (was a 1.3s flash that got overwritten) + a HUD chip 'Today: <event>' with a tooltip. (b) Visible: Harvest Festival — bunting strung round the campfire with fluttering pennants, feast tables (food/mugs), hay bales, pumpkins, confetti + music notes, everyone leaves work to gather round the fire (until dusk), festival barks; Bountiful Harvest — baskets, sacks, pumpkins, hay cart by the fire; Merchant — a striped cart + the merchant by the fire (lit at night); Meteorite — a glowing smoking crater placed near the village; Drought — dusty haze + drifting dust; Sickness — the sick cough/sniffle and green puffs. (c) Guards no longer show the floating green triangle. (d) FIX: a villager's furniture request now completes on its own within ~1.5s of the piece standing in their room (hoard object, display spot/table, or built piece) with a popup + keepsake at their feet — before, it only checked when you opened the chat. Verified visually via forced events; the furniture auto-complete not exercised live.
- 2026-09-24k: VILLAGE EVENTS part 2 — 7 new events + venues. New: Wedding (couple stands under a flower arch, guests + petals + hearts; +mood/favor/+1 conviction), Bard night (bard on a stool/stage, evening crowd; +research), Market Day (5 stalls with traders in free spaces round the village, villagers browse; +cash), Travelling Fair (striped booths + balloon bunches; -4 food, +mood), Pilgrims (tents + cookfire on the edge; one may join), Lantern night (strings of glowing paper lanterns; evening), Wrestling day (roped ring with two wrestlers + cheering crowd). VENUES: campfire (festival/harvest/merchant), a new craftable EVENT GROUNDS (walkable 4x4 plaza with a stage and lantern posts; one per village; wedding/bard/lantern/wrestling are held there once built, else by the fire), or scattered in free space (market day, fair, pilgrims) via findEventSpots. Event sites are stored with the day's event so decor stays put; villagers gather per-event (ring / stalls / couple at the arch) inside a time window (day or evening). Event chance 38% -> 55%. Verified visually: market day, fair, wedding arch, wrestling ring, lantern night around grounds; bard/pilgrims art + real villager gathering not seen.
- 2026-09-24l: EVENT PROPS pass: (1) all event props are now SOLID to the player (footprint boxes via evBoxes; stalls, tables, tents, the ring's edges, arch posts...). (2) The wrestling event uses two REAL villagers fighting in a bigger 96x62 ring (plank platform, canvas mat with sawdust, padded corner posts, 3 ropes drawn as separate y-sorted posts so fighters sit correctly): they stand in the ring, swing with their own sprite animation, stagger and shout; crowd gathers outside. (3) Art detail pass on every event prop: 3D-box counters/tables with plank lines + outlines, slanted striped canopies with scalloped valances, hanging wares, varied stall goods, feast tables with cloth/pie/roast/candles/vase and benches, detailed hay/pumpkins (ribbed + vines)/baskets (woven)/sacks, hay cart with spoked wheels + pitchfork, merchant covered wagon + mule, fair booths with plush prizes + string lights, glossy balloons on sandbag, canvas tents with guy ropes/flap/bedroll, cookfire with tripod pot, wedding arch with dense flower clusters/drapes/garland + red carpet aisle, bard on a stool with rug + lantern. Verified: stalls, ring, and solidity (player stopped at the ring edge); fighters/other props not seen with real villagers.
- 2026-09-24m: (1) WAGERS: taking wagers is now unmissable — a 'Wagers in effect' card (name, curse, boon; click to dismiss) appears when the raid starts, and a persistent chip per active wager stays at the top of the screen for the whole run (updateWagerHUD). (2) On-screen messages (flash) were vanishing in 1.3s and overwriting each other: they now queue, stay 3.6-9.5s scaled to length (shorter if several are waiting), and can be clicked away ('click to dismiss'); end-of-run messages stay. (3) Goldfish bowl item redrawn as an actual goldfish bowl (round glass, blue water, gravel, weed, orange goldfish, bubbles, stand). Goldfish + flash queue verified in-browser; wager card/chips not exercised (need a city run).

- 2026-09-24n: TRAVELLING MERCHANT is a real shop. Walk up to him at his wagon (an "E trade with the merchant" prompt appears) and press E. Stock is rolled per visit: 3 forged weapons (tiers +1..+3, often elemental, priced by quality), a 30% chance of a unique, a 50% chance of a ROBOT VILLAGER ($420 — a normal villager record: eats, works, gossips, gets a quirk; just looks like a robot: metal skin, dome head, blinking antenna, glowing visor + grille, ear bolts), three rare ANIMATED decorations from a pool (lava lamp with drifting wax blobs, retro TV that flips channels — bars/static/landscape/bouncing cartoon/oscilloscope — faster when you stand close, plasma globe whose tendrils lean toward you, jukebox with neon + spinning record + notes, hologram globe turning inside a projector beam, aquarium with swimming fish/bubbles/weed, crystal lamp, gold statue), one ordinary decoration, and wood/stone supplies. Lit pieces cast coloured light at night (hoardGlow). Bought decorations are set at your feet as normal keepsakes. Verified in-browser: shop opens on E, all eight animated pieces render, robot villager spawns and draws; buying via clicks not exercised (test save had $0).
- 2026-09-24o: merchant's rare pool grown from 8 to 18 animated pieces. New: music box (pirouetting ballerina), crystal ball (swirling mist, an eye opens now and then), orrery (planets orbit a sun), firefly jar (blinking fireflies), mini volcano (erupting sparks + smoke), hourglass (sand runs, then flips), arcade cabinet (invaders shoot-'em-up, quicker when you're near), clockwork bird (hops + flaps), disco ball (colour-cycling mirror tiles + light spots), cuckoo clock (swinging pendulum, bird pops out every 6s). All glow at night. Verified rendering in-browser.
- 2026-09-24p: (1) LANTERN NIGHT now really glows: the string lanterns were keyed to the wrong time-of-day test and their light was faint; they now brighten with the actual night level (bigger halos, half of them cast warm light). (2) The village has 12 STANDING LANTERNS scattered around it (paper / gold / glass-cage variants on posts, walkable, positions picked once and saved in village._lamps), lit with flickering warm light after dusk. Verified at night in-browser.
- 2026-09-24q: lantern cores (event strings + the standing village lanterns) are re-stamped after the blue night wash in the same deep gold (206,132,32) + hot centre as the lit windows, so they pop against the night (_lampRelight, consumed in the relight pass). Verified at night in-browser.
- 2026-09-24r: weddings, bards, lantern nights and wrestling no longer sit on top of the campfire (which also blocked the mission board). Without an Event Grounds they now pick a free clearing 115-210px from the fire (bigger clearance for the ring), falling back to further out. Verified: ring/bard/wedding/lantern all landed off the fire; ring shown clear of it.
- 2026-09-24s: (1) FAIR / MARKET DAY now spread 7 booths/stalls through any free space 95-340px from the fire (and never on the fire itself; findEventSpots keeps 78px clear of it). (2) RACES: biomes now populate villages AND cities with other peoples (country 1 stays human). Elves (groves/moors/bamboo/caverns), dwarves (highlands/autumn/frontier/caverns; stocky, always bearded), orcs (plains/frontier/ashlands; big, green, tusks), lizardfolk (jungle/wetlands/desert/marsh; scales, snout, spikes, tail), demons (ashlands/dusk/wasteland; horns, tail, glowing eyes), slimefolk (marsh/jungle/wasteland/caverns/grove; jelly colours, big eyes, highlight), frostkin (snowfields/highlands; ice crest). Weighted per biome table (RACE_BIOME), rolled in rollLook so city crowds, kidnappees, pilgrims and arrivals all get them; the race lives on the look sheet (raceSkin/raceHair, build) so it survives city->village; racial first names for new arrivals; the first time each race joins your village a 'X live here now' notice shows. Drawn by drawRacePart/drawRaceBack. Verified all 7 render in-browser (test actors); real biome crowds not yet browsed.
- 2026-09-24t: races now show in the close-up FACE scenes (chat, sit-down, gift handover, dossier), which only knew skin/hair/shirt and so made everyone human. drawFace takes the villager's look sheet: elves get long pointed ears + green eyes, dwarves a great beard, orcs tusks/red eyes/brow, lizardfolk scales + crest + slit yellow pupils (no hair), demons horns + fangs + slit pupils, slimefolk glossy jelly with a drip (no hair), frostkin an ice crest, and the merchant's robot a visor + blinking antenna. Verified all 8 in-browser.
- 2026-09-24u: BEASTFOLK + UNDEAD races. Catfolk (whiskers, slit eyes, upright ears, curling tail; deserts/jungle/dusk/groves), dogfolk (floppy ears, long snout, wagging tail; hills/plains/frontier), foxfolk (tall ears, bushy white-tipped tail; autumn/snow/moors), rabbitfolk (long ears, buck teeth, puff tail; groves/hills/snow) — fur colours, no hair. Zombies (green-grey, sunken eyes, stitches, patches; marsh/wasteland/frontier) and vampires (pale, red eyes, fangs, widow's peak, high red-lined collar; dusk/wasteland/moors/caverns). All drawn in the world sprites, the tail/ears in drawRacePart/drawRaceBack, and in the face scenes (chat etc). 13 peoples now. Verified all rendering in-browser.
- 2026-09-24v: women were in the game (gender is 50/50) but the chat/sit-down face scenes drew everyone with the same face + only a hair curtain behind, so they read as men. drawFace now gets the look sheet and draws: women — long locks falling over the shoulders, lashes with a flick, lipstick, earrings; men — beards (full/goatee/stubble) and moustaches; everyone — glasses. Verified in-browser (a real elf chat was on screen while testing).
- 2026-09-24w: FACE DIVERSITY. Every face used one skull/eye/nose/mouth template. There are now 5 male base structures (chisel: square jaw + cleft + jawline + strong brow + cheekbone shading; lean; round; gaunt; broad bruiser) and 5 female ones (pretty: big eyes, thin arched brows, small pointed chin, full lips, blush, liner wing; elegant: long face, high cheekbones; soft; strong; round) that vary head width/height, jaw, chin, cheeks, eye size/spacing, brow thickness/arch, nose length/width, mouth width and lip fullness. Assigned at creation (look.face) and derived from the look for existing villagers. The face scenes also now honour hair style (bald, buzz, spiky, mohawk, afro, bun, bobs vs long hair for women), freckles and scars. Verified with 8 men + 8 women in-browser. (Tested via faceTest/faceTest2 debug helpers left in the file.)
- 2026-09-24x: each race now leans toward fitting base faces (RACE_FACES): orcs/dwarves/dogfolk broad + chisel + round, elves/frostkin/vampires lean + elegant + pretty, lizardfolk/foxes/cats lean, zombies gaunt, slimes/rabbits round + soft, etc; male and female pools separate. Verified 13 races x both genders in-browser.
- 2026-09-24y: the merchant's animated pieces now genuinely glow at night. Their light was pushed too weakly (about a third of a torch's strength) and the lit parts were being dimmed by the blue night wash like everything else. Light is now ~2x stronger/wider, and each piece's lit part (lamp wax, TV/arcade screen, plasma/crystal ball, jukebox, hologram, aquarium, volcano crater, etc.) is re-stamped bright after the night wash (HOARD_CORE + hoardCore, sharing the lantern relight list). Light now follows the item's drawn position (display spots too). Verified at night with 10 pieces.
- 2026-09-24z: the standing village lanterns (2026-09-24p) now appear ONLY on Lantern night (they were on permanently — a misreading of "lanterns scattered throughout the village"). 16 posts are scattered through free space up to 330px out, with fresh positions each lantern night; the old always-on set stored in village._lamps is discarded on load. Not browser-tested (test server origin was unavailable this session).
- 2026-09-24aa: (1) MERCHANT now visits on ~1 in 5 mornings from day 1 in any country (was ~5%, from day 2). (2) RACES matter: RACE_TRAIT — elves/vampires/cats scholarly, dwarves miners, orcs loggers/hunters, lizardfolk hunters who eat little, slimefolk eat 40%, zombies+vampires never eat, demons/vampires add favor, foxfolk earn $2/day, rabbitfolk/dogfolk farmers, dogfolk cheerful; 2+ of a people in the village = +mood; a notice states each people's talent when the first joins. Racial idle barks. Every city now has a dominant people (~45% of its crowd, 1 in 5 cities mixed). (3) THREE EVENTS: Race festival (a people you have 2+ of; coloured lanterns in their palette + a fire + standing lamps, their mood up), Haunting (drifting ghost wisps + cold tint at night; living −mood, zombies/vampires +mood, +8 research), Envoy (diplomat with a banner by the fire; feast him for a rare animated decoration, buy maps, or trade wood). (4) CULT HALL / WALL WINDOWS: removed the white glint line across the pane and made the part of the window that pokes above the wall face use a light surround/frame matching the lighter wall top (the lower part keeps the dark recess). Verified in-browser on a test wall + each new event.
- 2026-09-24ab: GHOST race (Haunted Marsh, Cursed Wasteland, Misty Moors, Caverns, Snowfields): pale translucent-looking body with a wavy floating skirt instead of legs, hollow black eyes, glows pale blue after dark, chilly face scenes (halo, hollow eyes, open mouth, wispy chin). Talents: never eat, scholarly, +0.5 favor, at home in hauntings; their own festival + barks. 14 peoples now. Verified world sprite in-browser (face scene not rendered).
- 2026-09-24ac: ghosts are properly see-through: drawn at ~46% alpha with a slow shimmer in the world (a plain globalAlpha draw, so no pixel-readback lag with a crowd of them), and 55% alpha in the close-up face scenes. Verified in-browser (grass shows through).
- 2026-09-24ad: the ENVOY is now a real person instead of a static stand: he is a normal-looking actor (any people from the biome) in a purple outfit and fez, carrying a purple banner on his back. On envoy days he walks in from the edge of the village once the morning is under way, stops at a free spot near the fire, faces you as you approach (prompt "E — talk to the envoy"), and — after you finish talking, send him away, or night falls — says a farewell and walks back out and disappears. Resumes at his spot if you re-enter the village mid-day; a stuck-guard teleports/removes him if he wedges. Verified end to end in-browser: approach, talk menu, leave.
- 2026-09-24ae: EVENT GROUNDS redesigned as a flat staging ground. It's drawn in the ground layer (under people — no more walking "beneath" it), with no stage/log/dead lanterns. It grows with the village, a facelift every 10 villagers: 0-9 bare graveled dirt + one torch; 10-19 denser gravel with a ring of stepping stones + 2 torches; 20-29 flagstones + 2 torches; 30-39 paved with an inlaid ring + 4 iron-bowl torches; 40+ marble with gold inlay + star + 4 brass braziers. The torches are real light sources (warm pool + bright flame core after dark). Build icon updated. Verified all five tiers in-browser.
- 2026-09-24af: Event Grounds no longer reads as a disc: the floor is painted once onto a cached sprite (buildGroundSprite) and then eroded — the rim fades to transparent so it melts into the grass, ragged bites are taken out of the edge, and bare patches leave the ground showing through (more at the dirt/gravel stages, fewer as it gets paved). The dirt/gravel stages now use the dirt-path colour. Verified stage 1 and stage 4 in-browser.
- 2026-09-24ag: EARLY PASSIVE INCOME: new job 'Trader' (assignable from the very start, no research): a trader earns about $5-8 a day (scaled by mood), each market stall makes traders 20% better; they hawk wares just off the fire (or at a market stall). The morning notice reads "Today's takings +$N". Verified: 3 traders -> +$15 on the day tick. Also investigated a report of having no money: known cash sinks are (1) completing the "Collection" urge (URGES.expenses — it takes $50 + 25 x prestige when you hand it over), (2) dying in a city (the run's cash reverts to what you started with), and (3) merchant/envoy purchases.
- 2026-09-24ah: (1) TRADER TRIPS: each morning a trader walks from the fire off the map in a random direction (never the same way twice running), is gone until the afternoon, then walks back in from that direction and hands over the day's profits on the spot ("+$N", coin burst, a line of dialogue). Until the village has a market stall he pushes a tiny wagon (also parked by him while he's home); a stall removes it and makes his profits 20% bigger. The daily tick only pays a trader who didn't complete a trip. (2) VILLAGERS PATH-FIND: idle/working/going-to-bed villagers used to head in a straight line at their goal and, if a wall was in the way, wedge until a 5-second stuck timer teleported them through it. They now A*-route round walls (villagerAim, re-planned every 2.5s) and the through-the-wall teleport-to-bed is a last resort after 16s (was 5s). Verified: a villager walked round the end of a 17-cell wall to reach his home; two traders left in different directions and returned with profits.
- 2026-09-24ai: the city "Collection" (cash) job no longer eats your money. Completing it used to subtract the full amount from your cash (so a successful run left you with nothing), and it was satisfied by savings you already had. It now counts only cash you raised on that trip, lets you KEEP it, and adds a 30% cut on top; the objective counter and the campfire description say so.
- 2026-09-24aj: (1) GRAND SHRINE LIGHTING: every design now lights up at night — a pulsing wash of its colour, plus each lit part (skull eyes, the All-Seeing Eye, orbs, crystals, lanterns, flames, runes...) casts its own flickering pool of light and is re-stamped bright after the blue night wash (SHRINE_CORES, shared relight list). The Horned Skull Altar's purple eyes now glow. (2) TEN DARK DESIGNS (30 total, listed first in the picker): Bone Throne, Impaled Idol (stacked skulls + crow), Blood Well (bony hands), Weeping Idol (hood, blood tears), Coffin Gate, Hanging Tree (caged wisps), Eldritch Maw (teeth, tentacles, great eye), Ossuary Spire (ghost-flame), Blood Moon Altar, Nightmare Idol (six eyes). Existing saved shrines keep their old index. (3) EVENT GROUNDS: all torches removed (menu icon too) — it's just the flat ground.
- 2026-09-24ak: night lights toned back down. My recent lighting passes (grand shrine washes + per-part pools, lit decorations, ghosts, haunting wisps) had pushed lights with roughly double the strength/size of the old ones, so shrines flooded the village in colour. Shrine wash is back to about its original strength (a little smaller), per-part glows are ~30% smaller/softer, decoration glows smaller, ghosts and wisps a faint shimmer. The bright cores of the lit parts are unchanged.
- 2026-09-24al: BIG BATCH. (1) BUG-HUNT: ran all 20 events with no console errors; bought every kind of merchant item (weapons, unique, decorations, robot villager, supplies) and each landed correctly. (2) RACE DEPTH: old feuds (elf/orc, elf/dwarf, cat/dog, fox/rabbit, demon/elf...) sour villagers living with a rival people (−mood, pointed barks), friendships cheer them (+mood), a village with 4+ peoples gets a cosmopolitan bonus; each people has favourite keepsakes that seed their gift wishes (RACE_WANTS). (3) CITY QUARTERS: each district favours certain of the local peoples (Night Bazaar: foxes/cats/lizards/demons; Cemetery: ghosts/zombies/vampires; Industrial: dwarves/orcs; Campus: elves/cats...), on top of a dominant people per city — crowds stay mixed with plenty of humans (checked in a Cursed Wasteland and a Steaming Jungle city). (4) MERCHANT: sells racial weapons for the peoples in your village (Elven Blade, Dwarven Warhammer, Demon's Lash...); traders sometimes come home with food/wood/stone too. (5) THREE MORE EVENTS: Plague (strikes one people), a Beast at the treeline (send hunters — odds by how many you have — post watchfires, or ignore), a Stranger at the fire (any people; welcome, toll or send away). (6) GRAND SHRINE PERKS: every design gives a small daily bonus (research, favor, food, wood, stone, cash or a calming/eerie mood) — dark ones give more favor but unsettle the village; shown in the picker and when it rises.
- 2026-09-24am: fixed a real bug found in the bug-hunt: a trader away on a trip got a duplicate/reset actor if you left for a raid and came back (or reloaded) while they were away — spawnVillagers() unconditionally recreated every villager's actor. It now skips anyone currently `_away`; updateTraderTrips resolves them correctly next tick (still off-map, or walks back in). Verified: sent a trader away, ran a full city raid and returned — no actor existed for him while away, and he still walked back in with his profits once due. Guards/patrols/hostile enemies already A*-route (untouched by the earlier villager fix, and not affected). Re-examined the reported "white line on the cult hall window": the Cult Hall wasn't yet a completed/valid room, so it was rendering as a PLAIN overlay window (the path fixed on 2026-09-22) rather than the pre-existing stained-glass rose window a finished church gets — that earlier fix already covers the reported case.
- 2026-09-24an: MAJOR CLEANUP — found and removed a huge dead-code duplicate. The file had a spurious `</script></body></html>` sitting mid-file (after the debug-tooling tail that ends `window.__G = () => ({...})`), followed by a ~4430-line, byte-for-byte-shifted duplicate of that same tail region (debugSpawnNPC/Weapon/Object/Material, buildEndgameDebug, the whole window.__G debug API, and a stray duplicate of buildGroundSprite) plus a second spurious closing sequence at the true end of the file. Because the FIRST `</script>` genuinely closes the script tag (confirmed via document.scripts textContent length, matching before/after), everything past it was 100% dead — never parsed as JavaScript, never executed, just ~440KB of inert trailing text. Removed it entirely and closed the script cleanly once. Verified: script textContent length identical before/after (2,318,909 chars — zero behavioural change), no console errors, chat/races/events/shrine picker all still work. File dropped from 33366 to 28936 lines (2.81MB to 2.38MB). Root cause not fully pinned down (some earlier patch script in this long session must have appended instead of inserted) but the file is clean now.
- 2026-09-24ao: the RIVAL CULT that raids the village at night now has a visual identity: 70% of its cultists are demons, zombies, vampires, ghosts or orcs (CULT_RACES) rather than a random local villager-type, so a night raid reads as a real opposing faction rather than reskinned thugs; the remaining 30% stay a local recruit. Verified 8 spawned cultists in-browser (mix of vampire/zombie/ghost/orc, one local lizard).
- 2026-09-24ap: VILLAGE AT SCALE: tested a real 42-villager, all-14-races crowd for the first time. Found and fixed a genuine bug: every villager's idle chatter fired on the same schedule regardless of population, so a big village turned into a wall of 15+ overlapping speech bubbles at once, unreadable. Bark cadence now scales with population (a 40-villager village waits ~4x as long per villager as a 10-villager one, keeping the village's total chatter rate roughly constant) and a hard cap skips a bark entirely if 6+ text bubbles are already on screen. Verified: forced all 42 to bark at once — now caps at a handful of legible lines instead of a solid wall of text. No other scale issues found (crowd rendering, race variety, and z-ordering all held up).
- 2026-09-24aq: RACE-FLAVOURED HOUSES: a house's roof now tints toward the colour of whichever people mostly lives there (checked by whose bed is in the room) — subtle for a mixed household, a clear, real colour shift when one people dominates (e.g. a vampire home reads noticeably darker/cooler than the default warm wood, a dwarf home warmer/earthier). All 14 peoples have their own tint. Verified in-browser: built a test house, populated it with dwarf then vampire villagers, watched the roof colour shift each time (confirmed against the exact blended RGB).
- 2026-09-24ar: the RIVAL WARBAND that raids the village at night now has its own visual identity too: 70% of its raiders are orcs, dwarves, lizardfolk or foxes (WARBAND_RACES) — a hardened, martial mix deliberately different from the rival cult's demons/undead — rather than reskinned generic thugs. Verified 8 spawned raiders in-browser (mix of dwarf/fox/orc/human).
- 2026-09-24as: THREE SEASONAL/BIOME EVENTS, each only rollable in matching biomes: Blizzard (Snowfields/Cool Highlands/Crystal Caverns — cold overlay + drifting snow, small food loss, frostkin love it), Sandstorm (Endless Desert/Dry Plains/Ashlands — dust haze + grit particles, research loss, lizardfolk unbothered), Monsoon (Steaming Jungle/Lush Wetlands/Bamboo Vale/Haunted Marsh — green rain overlay + heavy rain particles, food gain, everyone grumbles). Each has its own idle barks (race-aware where relevant). Verified all 3 fire with no errors; watched the blizzard's snow drift in-browser.
- 2026-09-24at: (1) SHRINE SYNERGY: a Grand Shrine now "settles in" — its own daily gift (from SHRINE_PERK) grows by 2%/day up to +60% over about a month (villager devotion angle), shown in the picker's footer text. Verified: a fresh Bone Throne gave its base favor bonus; backdated 40 days, the same shrine's bonus scaled up as expected. (2) THE CODEX: the Legacy screen (title screen → Legacy, or end-of-campaign) now tracks two more collections, persisted in localStorage across every village and New Game+ cycle like Legacy points: "Grand Shrines raised X/30" (marked the moment you actually build that design — name + its perk once known, ❔??? before) and "Peoples encountered X/14" (marked the first time any actor of that race is ever rolled, in a village OR a city — name + their talent once known). Verified end-to-end in-browser: seeded a few of each, opened Legacy from the title screen, saw the right ones revealed and the rest hidden, with correct counts.
- 2026-09-24au: REAL-PLAY BUG-FIX BATCH from a user bug list. (1) CAR ORIENTATION: entering a parked car snapped it to face the player's own direction; it now only sets the car's facing if it never had one, so its parked orientation holds through entry. (2) MOUSE WHEEL now cycles the 1-5 weapon slots (equipQuick) in both the city and the village, same as number keys — help text and settings hint updated. (3) MUTATION VISUALS: a villager's boss-DNA mutation (mutated eye/arm/etc) was invisible in the close-up chat/sit-down/dossier scenes because that scene's "cartoon head" coordinate system is fundamentally incompatible with the small-world-sprite math drawMutOverlays expects. Added drawMutInset — reuses the already-working drawMutPortrait small-canvas technique as a labelled "MUTATED" corner inset on the close-up — wired into all three close-up call sites. (4) LAB SKYLIGHT: the Mutation Lab had no night lighting at all (church/library roofs already did); it now gets a green pulsing glow at night matching its daytime "bubbling flask" colour. (5) TRADER JOB: fixed two separate root causes of the "stands by the fire for ages, then jiggles/teleports" complaint — the trip-departure window was too narrow (tod 0.27-0.42 and within 280px of the fire; widened to 0.22-0.5 and 400px) so traders often missed their own departure check for hours, and lineClear (the straight-line pathing fallback used by trader trips/envoy/general villager AI) only checked wall material, not solid PROPS like trees/rocks, so a trader walking "straight" into one would wedge and vibrate; lineClear now also checks solidBoxHit along the line. (6) FIREPLACE LIGHTING (best-effort, root cause not 100% confirmed live): the night-wash block sets globalCompositeOperation to blend modes and only reset it at the very end — if anything in that block ever threw partway through, the leaked composite mode could make later same-frame drawing (including fire) render as a blown-out white/glitchy flash. Wrapped the whole block in try/finally so the mode is always restored even if something inside errors. (7) MERCHANT: frequency cut hard (day-roll chance 0.2 → 0.09, event-table weight 3 → 1 — he was visiting way too often) and 3 new animated decorations added to his rare stock (wind-up robot toy, dino terrarium, levitating orb) with full day art + HOARD_CORE night relight glow, following the same pattern as the prior 18 pieces. Syntax-checked (node chk.js) and smoke-tested on the isolated 127.0.0.1:8777 test server (loads clean, no console errors); the state-dependent fixes (trader trip pacing, lab glow at night, mutation inset, merchant items) need the user's own continued playthrough to confirm live, since reproducing them needs an existing village/mutated villager/night cycle/lab building that a fresh test save doesn't have. STILL OPEN from the same bug list, not yet started: villager armour / first-country difficulty balance, Blacksmith crafted-weapon storage + pre-raid loadout picker UX, bosses being too easy, the police taser stun being too punishing, and boss fights spawning in a random mid-map city instead of the final level.
- 2026-09-24av: the remaining 5 items from the same bug list. (1) VILLAGER ARMOUR: mustered soldiers/guards were dying too fast on early raids to be worth bringing (64hp, no damage mitigation at all) — they now take 30% less damage across the board ("armour", in `damage()`) and their base HP is up from 64/80 (Drill) to 85/105. (2) BLACKSMITH LOADOUTS: crafted/looted weapons only ever sat in the village armory (weapon rack) with no way for the player to actually take one for themselves — the Smithy screen's weapon list now has an "Equip →" button on every armory entry: it pulls that weapon into your belt (grows a new quick slot if you have room, otherwise swaps out your current slot's weapon and racks that instead), so you can pick your kit before a raid without leaving the village. (Didn't build full named/saved loadout presets — that's a bigger feature; flagged as a possible follow-up, not built.) (3) BOSS DIFFICULTY: slime-boss base HP up ~25% (720+tier*150 -> 900+tier*180), attack cooldowns tightened (2.4/1.7/1.1s -> 2.1/1.4/0.9s per phase), and most attack damage up ~20% (contact, slam, roll, strike, ring). (4) FINAL BOSS LOCATION: the actual bug behind "I fought the slime at some random city" — the Capital was explicitly EXCLUDED from ever getting a monster boss fight (slimeRaidFor returned false for node.capital), so the true endgame city was just another human faction boss while random mid-tier cities got the real slime/monster fights. The Capital now always ends in a real boss fight (guaranteed, never the generic faction leader), gets a boss kind that's deliberately different from the plain "Giant Slime" seen everywhere on a first campaign, and is scaled up further (+60% HP, +8% speed, +15% size) with its own "FINAL BOSS" tag in the raid HUD line and bonus bounty/XP. (5) POLICE TASER: an earlier session already tried a 40%-chance-of-a-short-stumble compromise, but a full 1.0s lock could still re-land before the last one wore off (shots every 0.5s), so a cop with a clean shot could still chain-freeze the player indefinitely — reported as "pinned in one spot, ground down". Added a real diminishing-returns lockout: no second full lock can land within 1.6s of the last one, so at worst it's one freeze then only the short stumble, guaranteeing the player's movement back before the next hit. Syntax-checked (node chk.js); the Smithy Equip flow was exercised end-to-end in-browser (pushed test weapons into the armory, opened the Smithy, clicked Equip, confirmed the weapon moved into the player's quick slot and the old one didn't leak) with no console errors. The boss/taser/armour tuning numbers are balance judgment calls made without a full playtest — worth another look once the user has played against them.
- 2026-09-24aw: the car-orientation-on-entry bug (2026-09-24au item 1) wasn't actually fixed — that fix only stopped `enterCar` from overwriting an EXISTING `_facing`, but most street/sidewalk-parked cars (mkProp(...,'car') from populateCityStreets etc.) never had one to begin with: it stayed `undefined`, so the car rendered at drawCarShape's fallback angle (0) while parked and only got a real value — snapping visibly — the first time it was entered. mkProp now gives every 'car' prop a real random cardinal `_facing` (0/90/180/270°) the moment it's created, so there's nothing left to snap to later; the parking-lot rows and named vehicles that already set their own `_facing` right after still override it as before. Verified via mkProp() in-browser: a freshly-created car prop now carries a real numeric _facing immediately, not undefined.
- 2026-09-24ax: WOOD VARIETY. Two new Civic research nodes: Carpentry (50rp: Oak, Birch, Pine, Cedar, Whitewashed, Charred Timber, Driftwood planks as walls AND floors, plus Log Palisade walls) and Joinery (70rp, needs Carpentry: Walnut, Mahogany, Ebony, Redwood planks as walls + floors, plus Parquet and Herringbone Parquet floors) — 25 new build pieces. They're normal codex materials with a fixed grain look (registerWoodSet), so they save and re-register on load; the grain texture now costs wood (was defaulting to stone) with its own HP. Verified in-browser: both researches unlock all 25 pieces, the codex entries persist to the save, no console errors. Also fixed in the same session: cars now get a real _facing at creation (see 2026-09-24aw) and cash now persists across Continue/reload (saveVillage writes village.money, startGame restores it — it was being zeroed every load).
