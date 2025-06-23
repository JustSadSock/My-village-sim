// ai/builder.js — модуль, позволяющий NPC самостоятельно строить дома

export function init() {
  // инициализация не нужна
}

export function update(id, dt, world) {
  const {
    posX, posY,
    MAP_W, MAP_H,
    tiles,
    stockWood,
    houseX, houseY, houseCapacity, houseOccupants,
    homeId,
    agentCount, houseCount
  } = world;

  // 1. Определяем, есть ли свободные дома
  let hasFree = false, extras = 0, homeless = 0;
  for (let i = 0; i < houseCount; i++) {
    if (houseOccupants[i] < 2) hasFree = true;
    if (houseOccupants[i] > 2) extras += houseOccupants[i] - 2;
  }
  for (let i = 0; i < agentCount; i++) {
    if (homeId[i] === -1) homeless++;
  }
  const demand = hasFree ? 0 : (homeless + extras);
  if (demand <= 0) return;

  // 3. Проверка ресурсов: на постройку нужно WOOD_COST бревен
  const WOOD_COST = 15;
  if (stockWood < WOOD_COST) return;

  // 4. Выбираем подходящую клетку травы без дома
  let buildX = -1, buildY = -1, bestScore = -Infinity;
  for (let a = 0; a < 100; a++) {
    const i = Math.random() * tiles.length | 0;
    if (tiles[i] !== 0) continue;
    const x = i % MAP_W;
    const y = (i / MAP_W) | 0;
    let occupied = false;
    for (let h = 0; h < houseCount; h++) {
      if (houseX[h] === x && houseY[h] === y) { occupied = true; break; }
    }
    if (occupied) continue;
    let score = 0;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
        const t = tiles[ny * MAP_W + nx];
        if (t === 3) score += 3;      // рядом с полем
        if (t === 1) score -= 2;      // не строим около воды
      }
    }
    for (let h = 0; h < houseCount; h++) {
      const dx = houseX[h] - x, dy = houseY[h] - y;
      if (dx * dx + dy * dy < 25) score += 2; // возле других домов
    }
    if (score > bestScore) { bestScore = score; buildX = x; buildY = y; }
  }
  if (buildX < 0) return;  // негде строить

  // 5. Снимаем ресурс со склада и создаём дом
  world.stockWood -= WOOD_COST;

  // запись в глобальные массивы дома
  world.houseX[houseCount]        = buildX;
  world.houseY[houseCount]        = buildY;
  world.houseCapacity[houseCount] = 5;  // вмещает 5 поселенцев
  world.houseOccupants[houseCount] = 0;

  // обновляем счётчик домов
  world.houseCount++;
}
