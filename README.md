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

A starting point, not a finished mod:

1. A hello message when you join
2. Placing a block sometimes makes a sparkle and a ping

Both live in `src/main.ts` and are meant to be replaced with Leo's real idea.
Mod 01 reacts to blocks you *break*, so this one reacts to blocks you *place* —
that way it's obvious which mod did what while you're testing.

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
