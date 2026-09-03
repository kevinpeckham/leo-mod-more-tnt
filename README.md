# Leo's More TNT 💥

Leo's second Minecraft Bedrock add-on. Built the same way as [leo-mod-01](../leo-mod-01), but it gets **its own world
on its own server**, so experiments here can't disturb Leo's builds next door.

| | Leo's World | TNT World |
|---|---|---|
| Address | `100.68.103.100:19132` | `100.68.103.100:19134` |
| Mod | Leo's Mod 01 | Leo's More TNT |
| Service | `bedrock-server` | `bedrock-tnt` |
| Console | `tmux attach -t bds` | `tmux -L tnt attach -t tnt` |
| Files | `/opt/bedrock-server` | `/opt/bedrock-tnt` |

Add the second one on the iPads as a new server entry — same address, port
**19134**.

## What's here right now

**2x TNT** — Leo's first idea for this mod.

- **How to get it:** put **2 TNT** in a crafting table, anywhere in the grid
- **How it looks:** like TNT, but the label on the side says **2x** instead
- **What it does:** light it with flint and steel and it blows a hole about
  twice the size of ordinary TNT, on the same 4-second fuse

It takes four files working together, which is worth knowing before adding the
next one:

| File | Its job |
|---|---|
| `pack/blocks/tnt_2x.json` | the block exists, and what it's made of |
| `pack/recipes/tnt_2x.json` | 2 TNT makes one |
| `resource_pack/textures/` + `terrain_texture.json` | what it looks like |
| `src/main.ts` | what happens when you light it |

Plus a name in `resource_pack/texts/en_US.lang`, or the game shows a raw key.

### Changing it

- **Bigger or smaller bang:** `BLAST_RADIUS` in `src/main.ts`. Careful — it's a
  radius, and a ball grows with the *cube* of its radius, so 8 isn't twice as
  big as 4, it's about eight times. Vanilla TNT is 4; ours is 5, which is about
  double the hole.
- **Different label:** the `GLYPHS` block at the top of `tools/make-textures.mjs`
  is a little picture made of `#` and `.`. Change it and run `npm run textures`.

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
