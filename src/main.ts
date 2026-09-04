import {
  type BlockPermutation,
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
  { block: "tnt:tnt_10x", name: "10x TNT", radius: 9 },
  { block: "tnt:tnt_20x", name: "20x TNT", radius: 11 },
  { block: "tnt:tnt_50x", name: "50x TNT", radius: 15 },
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
  //
  // We remove this one ourselves, so no explosion reports it — write it down
  // here or undo would put the crater back but not the TNT that made it.
  const lit = dimension.getBlock(location);
  if (lit) remember(dimension, location, lit.permutation);
  lit?.setType("minecraft:air");
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

// ── Undo ────────────────────────────────────────────────────────────
// Every block an explosion destroys gets written down here first, along with
// exactly what it was. Undo walks the list backwards and puts them all back,
// so Leo can flatten somewhere, look at the crater, and have it as it was.
//
// Backwards matters: if the same spot got blown up twice, the OLDEST note is
// what it looked like to begin with, and going in reverse means that one is
// applied last.
//
// Two ways to undo, because one is easier to type and the other is easier to
// reach mid-game:
//   • hold a CLOCK and use it        (turning back time — no typing)
//   • /scriptevent tnt:undo          (needs cheats, which the TNT world has)
type DestroyedBlock = {
  dimensionId: string;
  location: Vector3;
  permutation: BlockPermutation;
};

const UNDO_TOOL = "minecraft:clock";
// A 5x blast is a few hundred blocks, so this is a lot of testing. It stops the
// list growing forever if nobody ever undoes.
const MAX_REMEMBERED = 60000;

let destroyed: DestroyedBlock[] = [];
let warnedFull = false;

function remember(
  dimension: Dimension,
  location: Vector3,
  permutation: BlockPermutation,
) {
  if (destroyed.length >= MAX_REMEMBERED) {
    if (!warnedFull) {
      world.sendMessage("§7(Undo memory is full — undo now to start again.)");
      warnedFull = true;
    }
    return;
  }
  destroyed.push({
    dimensionId: dimension.id,
    location: { x: location.x, y: location.y, z: location.z },
    permutation,
  });
}

function undoEverything(player?: Player) {
  if (destroyed.length === 0) {
    player?.sendMessage("§7Nothing to undo — nothing has exploded yet.");
    return;
  }

  let restored = 0;
  for (let i = destroyed.length - 1; i >= 0; i--) {
    const note = destroyed[i];
    // The chunk may not be loaded any more; skip rather than fail the lot.
    try {
      const block = world
        .getDimension(note.dimensionId)
        .getBlock(note.location);
      if (!block) continue;
      block.setPermutation(note.permutation);
      restored++;
    } catch {
      // Out of the world, or unloaded. Nothing sensible to do about it.
    }
  }

  destroyed = [];
  warnedFull = false;
  const message = `§a↩ Put back ${restored} blocks.`;
  if (player) player.sendMessage(message);
  else world.sendMessage(message);
}

// Hold a clock and use it.
world.afterEvents.itemUse.subscribe((event) => {
  if (event.itemStack?.typeId !== UNDO_TOOL) return;
  undoEverything(event.source);
});

// Or type /scriptevent tnt:undo
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "tnt:undo") return;
  const player =
    event.sourceEntity instanceof Object && "sendMessage" in event.sourceEntity
      ? (event.sourceEntity as Player)
      : undefined;
  undoEverything(player);
});

// ── Chain reactions ─────────────────────────────────────────────────
// Ordinary TNT caught in an explosion is primed rather than broken, which is
// why a stack of it cascades. Ours is a custom block, so the game just breaks
// it — this puts the cascade back. blockExplode tells us what the block WAS,
// which is the only reason this is possible: by the time we hear about it, the
// block is already gone.
world.afterEvents.blockExplode.subscribe((event) => {
  // Write down every block any explosion destroys, ours or vanilla's, so undo
  // can put the whole crater back.
  remember(
    event.dimension,
    event.block.location,
    event.explodedBlockPermutation,
  );

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
