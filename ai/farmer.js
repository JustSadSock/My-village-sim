// ai/farmer.js — универсальный NPC с логикой питья, еды и работы по «рынку»

// Добавили определение TILE_GRASS
const TILE_GRASS  = 0;
const TILE_WATER  = 1;
const TILE_FOREST = 2;
const TILE_FIELD  = 3;

export function init(world) {
  // инициализация не требуется
}

export function update(id, dt, world) {
  const {
    posX, posY, age, hunger, thirst,
    MAP_W, MAP_H, tiles,
    stockFood, stockWood,
    agentCount
  } = world;

  // 1) Питьё: если жажда <30 → ищем воду и пьём
  if (thirst[id] < 30) {
    const idx0 = posY[id] * MAP_W + posX[id];
    if (tiles[idx0] === TILE_WATER) {
      thirst[id] = 100;
      return;
    }
    // поиск ближайшей воды
    let best = Infinity, tx = posX[id], ty = posY[id];
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i] === TILE_WATER) {
        const x = i % MAP_W, y = (i / MAP_W) | 0;
        const dx = x - posX[id], dy = y - posY[id];
        const d = dx*dx + dy*dy;
        if (d < best) { best = d; tx = x; ty = y; }
      }
    }
    // шаг к воде
    const dx = tx - posX[id], dy = ty - posY[id];
    if (Math.abs(dx) > Math.abs(dy)) posX[id] += Math.sign(dx);
    else                              posY[id] += Math.sign(dy);
    return;
  }

  // 2) Еда: если голод <30 и есть еда на складе → съесть
  if (hunger[id] < 30 && world.stockFood > 0) {
    world.stockFood--;
    hunger[id] = 100;
    return;
  }

  // 3) Экономическая логика сбора ресурсов
  const baseFoodPrice = 1, baseWoodPrice = 0.5;
  const priceFood = Math.min(
    Math.max(baseFoodPrice * agentCount / Math.max(world.stockFood, 1), 0.5),
    8
  );
  const priceWood = Math.min(
    Math.max(baseWoodPrice * agentCount / Math.max(world.stockWood, 1), 0.3),
    6
  );

  // умение на основе возраста (0.2–1.0)
  const skill = Math.max(0.2, Math.min(1, age[id] / 50));

  const profitHarvest = priceFood * skill;
  const profitChop    = priceWood * skill;

  const harvestMode = profitHarvest >= profitChop;
  const targetType  = harvestMode ? TILE_FIELD : TILE_FOREST;

  // 4) Если на нужном тайле — работаем
  const idx1 = posY[id] * MAP_W + posX[id];
  if (tiles[idx1] === targetType) {
    if (harvestMode) {
      tiles[idx1] = TILE_GRASS;
      world.stockFood++;
    } else {
      tiles[idx1] = TILE_GRASS;
      world.stockWood++;
    }
    return;
  }

  // 5) Поиск ближайшей цели
  let bestD = Infinity, tx2 = posX[id], ty2 = posY[id];
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === targetType) {
      const x = i % MAP_W, y = (i / MAP_W) | 0;
      const dx = x - posX[id], dy = y - posY[id];
      const d  = dx*dx + dy*dy;
      if (d < bestD) {
        bestD = d;
        tx2 = x;
        ty2 = y;
      }
    }
  }

  // 6) Шаг к цели
  const dx2 = tx2 - posX[id], dy2 = ty2 - posY[id];
  if (Math.abs(dx2) > Math.abs(dy2)) posX[id] += Math.sign(dx2);
  else                                posY[id] += Math.sign(dy2);
}