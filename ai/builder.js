// ai/builder.js — поселенцы строят дома при нехватке жилья

const TILE_GRASS = 0;

const TIME_BUILD = 8;            // время постройки
const WOOD_COST  = 15;

export function init() {}

export function update(id, dt, world) {
  const {
    age, posX, posY, homeId,
    houseX, houseY, houseOccupants, houseCount,
    MAP_W, MAP_H, tiles, reserved,
    stockWood, workTimer, jobType,
    buildX, buildY
  } = world;

  if (age[id] < 16) return;
  const h = homeId[id];
  if (h < 0 || h >= houseCount) return;
  if (houseOccupants[h] <= 2) return;

  if (jobType[id] === 3) {
    if (posX[id] === buildX[id] && posY[id] === buildY[id]) {
      workTimer[id] -= dt;
      if (workTimer[id] <= 0) {
        if (stockWood >= WOOD_COST) {
          world.stockWood -= WOOD_COST;
          const hc = world.houseCount;
          world.houseX[hc] = buildX[id];
          world.houseY[hc] = buildY[id];
          world.houseCapacity[hc] = 5;
          world.houseOccupants[hc] = 0;
          world.houseCount = hc + 1;
        }
        reserved[buildY[id] * MAP_W + buildX[id]] = -1;
        jobType[id] = 0;
        buildX[id] = -1; buildY[id] = -1;
      }
    } else {
      stepToward(id, buildX[id], buildY[id], world);
    }
    return;
  }

  if (stockWood < WOOD_COST) return;

  let bx = -1, by = -1, best = Infinity;
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] !== TILE_GRASS || reserved[i] !== -1) continue;
    const x = i % MAP_W, y = (i / MAP_W) | 0;
    let occupied = false;
    for (let h2 = 0; h2 < houseCount; h2++) {
      if (houseX[h2] === x && houseY[h2] === y) { occupied = true; break; }
    }
    if (occupied) continue;
    const d = (x - houseX[h]) ** 2 + (y - houseY[h]) ** 2;
    if (d < best) { best = d; bx = x; by = y; }
  }
  if (bx < 0) return;

  buildX[id] = bx; buildY[id] = by;
  reserved[by * MAP_W + bx] = id;
  jobType[id] = 3;
  workTimer[id] = TIME_BUILD;
}

function stepToward(id, tx, ty, world) {
  const { posX, posY, reserved, MAP_W } = world;
  const dx = tx - posX[id];
  const dy = ty - posY[id];
  let nx = posX[id], ny = posY[id];
  if (Math.abs(dx) > Math.abs(dy)) nx += Math.sign(dx);
  else ny += Math.sign(dy);
  const idx = ny * MAP_W + nx;
  if (reserved[idx] === -1) { posX[id] = nx; posY[id] = ny; }
}
