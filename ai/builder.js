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
    agentCount, houseCount
  } = world;

  // 1. Подсчёт общей вместимости жилья
  let totalCap = 0;
  for (let i = 0; i < houseCount; i++) {
    totalCap += houseCapacity[i];
  }

  // 2. Если жилья хватает — ничего не делаем
  const demand = agentCount - totalCap;
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
  world.houseCapacity[houseCount] = 4;  // вмещает 4 поселенца
  world.houseOccupants[houseCount] = 0;

  // обновляем счётчик домов
  world.houseCount++;
}
