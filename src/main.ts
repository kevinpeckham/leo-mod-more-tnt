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

// ── The TNT ─────────────────────────────────────────────────────────
// One entry per kind of TNT. To add another: put a line here, add a block and
// a recipe in pack/, a label in tools/make-textures.mjs, and a name in
// resource_pack/texts/en_US.lang. Nothing else needs touching.
//
// About `radius`: it's the number Minecraft calls explosion power, and vanilla
// TNT is 4. It is NOT "how many blocks across" — and doubling it does NOT
// double the hole, because a ball grows with the CUBE of its radius. To make a
// hole N times bigger, multiply 4 by the cube root of N:
//
//   2 TNT worth -> 4 x ∛2 = 5
//   5 TNT worth -> 4 x ∛5 = 7
const TNT_TYPES = [
  { block: "tnt:tnt_2x", name: "2x TNT", radius: 5 },
  { block: "tnt:tnt_5x", name: "5x TNT", radius: 7 },
];

const TNT_BY_BLOCK = new Map(TNT_TYPES.map((tnt) => [tnt.block, tnt]));
const LIGHTER = "minecraft:flint_and_steel";

// 4 seconds, the same fuse as ordinary TNT, so it feels familiar.
const FUSE_TICKS = 80;

// When one of these is caught in someone else's blast it lights rather than
// simply breaking — that's what makes TNT chain. Vanilla gives the caught TNT
// a SHORT RANDOM fuse instead of a fixed one, so a row of them ripples along
// rather than going off as a single lump. Half a second to a second and a bit.
const CHAIN_FUSE_MIN = 10;
const CHAIN_FUSE_MAX = 30;

function lightTheFuse(
  dimension: Dimension,
  location: Vector3,
  tnt: { name: string; radius: number },
  fuseTicks: number,
  litBy?: Player,
) {
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
  litBy?.sendMessage(`§c💥 ${tnt.name} lit — run!`);

  system.runTimeout(() => {
    dimension.createExplosion(centre, tnt.radius, {
      breaksBlocks: true,
      causesFire: false,
    });
  }, fuseTicks);
}

world.afterEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, itemStack, player } = event;
  const tnt = TNT_BY_BLOCK.get(block.typeId);
  if (!tnt) return;
  if (itemStack?.typeId !== LIGHTER) return;

  lightTheFuse(block.dimension, block.location, tnt, FUSE_TICKS, player);
});

// ── Chain reactions ─────────────────────────────────────────────────
// Ordinary TNT caught in an explosion is primed rather than broken, which is
// why a stack of it cascades. Ours is a custom block, so the game just breaks
// it — this puts the cascade back. blockExplode tells us what the block WAS,
// which is the only reason this is possible: by the time we hear about it, the
// block is already gone.
world.afterEvents.blockExplode.subscribe((event) => {
  const tnt = TNT_BY_BLOCK.get(event.explodedBlockPermutation.type.id);
  if (!tnt) return;

  const fuse =
    CHAIN_FUSE_MIN +
    Math.floor(Math.random() * (CHAIN_FUSE_MAX - CHAIN_FUSE_MIN + 1));

  // Full strength, exactly as if it had been lit by hand.
  lightTheFuse(event.dimension, event.block.location, tnt, fuse);
});

// ── Say hello ───────────────────────────────────────────────────────
world.afterEvents.playerSpawn.subscribe((event) => {
  if (!event.initialSpawn) return; // first join only, not after dying

  // 3 seconds (60 ticks) so the screen is ready before we draw on it
  system.runTimeout(() => {
    event.player.onScreenDisplay.setTitle("§cMore TNT!");
    event.player.sendMessage(
      "§eCraft 2 TNT into §c2x TNT§e, or 5 into §c5x TNT§e. Light with flint and steel.",
    );
  }, 60);
});
