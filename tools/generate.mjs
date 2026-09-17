#!/usr/bin/env node
// Roads of Rogue — roster generator.
// Asks a locally hosted LLM (Ollama) to author enemy characters + weapons as slot-based
// specs, validates them with the SAME validator the game uses (extracted from index.html),
// and writes roster.json + roster.js (which the game loads via <script>).
//
//   node tools/generate.mjs --theme "circus freakshow" --enemies 5 --weapons 3
//   node tools/generate.mjs                 (prompts for a theme)
//   node tools/generate.mjs --dry           (validate-only, writes nothing)
//   node tools/generate.mjs --replace       (discard previously generated specs first)
//
// Env:  ROR_MODEL (default qwen3:14b),  ROR_OLLAMA (default http://127.0.0.1:11434)

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const INDEX = path.join(ROOT, 'index.html');
const ROSTER_JSON = path.join(ROOT, 'roster.json');
const ROSTER_JS = path.join(ROOT, 'roster.js');

const OLLAMA = process.env.ROR_OLLAMA || 'http://127.0.0.1:11434';
const MODEL = process.env.ROR_MODEL || 'qwen3:14b';

// ---------- args ----------
const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf('--' + name);
  if (i === -1) return def;
  const v = args[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
const opts = {
  theme: flag('theme', null),
  enemies: parseInt(flag('enemies', 5)) || 5,
  weapons: parseInt(flag('weapons', 3)) || 3,
  places: flag('places', '2') === true ? 2 : parseInt(flag('places', 2)),
  temp: parseFloat(flag('temp', 0.85)) || 0.85,
  model: flag('model', MODEL),
  replace: !!flag('replace', false),
  dry: !!flag('dry', false),
};
if (isNaN(opts.places)) opts.places = 2;

// ---------- extract the shared validator from index.html ----------
function loadValidator() {
  const html = fs.readFileSync(INDEX, 'utf8');
  const m = html.match(/\/\/ ===ROSTER-SCHEMA START===([\s\S]*?)\/\/ ===ROSTER-SCHEMA END===/);
  if (!m) throw new Error('could not find ROSTER-SCHEMA sentinel block in index.html');
  // the block references clamp(); provide it. Math.round already global.
  const src = 'const clamp=(v,a,b)=>v<a?a:v>b?b:v;\n' + m[1];
  const mod = { exports: {} };
  new Function('module', src)(mod);
  return mod.exports;
}
function loadDefaultRoster() {
  const html = fs.readFileSync(INDEX, 'utf8');
  const m = html.match(/const DEFAULT_ROSTER = (\{[\s\S]*?\n\});/);
  if (!m) return { enemies: [], weapons: [], places: [] };
  return new Function('return ' + m[1])();
}

const V = loadValidator();
const RS = V.RS;
const ITEM_SLOT = V.ITEM_SLOT;

// ---------- prompt ----------
function itemsBySlot() {
  const bySlot = {};
  for (const [item, slot] of Object.entries(ITEM_SLOT)) (bySlot[slot] ||= []).push(item);
  return Object.entries(bySlot).map(([s, items]) => `    ${s}: ${items.join(', ')}`).join('\n');
}

function systemPrompt(theme) {
  const def = loadDefaultRoster();
  return `You design enemies and weapons for "Roads of Rogue", a top-down pixel-art beat-'em-up set in a dark night city (Streets of Rogue style). Characters are drawn as small chunky ~26px figures, so silhouette and 2-3 bold accessories matter more than detail.

You do NOT write code or draw. You fill in a small JSON spec that only picks from fixed menus. The engine renders it.

THEME for this batch: ${theme}

=== ENEMY SPEC ===
{
  "id":       kebab-case unique slug,
  "name":     short display name (<=3 words),
  "behavior": one of ${RS.behaviors.join(' | ')}
              rusher = chases and swings; bruiser = slow, tanky, heavy hits; shooter = keeps distance and fires,
  "palette":  one of ${RS.palettes.join(' | ')}  (a cohesive colour set; accessories reference its accent colours a/b/c),
  "sizeTier": ${RS.sizes.join(' | ')}   (s small, m medium, l large),
  "hpTier":   ${RS.hpTiers.join(' | ')},
  "parts":    array of up to 5 accessories, ONE per body slot, each { "slot", "item", "size": s|m|l, "color": one of ${RS.colorRefs.join('|')} }.
              Available items per slot:
${itemsBySlot()}
  "onHit":    particle burst when struck — one of ${RS.onHit.join(' | ')},
  "aura":     ${RS.auras.join(' | ')}   (fire = flickering flames, glow = coloured light),
  "weapon":   the "id" of one of the weapons you return below. Match a melee weapon to rusher/bruiser
              and a gun to shooter. Use "fists" only for a deliberately unarmed brawler.
}

=== WEAPON SPEC ===
{
  "id":   kebab-case unique slug,
  "name": short display name,
  "kind": "melee" | "gun",
  "head": for melee one of ${RS.meleeHeads.join(' | ')};  for gun one of ${RS.gunHeads.join(' | ')},
  "tier": 1 | 2 | 3   (higher = stronger),
  "color": one of ${RS.colorRefs.join('|')},
  "fx":   "none" | "fire" | "water" | "sparks"
}

=== PLACE SPEC ===  (a building interior the player can walk into)
{
  "id":   kebab-case unique slug,
  "name": short sign name (e.g. "Rico's Diner", "The Snake Pit"),
  "kind": one of ${RS.placeKinds.join(' | ')},
  "floor": one of ${RS.floors.join(' | ')}   (checker suits a diner, stained a warehouse),
  "wall":  one of ${RS.walls.join(' | ')},
  "layout": ${RS.layouts.join(' | ')}   (open = one room; split = two rooms; backroom = a small side room),
  "fixtures": array of up to 8 { "item", "along": wall|center|corner, "count": 1-6 }.
             items: ${RS.furniture.join(', ')},
  "occupants": up to 4 — each is either "civ" OR the "id" of one of the enemies you return above.
               Roster-enemy occupants only actually turn hostile when "kind" is hideout / warehouse
               / gym / office; anywhere else they are treated as civilians. So for an enemy den
               (a gang hideout, a mob warehouse) use kind "hideout" or "warehouse" and list your
               enemy ids as occupants.
  "loot": up to 3 — "cash", "health", or a weapon id you return above / a basic weapon
          (bat|pipe|knife|pistol|smg|shotgun).
}

RULES
- Make each enemy instantly readable as its concept from its accessories alone (a firefighter = hardhat + tank; a jester = wig + cone + ruff).
- Vary behaviour, palette, size and hpTier across the batch — do not make them all rushers.
- Pick "onHit" and "aura" to fit the character, not the default: a clown bursts "confetti", a bird-thing "feathers", something ablaze uses aura "fire", a robot uses "bolts" + aura "glow". Only use "blood"/"none" for ordinary humans.
- Keep it grounded-surreal, matches a gritty city with a dark sense of humour. No text on items.
- At least one place should be an enemy den (kind hideout or warehouse) whose occupants are
  the enemy ids you generated, so the theme has a lair to raid.
- Reference examples (format, not templates): enemies ${JSON.stringify(def.enemies.slice(0, 1))}
  places ${JSON.stringify(def.places.slice(0, 1))}

Return ONLY JSON: { "enemies": [ ...${opts.enemies}... ], "weapons": [ ...${opts.weapons}... ], "places": [ ...${opts.places}... ] }.`;
}

const RESPONSE_SCHEMA = {
  type: 'object',
  required: ['enemies', 'weapons', 'places'],
  properties: {
    places: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'kind'],
        properties: {
          id: { type: 'string' }, name: { type: 'string' },
          kind: { type: 'string', enum: RS.placeKinds },
          floor: { type: 'string', enum: RS.floors },
          wall: { type: 'string', enum: RS.walls },
          layout: { type: 'string', enum: RS.layouts },
          sign: { type: 'string', enum: RS.signs },
          fixtures: {
            type: 'array', maxItems: 8,
            items: {
              type: 'object', required: ['item'],
              properties: {
                item: { type: 'string', enum: RS.furniture },
                along: { type: 'string', enum: RS.aits },
                count: { type: 'integer', minimum: 1, maximum: 6 },
              },
            },
          },
          occupants: { type: 'array', maxItems: 4, items: { type: 'string' } },
          loot: { type: 'array', maxItems: 3, items: { type: 'string' } },
        },
      },
    },
    weapons: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'kind', 'head', 'tier'],
        properties: {
          id: { type: 'string' }, name: { type: 'string' },
          kind: { type: 'string', enum: ['melee', 'gun'] },
          head: { type: 'string', enum: [...RS.meleeHeads, ...RS.gunHeads] },
          tier: { type: 'integer', minimum: 1, maximum: 3 },
          color: { type: 'string', enum: RS.colorRefs },
          fx: { type: 'string', enum: ['none', 'fire', 'water', 'sparks'] },
        },
      },
    },
    enemies: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'behavior', 'palette'],
        properties: {
          id: { type: 'string' }, name: { type: 'string' },
          behavior: { type: 'string', enum: RS.behaviors },
          palette: { type: 'string', enum: RS.palettes },
          sizeTier: { type: 'string', enum: RS.sizes },
          hpTier: { type: 'string', enum: RS.hpTiers },
          onHit: { type: 'string', enum: RS.onHit },
          aura: { type: 'string', enum: RS.auras },
          weapon: { type: 'string' },
          parts: {
            type: 'array', maxItems: 5,
            items: {
              type: 'object', required: ['slot', 'item'],
              properties: {
                slot: { type: 'string', enum: RS.slots },
                item: { type: 'string', enum: RS.items },
                size: { type: 'string', enum: RS.sizes },
                color: { type: 'string', enum: RS.colorRefs },
              },
            },
          },
        },
      },
    },
  },
};

// ---------- ollama ----------
async function chat(messages, { format, temperature = 0.85, timeoutMs = 420_000 } = {}) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(OLLAMA + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.model, messages, stream: false, think: false, format,
        options: { temperature, num_ctx: 8192 }, keep_alive: '20m',
      }),
      signal: ctrl.signal,
    });
  } finally { clearTimeout(to); }
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return j.message.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

// ---------- roster io ----------
function readExistingRoster() {
  if (opts.replace || !fs.existsSync(ROSTER_JSON)) return { version: 1, enemies: [], weapons: [], places: [] };
  try { return JSON.parse(fs.readFileSync(ROSTER_JSON, 'utf8')); }
  catch { return { version: 1, enemies: [], weapons: [], places: [] }; }
}
function writeRoster(r) {
  fs.writeFileSync(ROSTER_JSON, JSON.stringify(r, null, 2) + '\n');
  fs.writeFileSync(ROSTER_JS,
    '// Roads of Rogue — AI-generated roster. Written by tools/generate.mjs. Edit via the generator.\n' +
    'window.ROSTER = ' + JSON.stringify(r, null, 2) + ';\n');
}

// ---------- dry run ----------
function dryRun() {
  const def = loadDefaultRoster();
  const good = V.validateRoster(def);
  console.log(`\nDEFAULT_ROSTER: ${good.enemies.length} enemies, ${good.weapons.length} weapons, ${good.places.length} places`);
  console.log(good.warnings.length ? '  warnings:\n' + good.warnings.map(([n, w]) => `   ${n}: ${w.join('; ')}`).join('\n')
    : '  clean ✓');
  const broken = V.validateRoster({
    enemies: [{ name: 'Broken', behavior: 'ninja', palette: 'chartreuse', hpTier: 'immortal',
      parts: [{ slot: 'head', item: 'helmet' }, { slot: 'hat', item: 'cone' }, { slot: 'nose', item: 'nonsense' }],
      weapon: 'lightsaber' }],
    weapons: [],
  });
  console.log('\nDeliberately broken spec repaired to:');
  console.log('  ' + JSON.stringify(broken.enemies[0]));
  console.log('  warnings: ' + broken.warnings[0][1].join('; '));
  console.log('\nNothing written (--dry).\n');
}

// ---------- main ----------
async function promptTheme() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const a = await new Promise(r => rl.question('Theme for this batch (e.g. "circus freakshow", "riot cops", "cyber gang"): ', r));
  rl.close();
  return a.trim();
}

async function main() {
  if (opts.dry) return dryRun();
  const theme = (typeof opts.theme === 'string' && opts.theme) || await promptTheme();
  if (!theme) { console.error('No theme given.'); process.exit(1); }

  console.log(`\nModel: ${opts.model}   Theme: "${theme}"   (${opts.enemies} enemies, ${opts.weapons} weapons, ${opts.places} places)`);
  console.log('Asking Ollama…');

  let raw;
  try {
    raw = await chat(
      [{ role: 'system', content: systemPrompt(theme) },
       { role: 'user', content: `Design ${opts.enemies} enemies, ${opts.weapons} weapons and ${opts.places} places for: ${theme}` }],
      { format: RESPONSE_SCHEMA, temperature: opts.temp },
    );
  } catch (e) {
    console.error('\nOllama call failed: ' + e.message);
    console.error('Is Ollama running?  ' + OLLAMA + '   Model pulled?  ollama pull ' + opts.model);
    process.exit(1);
  }

  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { console.error('\nModel did not return valid JSON:\n' + raw.slice(0, 800)); process.exit(1); }

  const clean = V.validateRoster(parsed);

  // wire enemies to the batch's weapons — the model often leaves weapon:"fists" or a dangling id
  const meleeW = clean.weapons.filter(w => w.kind === 'melee').map(w => w.id);
  const gunW = clean.weapons.filter(w => w.kind === 'gun').map(w => w.id);
  const batchIds = new Set(clean.weapons.map(w => w.id));
  let mi = 0, gi2 = 0;
  for (const e of clean.enemies) {
    const wantsGun = e.behavior === 'shooter';
    const pool = wantsGun ? gunW : meleeW, alt = wantsGun ? meleeW : gunW;
    const dangling = e.weapon !== 'fists' && !batchIds.has(e.weapon);
    if (dangling || (e.weapon === 'fists' && (wantsGun || Math.random() < 0.7))) {
      if (pool.length) e.weapon = pool[wantsGun ? gi2++ % pool.length : mi++ % pool.length];
      else if (alt.length) e.weapon = alt[0];
      else if (dangling) e.weapon = 'fists';
    }
  }

  // guarantee at least one populated den for the theme
  const HOSTILE = new Set(['hideout', 'warehouse', 'gym', 'office']);
  const enemyIds = clean.enemies.map(e => e.id);
  let hasDen = clean.places.some(p => HOSTILE.has(p.kind) && p.occupants.some(o => o !== 'civ'));
  if (!hasDen && enemyIds.length) {
    const den = clean.places.find(p => HOSTILE.has(p.kind)) || clean.places[0];
    if (den) { den.kind = 'hideout'; den.occupants = enemyIds.slice(0, 3); }
    else clean.places.push({ id: 'den', name: 'The Hideout', biome: 'city', kind: 'hideout',
      floor: 'stained', wall: 'block', layout: 'open',
      fixtures: [{ item: 'crate', along: 'corner', count: 4 }, { item: 'couch', along: 'wall', count: 1 }],
      occupants: enemyIds.slice(0, 3), loot: ['cash'], sign: 'painted' });
  }

  const existing = readExistingRoster();
  const mergeById = (base, extra) => {
    const ids = new Set((base || []).map(x => x.id));
    return (base || []).concat(extra.filter(x => !ids.has(x.id)));
  };
  const merged = {
    version: 1,
    weapons: mergeById(existing.weapons, clean.weapons),
    enemies: mergeById(existing.enemies, clean.enemies),
    places: mergeById(existing.places, clean.places),
  };
  writeRoster(merged);

  console.log(`\n  ${clean.enemies.length} enemies, ${clean.weapons.length} weapons, ${clean.places.length} places generated`);
  for (const e of clean.enemies) {
    const w = (clean.warnings.find(x => x[0] === e.name) || [])[1];
    console.log(`   ${e.name.padEnd(20)} ${e.behavior.padEnd(8)} ${e.hpTier.padEnd(7)} ${e.parts.map(p => p.item).join(',')}${w ? '   [fixed: ' + w.join('; ') + ']' : ''}`);
  }
  for (const wp of clean.weapons) console.log(`   ${wp.name.padEnd(20)} ${wp.kind} ${wp.head} t${wp.tier}`);
  for (const p of clean.places) console.log(`   ${p.name.padEnd(20)} ${p.kind.padEnd(10)} occ:[${p.occupants.join(',')}]`);
  console.log(`\nWrote roster.js (${merged.enemies.length} enemies, ${merged.weapons.length} weapons, ${merged.places.length} places total).`);
  console.log('Reload the game and press \\ to see them.\n');
}

main().catch(e => { console.error(e); process.exit(1); });
