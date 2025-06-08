// ai/farmer.js — универсальный рабочий с корректным переключением на лес, когда поля закончились

export function init(world) {
  // ничего не нужно при старте
}

export function update(id, dt, world) {
  const {
    posX, posY, age, hunger,
    MAP_W, MAP_H, tiles,
    stockFood, stockWood,
    agentCount
  } = world;

  // 1) Если очень голоден — сразу поесть
  if (hunger[id] < 30) {
    if (world.stockFood > 0) {
      world.stockFood--;
      hunger[id] = 100;
    }
    return;
  }

  // 2) Рассчитываем цены на рынке (сглаженные clamp)
  const priceFood = Math.min(
    Math.max(1 * agentCount / Math.max(world.stockFood, 1), 0.5),
    8
  );
  const priceWood = Math.min(
    Math.max(0.5 * agentCount / Math.max(world.stockWood, 1), 0.3),
    6
  );

  // 3) Навык в зависимости от возраста
  const skill = Math.max(0.2, Math.min(1, age[id] / 50));

  // 4) Прибыльность полевых и лесных работ
  const profitHarvest = priceFood * skill;
  const profitChop    = priceWood * skill;

  // 5) Функция поиска ближайшего тайла нужного типа
  function findNearest(tileType) {
    let bestDist = Infinity, tx = -1, ty = -1;
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i] === tileType) {
        const x = i % MAP_W, y = (i / MAP_W) | 0;
        const dx = x - posX[id], dy = y - posY[id];
        const d  = dx*dx + dy*dy;
        if (d < bestDist) {
          bestDist = d; tx = x; ty = y;
        }
      }
    }
    return (bestDist < Infinity) ? { tx, ty } : null;
  }

  // 6) Выбираем, чем заняться (поля или лес)
  let taskType = profitHarvest >= profitChop
    ? TILE_FIELD
    : TILE_FOREST;

  let target = findNearest(taskType);

  // 7) Если нет подходящих полей, переключаемся на лес (и наоборот)
  if (!target) {
    const other = (taskType === TILE_FIELD ? TILE_FOREST : TILE_FIELD);
    target = findNearest(other);
    taskType = other;
    if (!target) {
      // ни поля, ни леса не нашли — нечего делать
      return;
    }
  }

  const { tx, ty } = target;
  const idx = posY[id] * MAP_W + posX[id];

  // 8) Если на месте цели — работаем
  if (tiles[idx] === taskType) {
    // убираем тайл и начисляем ресурс
    tiles[idx] = TILE_GRASS;
    if (taskType === TILE_FIELD) {
      world.stockFood++;
    } else {
      world.stockWood++;
    }
    return;
  }

  // 9) Простой шаг к цели
  const dx = tx - posX[id], dy = ty - posY[id];
  if (Math.abs(dx) > Math.abs(dy)) {
    posX[id] += Math.sign(dx);
  } else {
    posY[id] += Math.sign(dy);
  }
}