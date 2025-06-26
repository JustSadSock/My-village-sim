// ai/farmer.js — универсальный NPC: пьёт, ест, собирает урожай или рубит лес

/* ------------------------------------------------------------------ */
/*  Константы тайлов: должны точно совпадать с тем, что в worker.     */
import { TILE_GRASS, TILE_WATER, TILE_FOREST, TILE_FIELD,
         TILE_FIELD_GROW, TILE_FOREST_GROW } from '../data/constants.js';
import {
  JOB_IDLE,
  JOB_HARVEST,
  JOB_CHOP,
  JOB_BUILD,
  JOB_STORE_FOOD,
  JOB_STORE_WOOD,
  JOB_BUILD_STORE
} from '../data/jobTypes.js';
/* ------------------------------------------------------------------ */
const TIME_HARVEST = 3;  // базовое время сбора пищи
const TIME_CHOP    = 5;  // базовое время рубки дерева
const FIELD_GROW_TIME = 30;
const FOREST_GROW_TIME = 60;

import { pathStep } from './path.js';

export function isFoodLow(world) {
  return world.stockFood < world.agentCount * 2;
}

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
    carryFood, carryWood, morale, friend, spouse, parentA, parentB,
    time,
    // жилища и склады
    houseX, houseY, houseCapacity, houseOccupants, houseCount,
    storeX, storeY, storeSize, storeCount,
    reserved
  } = world;

  const lowFood = isFoodLow(world);

  // лёгкая усталость от времени
  energy[id] = Math.max(0, energy[id] - dt * 0.2);

  const hour = time % 24;
  const night = hour < 6 || hour >= 20;
  if (night) {
    if (homeId[id] >= 0 && homeId[id] < houseCount) {
      const hx = houseX[homeId[id]], hy = houseY[homeId[id]];
      if (posX[id] === hx && posY[id] === hy) {
        energy[id] = Math.min(100, energy[id] + dt * 5);
        morale[id] = Math.min(100, morale[id] + dt * 2);
      } else {
        stepToward(id, hx, hy, world);
      }
    }
    return;
  }

  // проверка дома
  const DESIRED = 2; // желаемое число жителей в доме
  if (homeId[id] >= 0 && homeId[id] < houseCount) {
    if (houseOccupants[homeId[id]] > houseCapacity[homeId[id]]) {
      houseOccupants[homeId[id]]--;
      homeId[id] = -1;
    }
  }

  // переселение при переполнении относительно желаемого числа жителей
  if (homeId[id] >= 0 && homeId[id] < houseCount) {
    if (houseOccupants[homeId[id]] > DESIRED) {
      let candidate = -1;
      const rels = [spouse[id], parentA[id], parentB[id], friend[id]];
      for (const r of rels) {
        if (r >= 0 && homeId[r] >= 0 && homeId[r] < houseCount && houseOccupants[homeId[r]] < DESIRED) {
          candidate = homeId[r];
          break;
        }
      }
      if (candidate === -1) {
        for (let h = 0; h < houseCount; h++) {
          if (houseOccupants[h] < DESIRED) { candidate = h; break; }
        }
      }
      if (candidate >= 0) {
        houseOccupants[homeId[id]]--;
        homeId[id] = candidate;
        houseOccupants[candidate]++;
      }
    }
  }

  if (homeId[id] === -1) {
    let candidate = -1;
    const rels = [spouse[id], parentA[id], parentB[id], friend[id]];
    for (const r of rels) {
      if (r >= 0 && homeId[r] >= 0 && homeId[r] < houseCount && houseOccupants[homeId[r]] < DESIRED) {
        candidate = homeId[r];
        break;
      }
    }
    if (candidate === -1) {
      for (let h = 0; h < houseCount; h++) {
        if (houseOccupants[h] < DESIRED) { candidate = h; break; }
      }
    }
    if (candidate >= 0) {
      homeId[id] = candidate;
      houseOccupants[candidate]++;
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

  // съесть припасённую еду, если уровень голода низкий
  if (hunger[id] < 30 && carryFood[id] > 0) {
    const take = Math.min(carryFood[id], 5);
    carryFood[id] -= take;
    const restore = (15 + Math.random() * 15) * take;
    hunger[id] = Math.min(100, hunger[id] + restore);
  }

  /* ---------- Нести ресурсы на склад ------------------------------- */
  if (carryFood[id] >= 10 || carryWood[id] >= 10 || jobType[id] === JOB_STORE_FOOD || jobType[id] === JOB_STORE_WOOD) {
    if (storeCount > 0) {
      let best = Infinity, tx = posX[id], ty = posY[id], si = -1;
      for (let i = 0; i < storeCount; i++) {
        const x = storeX[i], y = storeY[i];
        const d = (x - posX[id]) ** 2 + (y - posY[id]) ** 2;
        if (d < best) { best = d; tx = x; ty = y; si = i; }
      }
      if (posX[id] === tx && posY[id] === ty) {
        if (si >= 0) {
          const df = Math.max(carryFood[id] - 5, 0);
          const dw = Math.max(carryWood[id] - 5, 0);
          world.deposit(si, df, dw);
          carryFood[id] = Math.min(carryFood[id], 5);
          carryWood[id] = Math.min(carryWood[id], 5);
        }
        jobType[id] = JOB_IDLE;
      } else {
        stepToward(id, tx, ty, world);
      }
    } else {
      world.stockFood += Math.max(carryFood[id] - 5, 0);
      world.stockWood += Math.max(carryWood[id] - 5, 0);
      carryFood[id] = Math.min(carryFood[id], 5);
      carryWood[id] = Math.min(carryWood[id], 5);
      jobType[id] = JOB_IDLE;
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
      if (world.storeFood[i] >= 5) {
        const x = storeX[i], y = storeY[i];
        const d = (x - posX[id]) ** 2 + (y - posY[id]) ** 2;
        if (d < best) { best = d; tx = x; ty = y; si = i; }
      }
    }
    if (si >= 0) {
      if (posX[id] === tx && posY[id] === ty) {
        if (world.withdraw(si, 5, 0)) {
          const restore = (15 + Math.random() * 15) * 5;
          hunger[id] = Math.min(100, hunger[id] + restore);
        }
      } else {
        stepToward(id, tx, ty, world);
      }
      return;
    } else {
      const taken = Math.min(5, world.stockFood);
      world.stockFood -= taken;
      if (taken > 0) {
        const restore = (15 + Math.random() * 15) * taken;
        hunger[id] = Math.min(100, hunger[id] + restore);
      }
      return;
    }
  }

  /* ---------- 3. Экономика ресурсов ----------------------------------- */
  const foodPrice = world.priceFood;
  const woodPrice = world.priceWood;

  /* ---------- 4. Навык и прибыль -------------------------------------- */
  // после 50 лет жители постепенно теряют силу
  const ageMul = age[id] <= 50 ? 1 : Math.max(0.5, 1 - (age[id] - 50) * 0.02);
  const harvestSpeed = (1 + skillFood[id] * 0.1) * ageMul;
  const chopSpeed    = (1 + skillWood[id] * 0.1) * ageMul;
  const moraleMul = 0.5 + morale[id] / 200;
  const harvestTime  = TIME_HARVEST / (harvestSpeed * moraleMul);
  const chopTime     = TIME_CHOP / (chopSpeed * moraleMul);
  const profitHarvest = foodPrice / harvestTime;
  const profitChop    = woodPrice / chopTime;

  let harvestMode = lowFood || profitHarvest >= profitChop;
  if (hunger[id] < 30 && world.stockFood === 0) harvestMode = true;
  const targetType  = harvestMode ? TILE_FIELD : TILE_FOREST;
  const growType = harvestMode ? TILE_FIELD_GROW : TILE_FOREST_GROW;

  /* ---------- 5. Работа на месте или поиск тайла ---------------------- */
  const idx = posY[id] * MAP_W + posX[id];
  if (jobType[id] === JOB_BUILD || jobType[id] === JOB_BUILD_STORE) return;
  if (workTimer[id] > 0) {
    workTimer[id] -= dt;
    if (workTimer[id] <= 0) {
      if (jobType[id] === JOB_HARVEST) {
        tiles[idx] = TILE_FIELD_GROW;
        world.tileTimer[idx] = FIELD_GROW_TIME;
        carryFood[id] = Math.min(10, carryFood[id] + 1);
        const cap = Math.min(20, Math.floor(age[id] / 3.5));
        if (age[id] <= 60 && skillFood[id] < cap && Math.random() < 0.25) skillFood[id]++;
        jobType[id] = carryFood[id] >= 10 ? JOB_STORE_FOOD : JOB_IDLE;
      }
      if (jobType[id] === JOB_CHOP) {
        tiles[idx] = TILE_FOREST_GROW;
        world.tileTimer[idx] = FOREST_GROW_TIME;
        carryWood[id] = Math.min(10, carryWood[id] + 1);
        const cap = Math.min(20, Math.floor(age[id] / 3.5));
        if (age[id] <= 60 && skillWood[id] < cap && Math.random() < 0.25) skillWood[id]++;
        jobType[id] = carryWood[id] >= 10 ? JOB_STORE_WOOD : JOB_IDLE;
      }
      if (reserved[idx] === id) reserved[idx] = -1;
    }
    return;
  }
  if (tiles[idx] === targetType && reserved[idx] === -1) {
    reserved[idx] = id;
    jobType[id] = harvestMode ? JOB_HARVEST : JOB_CHOP;
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

function stepToward(id, tx, ty, world) {
  const { posX, posY } = world;
  const { x, y } = pathStep(posX[id], posY[id], tx, ty, world);
  posX[id] = x;
  posY[id] = y;
}
