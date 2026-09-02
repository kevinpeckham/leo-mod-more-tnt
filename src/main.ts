import { system, world } from "@minecraft/server";

// ── Leo's More TNT ────────────────────────────────────────────────────
// This is a starting point, not a finished mod. Two small features are here so
// you can see it working straight away — change them, delete them, or build
// something completely different on top.
//
// Mod 01 runs in the same world, so both mods react at once. That's fine: this
// one has its own UUID, its own scripts and its own pack, and nothing here can
// break the party animals.

// ── Feature 1: say hello when you join ──────────────────────────────
world.afterEvents.playerSpawn.subscribe((event) => {
  if (!event.initialSpawn) return; // first join only, not after dying

  // 3 seconds (60 ticks) so the screen is ready before we draw on it
  system.runTimeout(() => {
    event.player.onScreenDisplay.setTitle("§dLeo's More TNT!");
    event.player.sendMessage("§dMod 02 is loaded. Place a block to test it.");
  }, 60);
});

// ── Feature 2: a placeholder to replace with Leo's real idea ────────
// Every block you PLACE has a small chance of a sparkle and a ping. Mod 01 uses
// broken blocks, so this uses placed ones — that way it's obvious which mod did
// what while you're testing.
const SPARKLE_CHANCE = 0.25; // a quarter of the blocks you place

world.afterEvents.playerPlaceBlock.subscribe((event) => {
  if (Math.random() >= SPARKLE_CHANCE) return;

  const { player, block } = event;
  const spot = {
    x: block.location.x + 0.5,
    y: block.location.y + 1,
    z: block.location.z + 0.5,
  };

  // A particle and a sound. Both are vanilla names — swap them for others and
  // re-deploy to see what they do.
  block.dimension.spawnParticle("minecraft:villager_happy", spot);
  player.playSound("random.orb");
});
