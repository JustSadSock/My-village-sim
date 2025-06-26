// ai/builder.js — поселенцы строят дома при нехватке жилья

import { TILE_GRASS, TILE_FIELD, TILE_FIELD_GROW } from '../data/constants.js';
import {
  JOB_IDLE,
  JOB_BUILD,
  JOB_BUILD_STORE,
  JOB_FARM
} from '../data/jobTypes.js';

const TIME_BUILD = 8;            // время постройки
const WOOD_COST  = 15;
const STORE_WOOD = 20;
const TIME_STORE = 10;
const TIME_FARM  = 5;

import { pathStep } from './path.js';
import { emit } from '../events/events.js';
import { isFoodLow } from './farmer.js';

export function init() {}

export function update(id, dt, world) {
  const {
    age, posX, posY, homeId, hunger, energy,
    houseX, houseY, houseCapacity, houseOccupants, houseCount,
    MAP_W, MAP_H, tiles, reserved,
    stockWood, stockFood, workTimer, jobType,
    buildX, buildY,
    storeX, storeY, storeSize, storeCount, storeFood,
    agentCount, withdraw,
    carryFood, role, morale, friend, spouse, parentA, parentB,
    time
  } = world;

  // дети также могут пользоваться складом и строить
  const h = homeId[id];

  // небольшая усталость
  energy[id] = Math.max(0, energy[id] - dt * 0.2);

  const hour = time % 24;
  const night = hour < 6 || hour >= 20;
  if (night) {
    if (h >= 0 && h < houseCount) {
      const hx = houseX[h], hy = houseY[h];
      if (posX[id] === hx && posY[id] === hy) {
        energy[id] = Math.min(100, energy[id] + dt * 5);
        morale[id] = Math.min(100, morale[id] + dt * 2);
      } else {
        stepToward(id, hx, hy, world);
      }
    }
    return;
  }

  // перекусить из собственных запасов, если других источников нет
  if (hunger[id] < 30 && carryFood[id] > 0) {
    const take = Math.min(carryFood[id], 5);
    carryFood[id] -= take;
    const restore = (15 + Math.random() * 15) * take;
    hunger[id] = Math.min(100, hunger[id] + restore);
    return;
  }

  // при нехватке еды бездействующий строитель переключается на фермерские работы
  if (isFoodLow(world) && jobType[id] === JOB_IDLE) {
    role[id] = 0; // стать фермером
    return;
  }

  // запасы восстановились — возвращаемся к строительству
  if (stockFood >= agentCount * 4 && role[id] === 0) {
    role[id] = 1;
  }

  if (hunger[id] < 30 && stockFood > 0) {
    let best = Infinity, tx = posX[id], ty = posY[id], si = -1;
    for (let i = 0; i < storeCount; i++) {
      if (storeFood[i] >= 5) {
        const x = storeX[i], y = storeY[i];
        const d = (x - posX[id]) ** 2 + (y - posY[id]) ** 2;
        if (d < best) { best = d; tx = x; ty = y; si = i; }
      }
    }
    if (si >= 0) {
      if (posX[id] === tx && posY[id] === ty) {
        if (withdraw(si, 5, 0)) {
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

  // ограничение числа одновременно строящих
  let active = 0;
  for (let i = 0; i < agentCount; i++) {
    if (jobType[i] === JOB_BUILD || jobType[i] === JOB_BUILD_STORE || jobType[i] === JOB_FARM) active++;
  }
  const MAX_ACTIVE_BUILDERS = 2;
  if (active >= MAX_ACTIVE_BUILDERS && jobType[id] === JOB_IDLE) return;

  // строительство новых домов при нехватке жилья
  const DESIRED = 2;
  let needBuild = false;

  if (h < 0 || h >= houseCount) {
    // у жителя нет дома, проверяем есть ли жильё с менее чем двумя жителями
    let free = false;
    for (let i = 0; i < houseCount; i++) {
      if (houseOccupants[i] < DESIRED) { free = true; break; }
    }
    needBuild = !free;
  } else if (houseOccupants[h] > DESIRED) {
    // дом переполнен относительно желаемого числа жителей
    let free = false;
    for (let i = 0; i < houseCount; i++) {
      if (houseOccupants[i] < DESIRED) { free = true; break; }
    }
    needBuild = !free;
  }
  // продолжить уже начатое строительство независимо от потребностей
  if (jobType[id] === JOB_BUILD || jobType[id] === JOB_BUILD_STORE || jobType[id] === JOB_FARM) {
    if (posX[id] !== buildX[id] || posY[id] !== buildY[id]) {
      stepToward(id, buildX[id], buildY[id], world);
      return;
    }

    // На месте строительства
    if (workTimer[id] === 0) {
      if (jobType[id] === JOB_BUILD) {
        if (!takeWood(WOOD_COST, world)) {
          reserved[buildY[id] * MAP_W + buildX[id]] = -1;
          jobType[id] = JOB_IDLE;
          buildX[id] = buildY[id] = -1;
          return;
        }
        const moraleMul = 0.5 + morale[id] / 200;
        workTimer[id] = TIME_BUILD / moraleMul;
      } else if (jobType[id] === JOB_BUILD_STORE) {
        if (!takeWood(STORE_WOOD, world)) {
          reserved[buildY[id] * MAP_W + buildX[id]] = -1;
          jobType[id] = JOB_IDLE;
          buildX[id] = buildY[id] = -1;
          return;
        }
        const moraleMul = 0.5 + morale[id] / 200;
        workTimer[id] = TIME_STORE / moraleMul;
      } else {
        const moraleMul = 0.5 + morale[id] / 200;
        workTimer[id] = TIME_FARM / moraleMul;
      }
    }

    workTimer[id] -= dt;
    if (workTimer[id] <= 0) {
      if (jobType[id] === JOB_BUILD) {
        const hc = world.houseCount;
        world.houseX[hc] = buildX[id];
        world.houseY[hc] = buildY[id];
        world.houseCapacity[hc] = 5;
        world.houseOccupants[hc] = 0;
        world.houseCount = hc + 1;
        emit('building-complete', { type: 'house', x: buildX[id], y: buildY[id] });

        if (world.storeCount < world.storeX.length) {
          const dirs = [
            [1, 0], [-1, 0], [0, 1], [0, -1]
          ];
          for (const [dx, dy] of dirs) {
            const sx = buildX[id] + dx;
            const sy = buildY[id] + dy;
            if (sx < 0 || sx >= MAP_W || sy < 0 || sy >= MAP_H) continue;
            if (tiles[sy * MAP_W + sx] !== TILE_GRASS) continue;
            let occupied = false;
            for (let h2 = 0; h2 < world.houseCount && !occupied; h2++) {
              if (world.houseX[h2] === sx && world.houseY[h2] === sy) occupied = true;
            }
            for (let s2 = 0; s2 < world.storeCount && !occupied; s2++) {
              if (world.storeX[s2] === sx && world.storeY[s2] === sy) occupied = true;
            }
            if (occupied) continue;
            const sc = world.storeCount;
            world.storeX[sc] = sx;
            world.storeY[sc] = sy;
            world.storeSize[sc] = 4;
            world.storeCount = sc + 1;
            break;
          }
        }
      } else if (jobType[id] === JOB_BUILD_STORE) {
        const sc = world.storeCount;
        world.storeX[sc] = buildX[id];
        world.storeY[sc] = buildY[id];
        world.storeSize[sc] = 4;
        world.storeCount = sc + 1;
        emit('building-complete', { type: 'store', x: buildX[id], y: buildY[id] });
      } else {
        tiles[buildY[id] * MAP_W + buildX[id]] = TILE_FIELD;
        emit('building-complete', { type: 'field', x: buildX[id], y: buildY[id] });
      }
      reserved[buildY[id] * MAP_W + buildX[id]] = -1;
      jobType[id] = JOB_IDLE;
      buildX[id] = buildY[id] = -1;
    }
    return;
  }

  let fields = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === TILE_FIELD || tiles[i] === TILE_FIELD_GROW) fields++;
  }
  const needStore = Math.floor(houseCount / 10) > storeCount;
  const needFarm  = fields < houseCount * 2;
  if (!needBuild && !needStore && !needFarm) return;

  if (jobType[id] !== JOB_IDLE) return;

  const buildStore = needStore && stockWood >= STORE_WOOD;
  if (!buildStore && !needFarm && stockWood < WOOD_COST) return;

  let bx = -1, by = -1, best = Infinity;
  let refX = posX[id], refY = posY[id];
  if (h >= 0 && h < houseCount) {
    refX = houseX[h];
    refY = houseY[h];
  } else if (houseCount > 0) {
    let dist = Infinity;
    for (let i = 0; i < houseCount; i++) {
      const d = (houseX[i] - posX[id]) ** 2 + (houseY[i] - posY[id]) ** 2;
      if (d < dist) { dist = d; refX = houseX[i]; refY = houseY[i]; }
    }
  }
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] !== TILE_GRASS || reserved[i] !== -1) continue;
    const x = i % MAP_W, y = (i / MAP_W) | 0;
    let occupied = false;
    for (let h2 = 0; h2 < houseCount; h2++) {
      if (houseX[h2] === x && houseY[h2] === y) { occupied = true; break; }
    }
    for (let s2 = 0; s2 < storeCount && !occupied; s2++) {
      if (storeX[s2] === x && storeY[s2] === y) { occupied = true; }
    }
    if (occupied) continue;
    const d = (x - refX) ** 2 + (y - refY) ** 2;
    if (d < best) { best = d; bx = x; by = y; }
  }
  if (bx < 0) return;

  buildX[id] = bx; buildY[id] = by;
  reserved[by * MAP_W + bx] = id;
  if (buildStore) {
    jobType[id] = JOB_BUILD_STORE;
    const moraleMul = 0.5 + morale[id] / 200;
    workTimer[id] = TIME_STORE / moraleMul;
  } else if (needBuild) {
    jobType[id] = JOB_BUILD;
    const moraleMul = 0.5 + morale[id] / 200;
    workTimer[id] = TIME_BUILD / moraleMul;
  } else {
    jobType[id] = JOB_FARM;
    const moraleMul = 0.5 + morale[id] / 200;
    workTimer[id] = TIME_FARM / moraleMul;
  }
}

function stepToward(id, tx, ty, world) {
  const { posX, posY } = world;
  const { x, y } = pathStep(posX[id], posY[id], tx, ty, world);
  posX[id] = x;
  posY[id] = y;
}

function takeWood(amount, world) {
  if (world.storeCount === 0) {
    if (world.stockWood >= amount) {
      world.stockWood -= amount;
      return true;
    }
    return false;
  }
  for (let i = 0; i < world.storeCount && amount > 0; i++) {
    const w = Math.min(world.storeWood[i], amount);
    if (w > 0) {
      world.withdraw(i, 0, w);
      amount -= w;
    }
  }
  if (amount > 0 && world.stockWood >= amount) {
    world.stockWood -= amount;
    amount = 0;
  }
  return amount === 0;
}
