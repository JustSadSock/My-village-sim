// ai/builder.js — поселенцы строят дома при нехватке жилья

const TILE_GRASS = 0;

const TIME_BUILD = 8;            // время постройки
const WOOD_COST  = 15;
const STORE_WOOD = 20;
const TIME_STORE = 10;

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
    if (jobType[i] === 3 || jobType[i] === 6) active++;
  }
  const MAX_ACTIVE_BUILDERS = 2;
  if (active >= MAX_ACTIVE_BUILDERS && jobType[id] === 0) return;

  // подсчёт требуемого числа домов: 1 дом на 5 жителей
  const requiredHouses = Math.ceil(agentCount / 5);
  let needBuild = houseCount < requiredHouses;
  if (!needBuild) {
    if (h < 0 || h >= houseCount) {
      // у жителя нет дома, проверяем есть ли свободное жильё
      let free = false;
      for (let i = 0; i < houseCount; i++) {
        if (houseOccupants[i] < houseCapacity[i]) { free = true; break; }
      }
      needBuild = !free;
    } else if (houseOccupants[h] >= houseCapacity[h]) {
      // дом переполнен, ищем свободное место
      let free = false;
      for (let i = 0; i < houseCount; i++) {
        if (houseOccupants[i] < houseCapacity[i]) { free = true; break; }
      }
      needBuild = !free && houseCount < requiredHouses;
    }
  }
  const needStore = Math.floor(houseCount / 10) > storeCount;
  if (!needBuild && !needStore) return;

  if (jobType[id] !== 0 && jobType[id] !== 3 && jobType[id] !== 6) return;

  if (jobType[id] === 3 || jobType[id] === 6) {
    if (posX[id] !== buildX[id] || posY[id] !== buildY[id]) {
      stepToward(id, buildX[id], buildY[id], world);
      return;
    }

    // На месте строительства
    if (workTimer[id] === 0) {
      const cost = jobType[id] === 3 ? WOOD_COST : STORE_WOOD;
      if (!takeWood(cost, world)) {
        reserved[buildY[id] * MAP_W + buildX[id]] = -1;
        jobType[id] = 0;
        buildX[id] = buildY[id] = -1;
        return;
      }
      workTimer[id] = jobType[id] === 3 ? TIME_BUILD : TIME_STORE;
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
      } else {
        const sc = world.storeCount;
        world.storeX[sc] = buildX[id];
        world.storeY[sc] = buildY[id];
        world.storeSize[sc] = 4;
        world.storeCount = sc + 1;
      }
      reserved[buildY[id] * MAP_W + buildX[id]] = -1;
      jobType[id] = 0;
      buildX[id] = buildY[id] = -1;
    }
    return;
  }

  const buildStore = needStore && stockWood >= STORE_WOOD;
  if (!buildStore && stockWood < WOOD_COST) return;

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
  jobType[id] = buildStore ? 6 : 3;
  workTimer[id] = buildStore ? TIME_STORE : TIME_BUILD;
}

function stepToward(id, tx, ty, world) {
  const { posX, posY, reserved, MAP_W, MAP_H } = world;
  const dx = tx - posX[id];
  const dy = ty - posY[id];
  let nx = posX[id], ny = posY[id];
  if (Math.abs(dx) > Math.abs(dy)) nx += Math.sign(dx);
  else ny += Math.sign(dy);
  nx = Math.max(0, Math.min(MAP_W - 1, nx));
  ny = Math.max(0, Math.min(MAP_H - 1, ny));
  posX[id] = nx;
  posY[id] = ny;

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
  return amount === 0;
}
