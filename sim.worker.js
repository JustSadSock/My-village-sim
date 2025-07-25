// sim.worker.js — Web Worker с ядром симуляции (исправлено: убрали смерть от жажды, замедлили падение, режем только по голоду)

import { init as initFarmer, update as updateFarmer } from './ai/farmer.js';
import { init as initBuilder, update as updateBuilder } from './ai/builder.js';
import { init as initTrader, update as updateTrader } from './ai/trader.js';
import { clearPathCache } from './ai/path.js';
import { emit, eventQueue } from './events/events.js';
import { TILE_GRASS, TILE_WATER, TILE_FOREST, TILE_FIELD,
         TILE_FIELD_GROW, TILE_FOREST_GROW } from './data/constants.js';
import { serializeWorld, deserializeWorld } from './utils/stateStorage.js';

const MAP_W    = 64;
const MAP_H    = 64;
const MAP_SIZE = MAP_W * MAP_H;
// AGE_SPEED определяет скорость старения.
// Значение 1/60 означает, что один игровой год длится 60 секунд реального времени.
// После 50 лет скорость работы постепенно снижается, а после 70 лет жители умирают.
const AGE_SPEED = 1 / 60;
const HUNGER_RATE = 100 / 60; // 100 hunger per year
const FIELD_GROW_TIME = 30;  // время созревания поля
const FOREST_GROW_TIME = 60; // время отрастания леса
const HOUSE_CAPACITY = 5;    // вместимость одного дома
const HOUSE_WOOD_COST = 15;  // стоимость постройки дома в дереве

// Sliding window for production/consumption statistics
const STATS_TICKS = 60;
const foodInHist  = new Float32Array(STATS_TICKS).fill(0);
const foodOutHist = new Float32Array(STATS_TICKS).fill(0);
const woodInHist  = new Float32Array(STATS_TICKS).fill(0);
const woodOutHist = new Float32Array(STATS_TICKS).fill(0);
let statsIdx = 0;
let tickFoodIn = 0, tickFoodOut = 0, tickWoodIn = 0, tickWoodOut = 0;

const DAY_LENGTH = 120; // seconds per full day
// Начинаем утро, чтобы жители сразу были активны
let worldTime = DAY_LENGTH * 6 / 24; // current time in seconds


// Карта
const tiles = new Uint8Array(MAP_SIZE);
const tileTimer = new Float32Array(MAP_SIZE).fill(0);
function addTerrain(type, seeds, steps) {
  for (let s = 0; s < seeds; s++) {
    let x = Math.random() * MAP_W | 0;
    let y = Math.random() * MAP_H | 0;
    for (let i = 0; i < steps; i++) {
      tiles[y * MAP_W + x] = type;
      if (Math.random() < 0.7) {
        x += (Math.random() * 3 | 0) - 1;
        y += (Math.random() * 3 | 0) - 1;
        if (x < 0) x = 0; if (x >= MAP_W) x = MAP_W - 1;
        if (y < 0) y = 0; if (y >= MAP_H) y = MAP_H - 1;
      }
    }
  }
}

function genMap() {
  tiles.fill(TILE_GRASS);
  addTerrain(TILE_WATER, 8, 60);
  addTerrain(TILE_FIELD, 10, 80);
  addTerrain(TILE_FOREST, 12, 100);
}
genMap();
const reserved = new Int16Array(MAP_SIZE).fill(-1);

// ECS-массивы
const MAX_AGENTS = 200;
const posX   = new Uint8Array(MAX_AGENTS);
const posY   = new Uint8Array(MAX_AGENTS);
const age    = new Float32Array(MAX_AGENTS);
const hunger = new Float32Array(MAX_AGENTS);
const thirst = new Float32Array(MAX_AGENTS);
const energy = new Float32Array(MAX_AGENTS);
const homeId = new Int16Array(MAX_AGENTS);
const parentA = new Int16Array(MAX_AGENTS);
const parentB = new Int16Array(MAX_AGENTS);
const spouse  = new Int16Array(MAX_AGENTS);
const skillFood = new Uint16Array(MAX_AGENTS);
const skillWood = new Uint16Array(MAX_AGENTS);
const workTimer = new Float32Array(MAX_AGENTS);
const jobType  = new Uint8Array(MAX_AGENTS);
const role   = new Uint8Array(MAX_AGENTS);
const buildX  = new Int16Array(MAX_AGENTS);
const buildY  = new Int16Array(MAX_AGENTS);
const morale  = new Float32Array(MAX_AGENTS).fill(100);
const friend  = new Int16Array(MAX_AGENTS).fill(-1);
let agentCount = 0;

// Дома
const MAX_HOUSES     = 50;
const houseX         = new Uint8Array(MAX_HOUSES);
const houseY         = new Uint8Array(MAX_HOUSES);
const houseCapacity  = new Uint8Array(MAX_HOUSES);
const houseOccupants = new Uint8Array(MAX_HOUSES);
let houseCount = 0;

// Склады
const MAX_STORES = 10;
const storeX     = new Uint8Array(MAX_STORES);
const storeY     = new Uint8Array(MAX_STORES);
const storeSize  = new Uint8Array(MAX_STORES);
const storeFood  = new Uint16Array(MAX_STORES);
const storeWood  = new Uint16Array(MAX_STORES);
let storeCount = 0;

// Рынки
const MAX_MARKETS = 5;
const marketX = new Uint8Array(MAX_MARKETS);
const marketY = new Uint8Array(MAX_MARKETS);
let marketCount = 0;

const MAX_CORPSES = 50;
const corpseX = new Uint8Array(MAX_CORPSES);
const corpseY = new Uint8Array(MAX_CORPSES);
const corpseTimer = new Float32Array(MAX_CORPSES);
let corpseCount = 0;

const carryFood  = new Uint8Array(MAX_AGENTS);
const carryWood  = new Uint8Array(MAX_AGENTS);

// Ресурсы
let _stockFood = 50;
let _stockWood = 100;
let _priceFood = 1;
let _priceWood = 1;

// Мир для AI
const world = {
  MAP_W, MAP_H, tiles, tileTimer, reserved,
  posX, posY, age, hunger, thirst, energy, homeId, parentA, parentB, spouse,
  skillFood, skillWood, workTimer, jobType, role,
  buildX, buildY, morale, friend,
  get time() { return (worldTime / DAY_LENGTH) * 24; },
  set time(v) { worldTime = (v / 24) * DAY_LENGTH; },
  houseX, houseY, houseCapacity, houseOccupants,
  storeX, storeY, storeSize, storeFood, storeWood,
  marketX, marketY,
  corpseX, corpseY, corpseTimer,
  get agentCount() { return agentCount; },
  set agentCount(v) { agentCount = v; },
  get houseCount() { return houseCount; },
  set houseCount(v) { houseCount = v; },
  get storeCount() { return storeCount; },
  set storeCount(v) { storeCount = v; },
  get marketCount() { return marketCount; },
  set marketCount(v) { marketCount = v; },
  get stockFood() { return _stockFood; },
  set stockFood(v) {
    if (v > _stockFood) tickFoodIn += v - _stockFood;
    else if (v < _stockFood) tickFoodOut += _stockFood - v;
    _stockFood = v;
  },
  get stockWood() { return _stockWood; },
  set stockWood(v) {
    if (v > _stockWood) tickWoodIn += v - _stockWood;
    else if (v < _stockWood) tickWoodOut += _stockWood - v;
    _stockWood = v;
  },
  carryFood, carryWood,
  get priceFood() { return _priceFood; },
  set priceFood(v) { _priceFood = v; },
  get priceWood() { return _priceWood; },
  set priceWood(v) { _priceWood = v; },
  deposit(storeIndex, food = 0, wood = 0) {
    food = Math.max(0, food);
    wood = Math.max(0, wood);
    if (storeIndex < 0 || storeIndex >= storeCount) return 0;
    const cap = storeSize[storeIndex] * 100;
    const used = storeFood[storeIndex] + storeWood[storeIndex];
    let free = cap - used;
    let deposited = 0;
    if (food > 0 && free > 0) {
      const df = Math.min(food, free);
      storeFood[storeIndex] += df;
      _stockFood += df;
      tickFoodIn += df;
      free -= df;
      deposited += df;
    }
    if (wood > 0 && free > 0) {
      const dw = Math.min(wood, free);
      storeWood[storeIndex] += dw;
      _stockWood += dw;
      tickWoodIn += dw;
      deposited += dw;
    }
    return deposited;
  },
  withdraw(storeIndex, food = 0, wood = 0) {
    food = Math.max(0, food);
    wood = Math.max(0, wood);
    if (storeIndex < 0 || storeIndex >= storeCount) return false;
    if (food > storeFood[storeIndex] || wood > storeWood[storeIndex]) return false;
    storeFood[storeIndex] -= food;
    storeWood[storeIndex] -= wood;
    _stockFood -= food;
    _stockWood -= wood;
    tickFoodOut += food;
    tickWoodOut += wood;
    return true;
  }
};

// Спавн крестьян
function spawnAgent(x, y, a = Math.random() * 30 + 10) {
  const i = agentCount++;
  posX[i]   = x;
  posY[i]   = y;
  age[i]    = a;
  hunger[i] = thirst[i] = energy[i] = 100;
  role[i]   = Math.random() < 0.3 ? 1 : 0;
  homeId[i] = -1;
  parentA[i] = -1;
  parentB[i] = -1;
  spouse[i]  = -1;
  skillFood[i]=0;
  skillWood[i]=0;
  workTimer[i]=0; jobType[i]=0;
  buildX[i] = -1; buildY[i] = -1;
  carryFood[i]=0; carryWood[i]=0;
  morale[i] = 100;
  friend[i] = -1;
}
for (let i = 0; i < 20; i++) {
  spawnAgent(
    Math.random() * MAP_W | 0,
    Math.random() * MAP_H | 0
  );
}

// начальный склад в центре карты
placeBuilding('store', (MAP_W / 2) | 0, (MAP_H / 2) | 0);

// раздаём немного еды поселенцам и складируем остаток
let foodLeft = _stockFood;
let woodLeft = _stockWood;
for (let i = 0; i < agentCount && foodLeft > 0; i++) {
  carryFood[i] = 1;
  foodLeft--;
}
_stockFood = 0;
_stockWood = 0;
world.deposit(0, foodLeft, woodLeft);

function placeBuilding(type, x, y) {
  if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return;
  for (let i = 0; i < houseCount; i++) if (houseX[i] === x && houseY[i] === y) return;
  for (let i = 0; i < storeCount; i++) if (storeX[i] === x && storeY[i] === y) return;
  for (let i = 0; i < marketCount; i++) if (marketX[i] === x && marketY[i] === y) return;
  if (tiles[y * MAP_W + x] !== TILE_GRASS) return;
  if (type === 'house' && _stockWood >= HOUSE_WOOD_COST && houseCount < MAX_HOUSES) {
    houseX[houseCount] = x;
    houseY[houseCount] = y;
    houseCapacity[houseCount] = HOUSE_CAPACITY;
    houseOccupants[houseCount] = 0;
    houseCount++;
    _stockWood -= HOUSE_WOOD_COST;
  } else if (type === 'store' && _stockWood >= 20 && storeCount < MAX_STORES) {
    storeX[storeCount] = x;
    storeY[storeCount] = y;
    storeSize[storeCount] = 4;
    storeFood[storeCount] = 0;
    storeWood[storeCount] = 0;
    storeCount++;
    _stockWood -= 20;
  } else if (type === 'field') {
    tiles[y * MAP_W + x] = TILE_FIELD;
  } else if (type === 'market' && _stockWood >= 30 && marketCount < MAX_MARKETS) {
    marketX[marketCount] = x;
    marketY[marketCount] = y;
    marketCount++;
    _stockWood -= 30;
  }
}

// Инициализируем AI
initFarmer(world);
initBuilder(world);
initTrader(world);

function updatePrices(dt) {
  const supplyFood = foodInHist.reduce((a, b) => a + b, 0);
  const demandFood = foodOutHist.reduce((a, b) => a + b, 0);
  const supplyWood = woodInHist.reduce((a, b) => a + b, 0);
  const demandWood = woodOutHist.reduce((a, b) => a + b, 0);

  // прогноз роста населения в ближайшую минуту
  let potential = 0;
  for (let h = 0; h < houseCount; h++) {
    if (houseOccupants[h] >= 2 && houseOccupants[h] < houseCapacity[h]) potential++;
  }
  const futurePop = agentCount + potential * 0.01 * 60; // вероятность рождения
  const popFactor = futurePop / Math.max(agentCount, 1);

  // оценка потребности в дереве с учетом нехватки жилья
  let totalCapacity = 0;
  for (let h = 0; h < houseCount; h++) totalCapacity += houseCapacity[h];
  const neededCapacity = futurePop - totalCapacity;
  const toBuild = Math.max(0, Math.ceil(neededCapacity / HOUSE_CAPACITY));
  const desiredHouses = houseCount + toBuild;
  const futureWoodNeed = toBuild * HOUSE_WOOD_COST;

  const foodDeficit = Math.max(0, agentCount * 2 - _stockFood);
  const woodDeficit = Math.max(0, futureWoodNeed - _stockWood);

  const ratioFood = (demandFood + foodDeficit + 0.1) / (supplyFood + 0.1);
  const ratioWood = (demandWood + woodDeficit * 0.5 + 0.1) / (supplyWood + 0.1);

  const targetFood = ratioFood * popFactor * agentCount / Math.max(_stockFood + foodDeficit, 1);
  const targetWood = ratioWood * agentCount / Math.max(_stockWood + woodDeficit, 1);

  _priceFood += (targetFood - _priceFood) * dt * 3;
  _priceWood += (targetWood - _priceWood) * dt * 3;
  if (Math.random() < dt * 0.2) {
    _priceFood *= 1 + (Math.random() - 0.5) * 0.2;
    _priceWood *= 1 + (Math.random() - 0.5) * 0.2;
  }
  _priceFood = Math.min(Math.max(_priceFood, 0.0001), 1000);
  _priceWood = Math.min(Math.max(_priceWood, 0.0001), 1000);
}

function recordStats() {
  foodInHist[statsIdx] = tickFoodIn;
  foodOutHist[statsIdx] = tickFoodOut;
  woodInHist[statsIdx] = tickWoodIn;
  woodOutHist[statsIdx] = tickWoodOut;
  statsIdx = (statsIdx + 1) % STATS_TICKS;
  tickFoodIn = tickFoodOut = tickWoodIn = tickWoodOut = 0;
}

// Начальная передача карты
postMessage({ type:'init', mapW:MAP_W, mapH:MAP_H, tiles });

let last = performance.now();
let gameSpeed = 1;
self.onmessage = e => {
  if (e.data && e.data.type === 'speed') gameSpeed = e.data.value;
  if (e.data && e.data.type === 'place') {
    placeBuilding(e.data.what, e.data.x, e.data.y);
  }
  if (e.data && e.data.type === 'set-role') {
    const id = e.data.id;
    if (id >= 0 && id < agentCount) role[id] = e.data.role;
  }
  if (e.data && e.data.type === 'save') {
    const state = serializeWorld(world);
    postMessage({ type: 'save', state });
  }
  if (e.data && e.data.type === 'load') {
    deserializeWorld(world, e.data.state);
  }
};
function tick() {
  recordStats();
  clearPathCache(agentCount * 10);
  const now = performance.now();
  const dt  = (now - last) / 1000 * gameSpeed;
  last = now;
  worldTime = (worldTime + dt) % DAY_LENGTH;

  // 1. Биологические нужды
  for (let i = 0; i < agentCount; i++) {
    const hungerRate = HUNGER_RATE * (age[i] < 10 ? 0.5 : 1);
    hunger[i] = Math.max(0, hunger[i] - dt * hungerRate);
    thirst[i] = Math.max(0, thirst[i] - dt * 0.2);  // −0.2 ед/сек
    energy[i] = Math.min(100, energy[i] + dt * 0.5);// +0.5 ед/сек
    morale[i] = Math.min(100, morale[i] + dt * 0.5);
    if (hunger[i] < 30 || thirst[i] < 30 || energy[i] < 20)
      morale[i] = Math.max(0, morale[i] - dt * 5);
    // старение происходит непрерывно: 1 игровой год = 60 секунд
    age[i]   += dt * AGE_SPEED;

    // смерть от голода или старости
    if (hunger[i] === 0 || age[i] > 70) {
      const deadInfo = { id: i, x: posX[i], y: posY[i] };
      if (corpseCount < MAX_CORPSES) {
        corpseX[corpseCount] = posX[i];
        corpseY[corpseCount] = posY[i];
        corpseTimer[corpseCount] = 60;
        corpseCount++;
      }
      if (spouse[i] >= 0 && spouse[spouse[i]] === i) spouse[spouse[i]] = -1;
      const lastId = --agentCount;
      if(homeId[i]>=0) houseOccupants[homeId[i]]--;
      posX[i]=posX[lastId]; posY[i]=posY[lastId];
      homeId[i]=homeId[lastId]; if(homeId[i]>=0) houseOccupants[homeId[i]]++;
      parentA[i]=parentA[lastId]; parentB[i]=parentB[lastId]; spouse[i]=spouse[lastId];
      age[i]=age[lastId]; hunger[i]=hunger[lastId];
      thirst[i]=thirst[lastId]; energy[i]=energy[lastId];
      skillFood[i]=skillFood[lastId]; skillWood[i]=skillWood[lastId]; workTimer[i]=workTimer[lastId]; jobType[i]=jobType[lastId]; role[i]=role[lastId];
      buildX[i]=buildX[lastId]; buildY[i]=buildY[lastId];
      carryFood[i]=carryFood[lastId]; carryWood[i]=carryWood[lastId];
      morale[i]=morale[lastId]; friend[i]=friend[lastId];
      for (let r = 0; r < reserved.length; r++) if (reserved[r] === i) reserved[r] = -1;
      for (let f = 0; f < agentCount; f++) {
        if (friend[f] === lastId) friend[f] = i;
        if (friend[f] >= agentCount) friend[f] = -1;
      }
      emit('death', deadInfo);
      i--;
      continue;
    }
  }

  // очищаем устаревшие бронировки плиток после смерти жителей
  for (let i = 0; i < reserved.length; i++) {
    if (reserved[i] >= agentCount) reserved[i] = -1;
  }

  // 2. Регенерация ресурсов
  for (let i = 0; i < MAP_SIZE; i++) {
    if (tileTimer[i] > 0) {
      tileTimer[i] -= dt;
      if (tileTimer[i] <= 0) {
        if (tiles[i] === TILE_FIELD_GROW) tiles[i] = TILE_FIELD;
        else if (tiles[i] === TILE_FOREST_GROW) tiles[i] = TILE_FOREST;
      }
    } else {
      if (tiles[i] === TILE_GRASS && Math.random() < 0.0005 * dt) {
        tiles[i] = TILE_FIELD;
      }
      if (tiles[i] === TILE_GRASS && Math.random() < 0.0003 * dt) {
        tiles[i] = TILE_FOREST;
      }
    }
  }

  updatePrices(dt);

  for (let c = 0; c < corpseCount; c++) {
    corpseTimer[c] -= dt;
    if (corpseTimer[c] <= 0) {
      corpseX[c] = corpseX[corpseCount - 1];
      corpseY[c] = corpseY[corpseCount - 1];
      corpseTimer[c] = corpseTimer[corpseCount - 1];
      corpseCount--;
      c--;
    }
  }

  // 3. Обновляем агентов
  for (let i = 0; i < agentCount; i++) {
    if (role[i] === 1) updateBuilder(i, dt, world);
    else if (role[i] === 2) updateTrader(i, dt, world);
    else updateFarmer(i, dt, world);
  }

  // Размножение в домах
  for (let h = 0; h < houseCount && agentCount < MAX_AGENTS; h++) {
    if (houseOccupants[h] >= 2 && houseOccupants[h] < houseCapacity[h]) {
      const adults = [];
      for (let i = 0; i < agentCount; i++) {
        if (homeId[i] === h && age[i] >= 16 && age[i] <= 45) adults.push(i);
      }
      if (adults.length >= 2 && Math.random() < dt * 0.01) {
        let pair = null;
        for (let a = 0; a < adults.length && !pair; a++) {
          for (let b = a + 1; b < adults.length && !pair; b++) {
            const i = adults[a], j = adults[b];
            if (spouse[i] === j || spouse[j] === i || friend[i] === j || friend[j] === i) pair = [i, j];
          }
        }
        const p1 = pair ? pair[0] : adults[Math.random() * adults.length | 0];
        let p2 = pair ? pair[1] : p1;
        while (!pair && p2 === p1) p2 = adults[Math.random() * adults.length | 0];
        const child = agentCount;
        spawnAgent(houseX[h], houseY[h], 0);
        homeId[child] = h;
        parentA[child] = p1;
        parentB[child] = p2;
        spouse[child]  = -1;
        emit('birth', { id: child, x: houseX[h], y: houseY[h] });
        if (spouse[p1] === -1) spouse[p1] = p2;
        if (spouse[p2] === -1) spouse[p2] = p1;
        houseOccupants[h]++;
      }
    }
  }

  // Взаимодействие и обмен опытом
  const cellMap = new Map();
  for (let i = 0; i < agentCount; i++) {
    const key = posX[i] + "," + posY[i];
    if (!cellMap.has(key)) cellMap.set(key, []);
    cellMap.get(key).push(i);
  }
  for (const list of cellMap.values()) {
    if (list.length < 2) continue;
    for (let a = 0; a < list.length; a++) {
      for (let b = a + 1; b < list.length; b++) {
        const i = list[a], j = list[b];
        if (skillFood[i] > skillFood[j] + 2 && Math.random() < 0.1) skillFood[j]++;
        if (skillFood[j] > skillFood[i] + 2 && Math.random() < 0.1) skillFood[i]++;
        if (skillWood[i] > skillWood[j] + 2 && Math.random() < 0.1) skillWood[j]++;
        if (skillWood[j] > skillWood[i] + 2 && Math.random() < 0.1) skillWood[i]++;
        if (friend[i] === j || friend[j] === i || spouse[i] === j || spouse[j] === i) {
          morale[i] = Math.min(100, morale[i] + 2);
          morale[j] = Math.min(100, morale[j] + 2);
        } else if (Math.random() < 0.01) {
          if (friend[i] === -1) friend[i] = j;
          if (friend[j] === -1) friend[j] = i;
        }
      }
    }
  }

  // 4. Формируем статистику и отправляем её в UI
  postMessage({
    type: 'update',
    tiles,
    events: eventQueue.splice(0, eventQueue.length),
    agents: {
      x: posX.slice(0, agentCount),
      y: posY.slice(0, agentCount),
      age: age.slice(0, agentCount),
      hunger: hunger.slice(0, agentCount),
      home: homeId.slice(0, agentCount),
      skillFood: skillFood.slice(0, agentCount),
      skillWood: skillWood.slice(0, agentCount),
      job: jobType.slice(0, agentCount)
    },
    houses: Array.from({ length: houseCount }, (_, i) => ({
      x: houseX[i],
      y: houseY[i],
      capacity: houseCapacity[i],
      occupants: houseOccupants[i]
    })),
    stores: Array.from({ length: storeCount }, (_, i) => ({
      x: storeX[i],
      y: storeY[i],
      size: storeSize[i],
      food: storeFood[i],
      wood: storeWood[i]
    })),
    markets: Array.from({ length: marketCount }, (_, i) => ({
      x: marketX[i],
      y: marketY[i]
    })),
    corpses: Array.from({ length: corpseCount }, (_, i) => ({
      x: corpseX[i],
      y: corpseY[i]
    })),
    stats: { pop: agentCount, food: _stockFood, wood: _stockWood, priceFood: _priceFood, priceWood: _priceWood, houses: houseCount, stores: storeCount, markets: marketCount },
    fps: Math.round(1 / dt)
  });

  setTimeout(tick, 1000 / 30);
}

// Стартуем
tick();
