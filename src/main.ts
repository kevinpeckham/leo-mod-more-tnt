import {
  type Dimension,
  type Player,
  system,
  type Vector3,
  world,
} from "@minecraft/server";

// ── Leo's More TNT ──────────────────────────────────────────────────
// This mod has its own world (the TNT world on port 19134), so anything here
// can be as explosive as Leo likes without touching his builds next door.

// ── 2x TNT ──────────────────────────────────────────────────────────
// Craft it from two ordinary TNT, anywhere in the crafting grid. It looks like
// TNT with "2x" on the side, and it blows a hole twice the size.
//
// The pieces:
//   pack/blocks/tnt_2x.json     the block itself
//   pack/recipes/tnt_2x.json    the crafting recipe
//   resource_pack/textures/     the "2x" label, made by npm run textures
//   here                        what happens when you light it
const TNT_2X = "tnt:tnt_2x";
const LIGHTER = "minecraft:flint_and_steel";

// Vanilla TNT explodes with a power of 4, and createExplosion takes that same
// number. 8 was wrong: doubling the radius makes roughly EIGHT times the hole,
// because a sphere grows with the cube of its radius. Two TNT side by side make
// about twice the hole, and twice the volume means radius x cube-root-of-2,
// which is 4 x 1.26 ≈ 5.
const BLAST_RADIUS = 5;

// 4 seconds, the same fuse as ordinary TNT, so it feels familiar.
const FUSE_TICKS = 80;

function lightTheFuse(dimension: Dimension, location: Vector3, litBy?: Player) {
  // The middle of the block, not its corner — explosions measure from a point.
  const centre = {
    x: location.x + 0.5,
    y: location.y + 0.5,
    z: location.z + 0.5,
  };

  // Take the block away now and explode in a moment. That's what makes it a
  // fuse rather than an instant bang, and it gives you time to run.
  dimension.getBlock(location)?.setType("minecraft:air");
  dimension.playSound("random.fuse", centre);
  litBy?.sendMessage("§c💥 2x TNT lit — run!");

  system.runTimeout(() => {
    dimension.createExplosion(centre, BLAST_RADIUS, {
      breaksBlocks: true,
      causesFire: false,
    });
  }, FUSE_TICKS);
}

world.afterEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, itemStack, player } = event;
  if (block.typeId !== TNT_2X) return;
  if (itemStack?.typeId !== LIGHTER) return;

  lightTheFuse(block.dimension, block.location, player);
});

// ── Say hello ───────────────────────────────────────────────────────
world.afterEvents.playerSpawn.subscribe((event) => {
  if (!event.initialSpawn) return; // first join only, not after dying

  // 3 seconds (60 ticks) so the screen is ready before we draw on it
  system.runTimeout(() => {
    event.player.onScreenDisplay.setTitle("§cMore TNT!");
    event.player.sendMessage(
      "§eCraft 2 TNT together to make §c2x TNT§e, then light it with flint and steel.",
    );
  }, 60);
});
