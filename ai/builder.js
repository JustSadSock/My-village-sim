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

  // 4. Ищем первую свободную клетку травы (tiles[i] === 0)
  let buildX = -1, buildY = -1;
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === 0) {
      buildX = i % MAP_W;
      buildY = (i / MAP_W) | 0;
      break;
    }
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
