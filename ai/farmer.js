// ai/farmer.js — универсальный NPC: пьёт, ест, собирает урожай или рубит лес

/* ------------------------------------------------------------------ */
/*  Константы тайлов: должны точно совпадать с тем, что в worker.     */
const TILE_GRASS  = 0;
const TILE_WATER  = 1;
const TILE_FOREST = 2;
const TILE_FIELD  = 3;
/* ------------------------------------------------------------------ */

export function init () {
  /* ничего инициализировать не нужно */
}

export function update (id, dt, world) {
  const {
    // позиции и статусы
    posX, posY, age, hunger, thirst, energy,
    // карта
    MAP_W, MAP_H, tiles,
    // ресурсы и популяция
    stockFood, stockWood, agentCount,
    // жилища
  houseX, houseY, houseCount
  } = world;

  // лёгкая усталость от времени
  energy[id] = Math.max(0, energy[id] - dt * 0.2);

  // отдых в доме при низкой энергии
  if (energy[id] < 20 && houseCount > 0) {
    let best = Infinity, tx = posX[id], ty = posY[id];
    for (let i = 0; i < houseCount; i++) {
      const x = houseX[i], y = houseY[i];
      const d = (x - posX[id]) ** 2 + (y - posY[id]) ** 2;
      if (d < best) { best = d; tx = x; ty = y; }
    }
    if (tx === posX[id] && ty === posY[id]) {
      energy[id] = Math.min(100, energy[id] + dt * 10);
    } else {
      stepToward(id, tx, ty, world);
    }
    return;
  }

  /* ---------- 1. Питьё ------------------------------------------------ */
  if (thirst[id] < 30) {
    const idx = posY[id] * MAP_W + posX[id];
    if (tiles[idx] === TILE_WATER) {
      thirst[id] = 100;               // напился
      return;                         // действие на этот тик завершено
    }
    // ищем ближайший водоём
    let best = Infinity, tx = posX[id], ty = posY[id];
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i] === TILE_WATER) {
        const x = i % MAP_W, y = (i / MAP_W) | 0;
        const d = (x - posX[id]) ** 2 + (y - posY[id]) ** 2;
        if (d < best) { best = d; tx = x; ty = y; }
      }
    }
    stepToward(id, tx, ty, world);
    return;
  }

  /* ---------- 2. Еда --------------------------------------------------- */
  if (hunger[id] < 30 && stockFood > 0) {
    world.stockFood--;                // съели единицу еды
    hunger[id] = 100;
    return;
  }

  /* ---------- 3. Экономика ресурсов ----------------------------------- */
  const baseFood = 1;
  const baseWood = 0.5;
  const foodPrice = Math.min(
    Math.max(baseFood * agentCount / Math.max(stockFood, 1), 0.5), 8
  );
  const woodPrice = Math.min(
    Math.max(baseWood * agentCount / Math.max(stockWood, 1), 0.3), 6
  );

  /* ---------- 4. Навык и прибыль -------------------------------------- */
  const skill = Math.max(0.2, Math.min(1, age[id] / 50)); // 0.2–1.0
  const profitHarvest = foodPrice * skill;
  const profitChop    = woodPrice * skill;

  const harvestMode = profitHarvest >= profitChop;
  const targetType  = harvestMode ? TILE_FIELD : TILE_FOREST;

  /* ---------- 5. Работа на месте или поиск тайла ---------------------- */
  const idx = posY[id] * MAP_W + posX[id];
  if (tiles[idx] === targetType) {
    tiles[idx] = TILE_GRASS;
    harvestMode ? world.stockFood++ : world.stockWood++;
    return;
  }

  // ищем ближайший тайл цели
  let best = Infinity, tx = posX[id], ty = posY[id];
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === targetType) {
      const x = i % MAP_W, y = (i / MAP_W) | 0;
      const d = (x - posX[id]) ** 2 + (y - posY[id]) ** 2;
      if (d < best) { best = d; tx = x; ty = y; }
    }
  }

  if (best !== Infinity) stepToward(id, tx, ty, world);
}

/* -------------------------------------------------------------------- */
/*  Простая функция движения на один шаг в сторону цели                 */
function stepToward (id, tx, ty, world) {
  const { posX, posY } = world;
  const dx = tx - posX[id];
  const dy = ty - posY[id];
  if (Math.abs(dx) > Math.abs(dy)) posX[id] += Math.sign(dx);
  else                             posY[id] += Math.sign(dy);
}