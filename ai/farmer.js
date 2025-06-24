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
    agentCount, skillFood, skillWood, workTimer, jobType, homeId,
    carryFood, carryWood,
    // жилища и склады
    houseX, houseY, houseCapacity, houseOccupants, houseCount,
    storeX, storeY, storeSize, storeCount,
    reserved
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
      if (houseOccupants[h] < houseCapacity[h]) {
        homeId[id] = h;
        houseOccupants[h]++;
        break;
      }
    }
  } else if (houseOccupants[homeId[id]] > houseCapacity[homeId[id]]) {
    for (let h = 0; h < houseCount; h++) {
      if (houseOccupants[h] < houseCapacity[h]) {
        houseOccupants[homeId[id]]--;
        homeId[id] = h;
        houseOccupants[h]++;
        break;
      }
    }
  }

  // дети до 16 лет не покидают дом
  if (age[id] < 16 && homeId[id] >= 0) {
    const hx = houseX[homeId[id]], hy = houseY[homeId[id]];
    if (posX[id] === hx && posY[id] === hy) {
      energy[id] = Math.min(100, energy[id] + dt * 10);
    } else {
      stepToward(id, hx, hy, world);
    }
    return;
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

  /* ---------- Нести ресурсы на склад ------------------------------- */
  if (carryFood[id] > 0 || carryWood[id] > 0) {
    if (storeCount > 0) {
      let best = Infinity, tx = posX[id], ty = posY[id], si = -1;
      for (let i = 0; i < storeCount; i++) {
        const x = storeX[i], y = storeY[i];
        const d = (x - posX[id]) ** 2 + (y - posY[id]) ** 2;
        if (d < best) { best = d; tx = x; ty = y; si = i; }
      }
      if (posX[id] === tx && posY[id] === ty) {
        if (si >= 0) {
          world.deposit(si, carryFood[id], carryWood[id]);
          carryFood[id] = 0;
          carryWood[id] = 0;
        }
        jobType[id] = 0;
      } else {
        stepToward(id, tx, ty, world);
      }
    } else {
      world.stockFood += carryFood[id];
      world.stockWood += carryWood[id];
      carryFood[id] = carryWood[id] = 0;
      jobType[id] = 0;
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
  if (hunger[id] < 30 && world.stockFood > 0) {
    let best = Infinity, tx = posX[id], ty = posY[id], si = -1;
    for (let i = 0; i < storeCount; i++) {
      if (world.storeFood[i] > 0) {
        const x = storeX[i], y = storeY[i];
        const d = (x - posX[id]) ** 2 + (y - posY[id]) ** 2;
        if (d < best) { best = d; tx = x; ty = y; si = i; }
      }
    }
    if (si >= 0) {
      if (posX[id] === tx && posY[id] === ty) {
        if (world.withdraw(si, 1, 0)) {
          const restore = 15 + Math.random() * 15;
          hunger[id] = Math.min(100, hunger[id] + restore);
        }
      } else {
        stepToward(id, tx, ty, world);
      }
      return;
    }
  }

  /* ---------- 3. Экономика ресурсов ----------------------------------- */
  const foodPrice = world.priceFood;
  const woodPrice = world.priceWood;

  /* ---------- 4. Навык и прибыль -------------------------------------- */
  const harvestSpeed = 1 + skillFood[id] * 0.1;
  const chopSpeed    = 1 + skillWood[id] * 0.1;
  const harvestTime  = TIME_HARVEST / harvestSpeed;
  const chopTime     = TIME_CHOP / chopSpeed;
  const profitHarvest = foodPrice / harvestTime;
  const profitChop    = woodPrice / chopTime;

  let harvestMode = profitHarvest >= profitChop;
  if (hunger[id] < 30 && world.stockFood === 0) harvestMode = true;
  const targetType  = harvestMode ? TILE_FIELD : TILE_FOREST;

  /* ---------- 5. Работа на месте или поиск тайла ---------------------- */
  const idx = posY[id] * MAP_W + posX[id];
  if (jobType[id] === 3) return;
  if (workTimer[id] > 0) {
    workTimer[id] -= dt;
    if (workTimer[id] <= 0) {
      tiles[idx] = TILE_GRASS;
        if (jobType[id] === 1) {
        carryFood[id] = Math.min(5, carryFood[id] + 1);
        const cap = Math.min(20, Math.floor(age[id] / 3.5));
        if (skillFood[id] < cap && Math.random() < 0.25) skillFood[id]++;
      }
        if (jobType[id] === 2) {
        carryWood[id] = Math.min(5, carryWood[id] + 1);
        const cap = Math.min(20, Math.floor(age[id] / 3.5));
        if (skillWood[id] < cap && Math.random() < 0.25) skillWood[id]++;
      }
      if (reserved[idx] === id) reserved[idx] = -1;
      jobType[id] = jobType[id] === 1 ? 4 : 5;
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
  const { posX, posY, reserved, MAP_W, MAP_H } = world;
  const dx = tx - posX[id];
  const dy = ty - posY[id];
  let nx = posX[id], ny = posY[id];
  if (Math.abs(dx) > Math.abs(dy)) nx += Math.sign(dx);
  else                              ny += Math.sign(dy);
  nx = Math.max(0, Math.min(MAP_W - 1, nx));
  ny = Math.max(0, Math.min(MAP_H - 1, ny));
  const idx = ny * MAP_W + nx;
  if (reserved[idx] === -1) { posX[id] = nx; posY[id] = ny; }
}
