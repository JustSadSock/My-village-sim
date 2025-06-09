// ai/farmer.js — универсальный рабочий: ест, рубит лес или собирает урожай по «рынку» потребностей

const TILE_GRASS  = 0;
const TILE_WATER  = 1;
const TILE_FOREST = 2;
const TILE_FIELD  = 3;

export function init() {
  console.log('[farmer] init');
}

export function update(id, dt, world) {
  const {
    posX, posY, age, hunger,
    MAP_W, MAP_H, tiles,
    stockFood, stockWood,
    agentCount
  } = world;

  if (id === 0 && Math.random() < 0.01) {
    console.log(`[farmer] tick #${id} | pos=(${posX[id]},${posY[id]}) hunger=${hunger[id]} food=${stockFood}`);
  }

  // 1) Потребности: еда
  if (hunger[id] < 30) {
    if (stockFood > 0) {
      world.stockFood--;
      hunger[id] = 100;
    }
    return;
  }

  // 2) Цены на ресурсы
  const baseFoodPrice = 1;
  const baseWoodPrice = 0.5;
  const priceFood = Math.min(
    Math.max(baseFoodPrice * agentCount / Math.max(stockFood, 1), 0.5),
    8
  );
  const priceWood = Math.min(
    Math.max(baseWoodPrice * agentCount / Math.max(stockWood, 1), 0.3),
    6
  );

  // 3) Навык
  const skill = Math.max(0.2, Math.min(1, age[id] / 50));

  // 4) Расчёт прибыли
  const profitHarvest = priceFood * skill;
  const profitChop = priceWood * skill;

  const harvestMode = profitHarvest >= profitChop;
  const targetType = harvestMode ? TILE_FIELD : TILE_FOREST;

  // 5) Работа на месте
  const idx = posY[id] * MAP_W + posX[id];
  if (tiles[idx] === targetType) {
    tiles[idx] = TILE_GRASS;
    if (harvestMode) {
      world.stockFood++;
    } else {
      world.stockWood++;
    }
    return;
  }

  // 6) Поиск цели
  let bestDist = Infinity, tx = posX[id], ty = posY[id];
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === targetType) {
      const x = i % MAP_W, y = (i / MAP_W) | 0;
      const dx = x - posX[id], dy = y - posY[id];
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        tx = x;
        ty = y;
      }
    }
  }

  // 7) Движение к цели
  const dx = tx - posX[id];
  const dy = ty - posY[id];
  if (Math.abs(dx) > Math.abs(dy)) {
    posX[id] += Math.sign(dx);
  } else {
    posY[id] += Math.sign(dy);
  }
}