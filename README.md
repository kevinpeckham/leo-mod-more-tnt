# Leo's More TNT 💥

Leo's second Minecraft Bedrock add-on. Built the same way as [leo-mod-01](../leo-mod-01), but it gets **its own world
on its own server**, so experiments here can't disturb Leo's builds next door.

| | Leo's World | TNT World (this mod) | Health World |
|---|---|---|---|
| Address | `…:19132` | `…:19134` | `…:19136` |
| Mod | Leo's Mod 01 | Leo's More TNT | [health doubler](../leo-mod-health-doubler) |
| Mode | Creative | Creative | Survival |
| Service | `bedrock-server` | `bedrock-tnt` | `bedrock-health` |
| Console | `tmux attach -t bds` | `tmux -L tnt attach -t tnt` | `tmux -L health attach -t health` |
| Files | `/opt/bedrock-server` | `/opt/bedrock-tnt` | `/opt/bedrock-health` |

All on `100.68.103.100`.

Add the second one on the iPads as a new server entry — same address, port
**19134**.


**Hit something strange?** [FINDINGS.md](../leo-mod-01/FINDINGS.md) collects the gotchas we've
already solved across all of Leo's mods — connection failures, invisible
mobs, recipes that silently do nothing, and the rest.

## What's here right now

Two kinds of bigger TNT, and they chain.

| | Craft it from | Label | Blast |
|---|---|---|---|
| **2x TNT** | 2 TNT | `2x` | about two TNT's worth |
| **5x TNT** | 5 TNT | `5x` | about five TNT's worth |
| **10x** | 10 TNT, or 2× 5x | `10x` | radius 9 |
| **20x** | 20 TNT, or 2× 10x | `20x` | radius 11 |
| **50x** | 50 TNT, or 5× 10x | `50x` | radius 15 |
| **100x** | 2× 50x, or 5× 20x | `100x` | 5 blasts in a small ring |
| **1000x** | 10× 100x, or 20× 50x | `1000` | 20 blasts, two rings |
| **10000x** | 10× 1000x | `10K` | 48 blasts, rings above and below |

Every tier can be built from the ones below it, and each shortcut is the same
amount of TNT by another road. 100x and 1000x have no plain-TNT recipe, because
a stack only holds 64.

### Why the big ones are rings rather than one huge blast

An explosion fires rays that lose energy passing through each block, so a very
large one spends most of its power on rock it has already broken. Measured in
solid stone:

| | Blocks destroyed |
|---|---|
| 100x — one blast, radius 19 | 394 |
| 1000x — twenty blasts of radius 15, in rings | 4,525 |

Ten times the TNT, eleven times the hole — where making a single blast bigger
would have given far less. The blasts go off two ticks apart so it rolls
outwards rather than landing in one tick, which also spreads the work.

`rings` is a property any TNT kind can have; the small ones simply have one
blast at the centre. A ring can also carry a `dy`, which lifts or drops the
whole ring — that's how 10000x grows, since it can't grow outwards.

### The 64-block ceiling

`tick-distance` on the server is 4 chunks, so the game only simulates about
**64 blocks** around a player. An explosion outside that does nothing at all —
it doesn't even fail loudly, it simply doesn't happen.

That is the real limit on how big any of this can get, and it's why 10000x adds
blasts *above and below* rather than further out. Blasts that do land outside
are skipped quietly and the player is told once, rather than the log filling
with one error per missed blast (which it did, 146 times, before that was
handled).

To go wider, the lever is `tick-distance` in `server.properties` — at the cost
of the server simulating more all the time.

Anywhere in the crafting grid — the recipes are shapeless, so the pattern
doesn't matter. Light with flint and steel; same 4-second fuse as ordinary TNT.

**The detonator.** An item for setting off charges from a safe distance.

1. **Point at a TNT** and use the detonator — it says `✔ ARMED` on screen and
   makes a sound. Arm as many as you like.
2. **Back away.**
3. **Crouch and use it** to fire the lot, one second later.

On a touchscreen the reliable way is: tap the TNT to face it, back up, then
hold down on the screen with the detonator in hand.

Aiming is forgiving — landing within two blocks of a charge takes the charge.
Pointing at the same charge again a second later disarms it. Craft it from a
lever, redstone and an iron ingot.

Two Bedrock quirks are worth knowing, because they cost us several rounds of
"it doesn't work": using an item while aiming at a block **within arm's reach**
counts as touching that block, and an item with no use of its own produces no
event at all — so you must stand back. And holding the button repeats the use
several times a second, which is why arming a charge twice in quick succession
deliberately does *not* disarm it.

**Undo.** Every block an explosion destroys is written down, so you can flatten
somewhere, look at the crater, and put it back — **one explosion at a time**,
most recent first, like undo in any other program. Press again to go back
further.

- **hold a clock and use it** — undoes the last explosion
- **crouch and use the clock** — puts *everything* back at once
- or type **`/scriptevent tnt:undo`** for one, **`/scriptevent tnt:undoall`**
  for the lot

Blocks are grouped into explosions by when they were destroyed: anything within
three seconds of the last one counts as the same bang, which keeps a chain
reaction or a twenty-blast ring together as a single undo step.

About ten of the very largest blasts are remembered. When it fills, the oldest
explosions are forgotten first, so the recent ones stay undoable.

It restores everything since the last undo, including the TNT block you lit, and
it covers ordinary TNT blasts too.

**If it says some blocks were too far away**, that's the 64-block ceiling again:
the game won't touch a chunk it isn't ticking. Those blocks are kept rather than
thrown away — walk over there and undo again and they go back.

What undo can't put back:

- **Blocks that fell over as a side effect** — a torch dropping because its wall
  went, sand collapsing into the hole. The game never reports those as part of
  the explosion, so the mod never sees them.
- **Items and mobs.** Blocks only.
- **Anything from before a restart or a deploy**, since the list lives in memory.
  The mod says so in chat when it loads.

Blocks you placed after the blast get overwritten if they're in the crater —
it's an undo, not a merge.

**They chain.** Caught in someone else's blast, they light rather than simply
breaking — at full strength, on a short random fuse, exactly as vanilla TNT
behaves. Rows of them ripple. Mixed chains work too: vanilla TNT sets off
Leo's, and Leo's sets off vanilla.

It takes four files working together, which is worth knowing before adding the
next one:

| File | Its job |
|---|---|
| `pack/blocks/tnt_2x.json` | the block exists, and what it's made of |
| `pack/recipes/tnt_2x.json` | 2 TNT makes one |
| `resource_pack/textures/` + `terrain_texture.json` | what it looks like |
| `src/main.ts` | what happens when you light it, and the chaining |

Plus a name in `resource_pack/texts/en_US.lang`, or the game shows a raw key.

### Adding another one

The kinds of TNT are a table at the top of `src/main.ts`:

```ts
const TNT_TYPES = [
  { block: "tnt:tnt_2x", name: "2x TNT", radius: 5 },
  { block: "tnt:tnt_5x", name: "5x TNT", radius: 7 },
];
```

A 10x needs: a line there, a label in `LABELS` in `tools/make-textures.mjs`,
a block and a recipe copied in `pack/`, and a name in the `.lang` file. No new
logic.

**Picking the radius.** It's the number Minecraft calls explosion *power*, and
vanilla TNT is 4. It is **not** how many blocks across, and doubling it does
**not** double the hole — a ball grows with the **cube** of its radius, so 8 is
about eight times the hole, not two. For a hole N times bigger:

> radius = 4 × ∛N   →   2x is 5, 5x is 7, 10x would be about 9

**Changing a label.** The `LABELS` list holds little pictures made of `#` and
`.` — a hash is ink, a dot is the label showing through. Five rows tall, because
four can't make a legible 5. Edit and run `npm run textures`.

## Commands

```sh
npm install                  # once, after cloning
npm run build                # typecheck + bundle
npm run package              # ...and make dist/leo-mod-more-tnt.mcaddon for AirDrop
./tools/deploy-server.sh     # deploy to the server and hot-reload it
```

Deploying is the fast loop: edit `src/main.ts`, run the deploy script, and the
change is live in seconds without anyone leaving the world.

## How it sits alongside mod 01

The world's pack list holds both mods. Each has its own UUID, its own scripts
and its own folder on the server, so they can't tread on each other — and the
deploy scripts leave each other's entries alone. You'll see both in the server
log at startup:

```
Pack Stack - [00] Leo's Mod 01 v1.1.15
Pack Stack - [01] Leo's More TNT v1.0.0
```

Both scripts run at the same time. If both react to the same event, both fire —
that's expected, not a bug.

## Gotchas we hit building 2x TNT

Each of these cost us a round of "it doesn't work", and each was written down
somewhere we could have read first.

**Check the content log first.** It's the game telling you exactly what it
rejected, and it's far quicker than guessing:

```sh
ls -t /opt/bedrock-tnt/ContentLog* | head -1     # newest first
```

A log only appears when there's something to report — no new file after a
restart means a clean load. It's what finally explained the recipe:
`1.20+ Recipes require unlock data`.

**Blocks and recipes use different format versions.** Blocks should match the
game (Mojang's block docs use `1.26.40`); recipes are an older, stable schema
and every documented example uses `1.12`. Putting the block's version on the
recipe breaks the recipe, because 1.20+ recipes need recipe-book unlock data
we don't have.

**A block needs `minecraft:geometry`.** Without it the block still registers
but the game has nothing to draw, so it appears as the unknown block — a dirt
block with a question mark. `"minecraft:geometry": "minecraft:geometry.full_block"`
is the built-in cube.

**Shapeless ingredients use a count.** Two TNT is one entry with `"count": 2`,
not the same entry twice.

**Bump the version for texture changes.** Same rule as mod 01 — the deploy
script enforces it.

## Adding custom mobs or textures

`resource_pack/` is here and wired up, but empty apart from a manifest. When
Leo wants a mob that looks like something new, mod 01 has a full worked example
of every piece — entity files, loot tables, textures, render controllers — plus
a recipe in its README, and a `tools/make-diamond-textures.mjs` that recolours
Mojang's own art. Copy from there.

Name custom things `tnt:` rather than `leo:` — mod 01 owns the `leo:`
namespace next door, and separate namespaces mean the two can never collide
even if the mods ever share a world again.

**One rule worth learning early:** whenever the resource pack changes, bump the
version (`npm version patch`) before deploying. Minecraft caches resource packs
by uuid *and* version, so without a bump the iPads keep the copy they already
have — and new mobs turn up invisible. The deploy script refuses to let this
happen, but it's better to know why.
