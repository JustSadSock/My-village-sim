// ai/farmer.js — универсальный рабочий: рубит лес или собирает урожай по «рынку»

const TILE_GRASS  = 0;
const TILE_WATER  = 1;
const TILE_FOREST = 2;
const TILE_FIELD  = 3;

export function init(world) {
  // нет инициализации
}

export function update(id, dt, world) {
  const {
    posX, posY, age,
    MAP_W, MAP_H, tiles,
    stockFood, stockWood,
    agentCount
  } = world;

  // 1) рассчитать «цены» ресурсов
  const baseFoodPrice = 1, baseWoodPrice = 0.5;
  const priceFood = Math.min(
    Math.max(baseFoodPrice * agentCount / Math.max(stockFood, 1), 0.5),
    8
  );
  const priceWood = Math.min(
    Math.max(baseWoodPrice * agentCount / Math.max(stockWood, 1), 0.3),
    6
  );

  // 2) умение по возрасту (0.2…1.0)
  const skill = Math.max(0.2, Math.min(1, age[id] / 50));

  // 3) прибыль за единицу работы
  const profitHarvest = priceFood * skill;
  const profitChop    = priceWood * skill;

  // 4) выбор задачи: собирать или рубить
  const harvestMode = profitHarvest >= profitChop;
  const targetType  = harvestMode ? TILE_FIELD : TILE_FOREST;

  // 5) если стоим на нужном тайле — работаем
  const idx = posY[id] * MAP_W + posX[id];
  if (tiles[idx] === targetType) {
    if (harvestMode) {
      tiles[idx] = TILE_GRASS;
      world.stockFood++;
    } else {
      tiles[idx] = TILE_GRASS;
      world.stockWood++;
    }
    return;
  }

  // 6) поиск ближайшего тайла-цели
  let bestDist = Infinity, tx = posX[id], ty = posY[id];
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === targetType) {
      const x = i % MAP_W, y = (i / MAP_W)|0;
      const dx = x - posX[id], dy = y - posY[id];
      const d  = dx*dx + dy*dy;
      if (d < bestDist) {
        bestDist = d;
        tx = x; ty = y;
      }
    }
  }

  // 7) шаг к цели
  const dx = tx - posX[id], dy = ty - posY[id];
  if (Math.abs(dx) > Math.abs(dy)) {
    posX[id] += Math.sign(dx);
  } else {
    posY[id] += Math.sign(dy);
  }
}