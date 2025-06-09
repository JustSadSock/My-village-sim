// ai/farmer.js — универсальный NPC: пьёт, ест, собирает урожай или рубит лес

const TILE_GRASS  = 0;   // ← БЫЛО НЕОБХОДИМО
const TILE_WATER  = 1;
const TILE_FOREST = 2;
const TILE_FIELD  = 3;

export function init() { /* пусто */ }

export function update(id, dt, world) {
  const {
    posX, posY, age, hunger, thirst,
    MAP_W, MAP_H, tiles,
    stockFood, stockWood,
    agentCount
  } = world;

  /* 1. Питьё ------------------------------------------------------------- */
  if (thirst[id] < 30) {
    const here = posY[id] * MAP_W + posX[id];
    if (tiles[here] === TILE_WATER) {            // стоим на воде
      thirst[id] = 100;
      return;
    }
    let best = Infinity, tx = posX[id], ty = posY[id];
    for (let i = 0; i < tiles.length; i++) if (tiles[i] === TILE_WATER) {
      const x = i % MAP_W, y = (i / MAP_W) | 0,
            dx = x - posX[id], dy = y - posY[id],
            d  = dx*dx + dy*dy;
      if (d < best) { best = d; tx = x; ty = y; }
    }
    moveStep(id, tx, ty);                        // шаг к воде
    return;
  }

  /* 2. Еда ---------------------------------------------------------------- */
  if (hunger[id] < 30 && world.stockFood > 0) {
    world.stockFood--;          // тратим еду
    hunger[id] = 100;
    return;
  }

  /* 3. «Рынок» и выбор работы ------------------------------------------- */
  const baseFood = 1, baseWood = 0.5;
  const priceFood = Math.min(
    Math.max(baseFood * agentCount / Math.max(world.stockFood, 1), 0.5), 8
  );
  const priceWood = Math.min(
    Math.max(baseWood * agentCount / Math.max(world.stockWood, 1), 0.3), 6
  );
  const skill = Math.max(0.2, Math.min(1, age[id] / 50));

  const profitHarvest = priceFood * skill;
  const profitChop    = priceWood * skill;

  const harvestMode = profitHarvest >= profitChop;
  const targetType  = harvestMode ? TILE_FIELD : TILE_FOREST;

  /* 4. Работа, если стоим на нужном тайле -------------------------------- */
  const idx = posY[id] * MAP_W + posX[id];
  if (tiles[idx] === targetType) {
    tiles[idx] = TILE_GRASS;               // собираем → травяной тайл
    harvestMode ? world.stockFood++ : world.stockWood++;
    return;
  }

  /* 5. Поиск ближайшего тайла-цели и шаг к нему --------------------------- */
  let best = Infinity, tx = posX[id], ty = posY[id];
  for (let i = 0; i < tiles.length; i++) if (tiles[i] === targetType) {
    const x = i % MAP_W, y = (i / MAP_W) | 0,
          dx = x - posX[id], dy = y - posY[id],
          d  = dx*dx + dy*dy;
    if (d < best) { best = d; tx = x; ty = y; }
  }
  moveStep(id, tx, ty);
}

/* ──────────────────────────────────────────────────────────────────────── */
function moveStep(id, tx, ty) {          // малый помощник для шага
  if (Math.abs(tx - posX[id]) > Math.abs(ty - posY[id])) {
    posX[id] += Math.sign(tx - posX[id]);
  } else {
    posY[id] += Math.sign(ty - posY[id]);
  }
}