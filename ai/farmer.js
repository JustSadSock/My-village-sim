// ai/farmer.js — универсальный рабочий: ест, рубит лес или собирает урожай по «рынку» потребностей

export function init() {
  // ничего не нужно при старте
}

export function update(id, dt, world) {
  const {
    posX, posY, age, hunger,
    MAP_W, MAP_H, tiles,
    stockFood, stockWood,
    agentCount
  } = world;

  // 1) Базовые потребности: еда
  if (hunger[id] < 30) {
    if (world.stockFood > 0) {
      world.stockFood--;
      hunger[id] = 100;
    }
    return;
  }

  // 2) Цены на «рынке»
  const baseFoodPrice = 1, baseWoodPrice = 0.5;
  const priceFood = Math.min(
    Math.max(baseFoodPrice * agentCount / Math.max(world.stockFood, 1), 0.5),
    8
  );
  const priceWood = Math.min(
    Math.max(baseWoodPrice * agentCount / Math.max(world.stockWood, 1), 0.3),
    6
  );

  // 3) «Умение» по возрасту (от 0.2 до 1.0)
  const skill = Math.max(0.2, Math.min(1, age[id] / 50));

  // 4) Оценка прибыли за единицу работы
  const profitHarvest = priceFood * skill;
  const profitChop    = priceWood * skill;

  // 5) Выбор работы
  const harvestMode = profitHarvest >= profitChop;
  const targetType  = harvestMode ? 3 /* field */ : 2 /* forest */;

  // 6) Если уже на нужном тайле — работаем
  const idx = posY[id] * MAP_W + posX[id];
  if (tiles[idx] === targetType) {
    if (harvestMode) {
      tiles[idx] = 0;
      world.stockFood++;
    } else {
      tiles[idx] = 0;
      world.stockWood++;
    }
    return;
  }

  // 7) Ищем ближайший тайл цели
  let bestDist = Infinity, tx = posX[id], ty = posY[id];
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === targetType) {
      const x = i % MAP_W, y = (i / MAP_W) | 0;
      const dx = x - posX[id], dy = y - posY[id];
      const d  = dx*dx + dy*dy;
      if (d < bestDist) {
        bestDist = d; tx = x; ty = y;
      }
    }
  }

  // 8) Простейший шаг к цели
  const dx = tx - posX[id], dy = ty - posY[id];
  if (Math.abs(dx) > Math.abs(dy)) {
    posX[id] += Math.sign(dx);
  } else {
    posY[id] += Math.sign(dy);
  }
}