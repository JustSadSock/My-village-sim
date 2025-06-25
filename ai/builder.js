// ai/builder.js — поселенцы строят дома при нехватке жилья

const TILE_GRASS = 0;

const TIME_BUILD = 8;            // время постройки
const WOOD_COST  = 15;
const STORE_WOOD = 20;
const TIME_STORE = 10;
const TIME_FARM  = 5;

import { pathStep } from './path.js';

export function init() {}

export function update(id, dt, world) {
  const {
    age, posX, posY, homeId,
    houseX, houseY, houseCapacity, houseOccupants, houseCount,
    MAP_W, MAP_H, tiles, reserved,
    stockWood, workTimer, jobType,
    buildX, buildY,
    storeX, storeY, storeSize, storeCount,
    agentCount
  } = world;

  if (age[id] < 16) return;
  const h = homeId[id];

  // ограничение числа одновременно строящих
  let active = 0;
  for (let i = 0; i < agentCount; i++) {
    if (jobType[i] === 3 || jobType[i] === 6 || jobType[i] === 7) active++;
  }
  const MAX_ACTIVE_BUILDERS = 2;
  if (active >= MAX_ACTIVE_BUILDERS && jobType[id] === 0) return;

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
  if (jobType[id] === 3 || jobType[id] === 6 || jobType[id] === 7) {
    if (posX[id] !== buildX[id] || posY[id] !== buildY[id]) {
      stepToward(id, buildX[id], buildY[id], world);
      return;
    }

    // На месте строительства
    if (workTimer[id] === 0) {
      if (jobType[id] === 3) {
        if (!takeWood(WOOD_COST, world)) {
          reserved[buildY[id] * MAP_W + buildX[id]] = -1;
          jobType[id] = 0;
          buildX[id] = buildY[id] = -1;
          return;
        }
        workTimer[id] = TIME_BUILD;
      } else if (jobType[id] === 6) {
        if (!takeWood(STORE_WOOD, world)) {
          reserved[buildY[id] * MAP_W + buildX[id]] = -1;
          jobType[id] = 0;
          buildX[id] = buildY[id] = -1;
          return;
        }
        workTimer[id] = TIME_STORE;
      } else {
        workTimer[id] = TIME_FARM;
      }
    }

    workTimer[id] -= dt;
    if (workTimer[id] <= 0) {
      if (jobType[id] === 3) {
        const hc = world.houseCount;
        world.houseX[hc] = buildX[id];
        world.houseY[hc] = buildY[id];
        world.houseCapacity[hc] = 5;
        world.houseOccupants[hc] = 0;
        world.houseCount = hc + 1;

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
      } else if (jobType[id] === 6) {
        const sc = world.storeCount;
        world.storeX[sc] = buildX[id];
        world.storeY[sc] = buildY[id];
        world.storeSize[sc] = 4;
        world.storeCount = sc + 1;
      } else {
        tiles[buildY[id] * MAP_W + buildX[id]] = 3;
      }
      reserved[buildY[id] * MAP_W + buildX[id]] = -1;
      jobType[id] = 0;
      buildX[id] = buildY[id] = -1;
    }
    return;
  }

  let fields = 0;
  for (let i = 0; i < tiles.length; i++) if (tiles[i] === 3) fields++;
  const needStore = Math.floor(houseCount / 10) > storeCount;
  const needFarm  = fields < houseCount * 2;
  if (!needBuild && !needStore && !needFarm) return;

  if (jobType[id] !== 0) return;

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
    jobType[id] = 6;
    workTimer[id] = TIME_STORE;
  } else if (needBuild) {
    jobType[id] = 3;
    workTimer[id] = TIME_BUILD;
  } else {
    jobType[id] = 7;
    workTimer[id] = TIME_FARM;
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
