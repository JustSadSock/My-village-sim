// ai/farmer.js — добавлена логика питья и учёт жажды

export function init(world) {
  // ничего особенного для инициализации
}

export function update(id, dt, world) {
  const {
    posX, posY,
    age, hunger, thirst,
    MAP_W, MAP_H, tiles,
    get stockFood() { return world.stockFood; },
    set stockFood(v) { world.stockFood = v; },
  } = world;

  // Tile-коды
  const TILE_GRASS  = 0;
  const TILE_WATER  = 1;
  const TILE_FOREST = 2;
  const TILE_FIELD  = 3;

  // 1) Сначала жажда: если thirst < 30, пойти к воде и попить
  if (thirst[id] < 30) {
    const idx = posY[id] * MAP_W + posX[id];
    if (tiles[idx] === TILE_WATER) {
      // восполняем жажду
      thirst[id] = 100;
    } else {
      // найти ближайший водный тайл
      let best = Infinity, tx = posX[id], ty = posY[id];
      for (let i = 0; i < tiles.length; i++) {
        if (tiles[i] === TILE_WATER) {
          const x = i % MAP_W, y = (i / MAP_W) | 0;
          const dx = x - posX[id], dy = y - posY[id];
          const d = dx*dx + dy*dy;
          if (d < best) { best = d; tx = x; ty = y; }
        }
      }
      // шаг навстречу
      const dx = tx - posX[id], dy = ty - posY[id];
      if (Math.abs(dx) > Math.abs(dy)) posX[id] += Math.sign(dx);
      else                          posY[id] += Math.sign(dy);
    }
    return;
  }

  // 2) Если очень голоден — поесть (если еда есть)
  if (hunger[id] < 30) {
    if (world.stockFood > 0) {
      world.stockFood--;
      hunger[id] = 100;
    }
    return;
  }

  // 3) Экономика: цены еды/дерева (упрощённо)
  const baseFoodPrice = 1, baseWoodPrice = 0.5;
  const priceFood = Math.min(
    Math.max(baseFoodPrice * world.agentCount / Math.max(world.stockFood,1), 0.5),
    8
  );
  const priceWood = Math.min(
    Math.max(baseWoodPrice * world.agentCount / Math.max(world.stockWood,1), 0.3),
    6
  );

  // 4) Навык по возрасту
  const skill = Math.max(0.2, Math.min(1, age[id] / 50));

  // 5) Прибыльность — едим или рубим лес
  const profitHarvest = priceFood * skill;
  const profitChop    = priceWood * skill;
  const targetType    = profitHarvest >= profitChop
                        ? TILE_FIELD
                        : TILE_FOREST;

  // 6) Если уже на цели — работаем
  const here = posY[id] * MAP_W + posX[id];
  if (tiles[here] === targetType) {
    if (targetType === TILE_FIELD) {
      tiles[here] = TILE_GRASS;
      world.stockFood++;
      // после работы немного увеличить голод, чтобы не съедали всё подряд
      hunger[id] = Math.max(0, hunger[id] - 5);
    } else {
      tiles[here] = TILE_GRASS;
      world.stockWood++;
    }
    return;
  }

  // 7) Движемся к ближайшему нужному тайлу
  let best = Infinity, tx = posX[id], ty = posY[id];
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === targetType) {
      const x = i % MAP_W, y = (i / MAP_W) | 0;
      const dx = x - posX[id], dy = y - posY[id];
      const d  = dx*dx + dy*dy;
      if (d < best) { best = d; tx = x; ty = y; }
    }
  }
  const dx = tx - posX[id], dy = ty - posY[id];
  if (Math.abs(dx) > Math.abs(dy)) posX[id] += Math.sign(dx);
  else                          posY[id] += Math.sign(dy);
}