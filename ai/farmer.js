// ai/farmer.js — универсальный NPC: пьёт, ест, собирает урожай или рубит лес

/* ------------------------------------------------------------------ */
/*  Константы тайлов: должны точно совпадать с тем, что в worker.     */
const TILE_GRASS  = 0;
const TILE_WATER  = 1;
const TILE_FOREST = 2;
const TILE_FIELD  = 3;
/* ------------------------------------------------------------------ */
const TIME_HARVEST = 3;  // базовое время сбора пищи
const TIME_CHOP    = 5;  // базовое время рубки дерева

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
    stockFood, stockWood, agentCount, skillFood, skillWood, workTimer, jobType, homeId,
    // жилища
  houseX, houseY, houseCapacity, houseOccupants, houseCount, reserved
  } = world;

  // лёгкая усталость от времени
  energy[id] = Math.max(0, energy[id] - dt * 0.2);

  // проверка дома
  if (homeId[id] >= 0 && homeId[id] < houseCount) {
    if (houseOccupants[homeId[id]] > houseCapacity[homeId[id]]) {
      houseOccupants[homeId[id]]--;
      homeId[id] = -1;
    }
  }
  if (homeId[id] === -1) {
    for (let h = 0; h < houseCount; h++) {
      if (houseOccupants[h] < 2) {
        homeId[id] = h;
        houseOccupants[h]++;
        break;
      }
    }
  } else if (houseOccupants[homeId[id]] > 2) {
    for (let h = 0; h < houseCount; h++) {
      if (houseOccupants[h] < 2) {
        houseOccupants[homeId[id]]--;
        homeId[id] = h;
        houseOccupants[h]++;
        break;
      }
    }
  }

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
  const harvestSpeed = 1 + skillFood[id] * 0.1;
  const chopSpeed    = 1 + skillWood[id] * 0.1;
  const harvestTime  = TIME_HARVEST / harvestSpeed;
  const chopTime     = TIME_CHOP / chopSpeed;
  const profitHarvest = foodPrice / harvestTime;
  const profitChop    = woodPrice / chopTime;

  const harvestMode = profitHarvest >= profitChop;
  const targetType  = harvestMode ? TILE_FIELD : TILE_FOREST;

  /* ---------- 5. Работа на месте или поиск тайла ---------------------- */
  const idx = posY[id] * MAP_W + posX[id];
  if (workTimer[id] > 0) {
    workTimer[id] -= dt;
    if (workTimer[id] <= 0) {
      tiles[idx] = TILE_GRASS;
      if (jobType[id] === 1) {
        world.stockFood++;
        const cap = Math.min(20, Math.floor(age[id] / 3.5));
        if (skillFood[id] < cap && Math.random() < 0.25) skillFood[id]++;
      }
      if (jobType[id] === 2) {
        world.stockWood++;
        const cap = Math.min(20, Math.floor(age[id] / 3.5));
        if (skillWood[id] < cap && Math.random() < 0.25) skillWood[id]++;
      }
      if (reserved[idx] === id) reserved[idx] = -1;
      jobType[id] = 0;
    }
    return;
  }
  if (tiles[idx] === targetType && reserved[idx] === -1) {
    reserved[idx] = id;
    jobType[id] = harvestMode ? 1 : 2;
    workTimer[id] = harvestMode ? harvestTime : chopTime;
    return;
  }

  // ищем ближайший тайл цели
  let best = Infinity, tx = posX[id], ty = posY[id];
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === targetType && reserved[i] === -1) {
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
  const { posX, posY, reserved } = world;
  const dx = tx - posX[id];
  const dy = ty - posY[id];
  let nx = posX[id], ny = posY[id];
  if (Math.abs(dx) > Math.abs(dy)) nx += Math.sign(dx);
  else                              ny += Math.sign(dy);
  const idx = ny * world.MAP_W + nx;
  if (reserved[idx] === -1) { posX[id] = nx; posY[id] = ny; }
}