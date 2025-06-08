// ai/farmer.js — обновлённый универсальный рабочий: теперь учитывает питьё и голод

// Пороговые значения
const HUNGER_THRESHOLD = 30;
const THIRST_THRESHOLD = 30;

export function init(world) {
  // ничего не нужно при старте
}

export function update(id, dt, world) {
  const {
    posX, posY, age, hunger, thirst,
    MAP_W, MAP_H, tiles,
    stockFood, stockWood,
    agentCount
  } = world;

  const TILE_WATER  = 1;
  const TILE_FOREST = 2;
  const TILE_FIELD  = 3;

  // 1) Сначала проверяем жажду
  if (thirst[id] < THIRST_THRESHOLD) {
    const idx = posY[id] * MAP_W + posX[id];
    // если стоим на воде — пьём
    if (tiles[idx] === TILE_WATER) {
      world.thirst[id] = 100;
    } else {
      // ищем ближайший водный тайл
      let best = Infinity, tx = posX[id], ty = posY[id];
      for (let i = 0; i < tiles.length; i++) {
        if (tiles[i] === TILE_WATER) {
          const x = i % MAP_W, y = (i / MAP_W)|0;
          const d = (x-posX[id])**2 + (y-posY[id])**2;
          if (d < best) { best = d; tx = x; ty = y; }
        }
      }
      // двигаемся к воде
      const dx = tx - posX[id], dy = ty - posY[id];
      if (Math.abs(dx) > Math.abs(dy)) posX[id] += Math.sign(dx);
      else                            posY[id] += Math.sign(dy);
    }
    return;
  }

  // 2) Затем — голод
  if (hunger[id] < HUNGER_THRESHOLD) {
    if (world.stockFood > 0) {
      world.stockFood--;
      world.hunger[id] = 100;
    }
    return;
  }

  // 3) Цены (спрос/запас)
  const baseFoodPrice = 1, baseWoodPrice = 0.5;
  const priceFood = Math.min(
    Math.max(baseFoodPrice * agentCount / Math.max(world.stockFood, 1), 0.5),
    8
  );
  const priceWood = Math.min(
    Math.max(baseWoodPrice * agentCount / Math.max(world.stockWood, 1), 0.3),
    6
  );

  // 4) Навык по возрасту
  const skill = Math.max(0.2, Math.min(1, age[id] / 50));

  // 5) Оценка прибыли
  const profitHarvest = priceFood * skill;
  const profitChop    = priceWood * skill;

  // 6) Выбор цели: поле или лес
  const harvestMode = profitHarvest >= profitChop;
  const targetType  = harvestMode ? TILE_FIELD : TILE_FOREST;

  // 7) Если стоим на нужном тайле — работаем
  const idx = posY[id] * MAP_W + posX[id];
  if (tiles[idx] === targetType) {
    // собираем ресурс
    if (harvestMode) {
      tiles[idx] = TILE_GRASS;
      world.stockFood++;
    } else {
      tiles[idx] = TILE_GRASS;
      world.stockWood++;
    }
    return;
  }

  // 8) Иначе — идём к ближайшему тайлу этого типа
  let best = Infinity, tx = posX[id], ty = posY[id];
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === targetType) {
      const x = i % MAP_W, y = (i / MAP_W)|0;
      const d = (x-posX[id])**2 + (y-posY[id])**2;
      if (d < best) { best = d; tx = x; ty = y; }
    }
  }
  const dx = tx - posX[id], dy = ty - posY[id];
  if (Math.abs(dx) > Math.abs(dy)) posX[id] += Math.sign(dx);
  else                            posY[id] += Math.sign(dy);
}