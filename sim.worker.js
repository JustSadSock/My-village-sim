// sim.worker.js — Web Worker с ядром симуляции (исправлено: убрали смерть от жажды, замедлили падение, режем только по голоду)

import { init as initFarmer, update as updateFarmer } from './ai/farmer.js';
import { init as initBuilder, update as updateBuilder } from './ai/builder.js';

const MAP_W    = 64;
const MAP_H    = 64;
const MAP_SIZE = MAP_W * MAP_H;
const AGE_SPEED = 1 / 60; // 1 year per 60 sec

const TILE_GRASS  = 0;
const TILE_WATER  = 1;
const TILE_FOREST = 2;
const TILE_FIELD  = 3;

// Карта
const tiles = new Uint8Array(MAP_SIZE);
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
const skillFood = new Uint16Array(MAX_AGENTS);
const skillWood = new Uint16Array(MAX_AGENTS);
const workTimer = new Float32Array(MAX_AGENTS);
const jobType  = new Uint8Array(MAX_AGENTS);
const role   = new Uint8Array(MAX_AGENTS);
let agentCount = 0;

// Дома
const MAX_HOUSES     = 50;
const houseX         = new Uint8Array(MAX_HOUSES);
const houseY         = new Uint8Array(MAX_HOUSES);
const houseCapacity  = new Uint8Array(MAX_HOUSES);
const houseOccupants = new Uint8Array(MAX_HOUSES);
let houseCount = 0;

// Ресурсы
let _stockFood = 50;
let _stockWood = 100;
let _priceFood = 1;
let _priceWood = 0.5;

// Мир для AI
const world = {
  MAP_W, MAP_H, tiles, reserved,
  posX, posY, age, hunger, thirst, energy, homeId, skillFood, skillWood, workTimer, jobType, role,
  houseX, houseY, houseCapacity, houseOccupants,
  get agentCount() { return agentCount; },
  set agentCount(v) { agentCount = v; },
  get houseCount() { return houseCount; },
  set houseCount(v) { houseCount = v; },
  get stockFood() { return _stockFood; },
  set stockFood(v) { _stockFood = v; },
  get stockWood() { return _stockWood; },
  set stockWood(v) { _stockWood = v; },
  get priceFood() { return _priceFood; },
  set priceFood(v) { _priceFood = v; },
  get priceWood() { return _priceWood; },
  set priceWood(v) { _priceWood = v; }
};

// Спавн крестьян
function spawnAgent(x, y) {
  const i = agentCount++;
  posX[i]   = x;
  posY[i]   = y;
  age[i]    = Math.random() * 30 + 10;
  hunger[i] = thirst[i] = energy[i] = 100;
  role[i]   = 0;
  homeId[i] = -1;
  skillFood[i]=0;
  skillWood[i]=0;
  workTimer[i]=0; jobType[i]=0;
}
for (let i = 0; i < 20; i++) {
  spawnAgent(
    Math.random() * MAP_W | 0,
    Math.random() * MAP_H | 0
  );
}

// Инициализируем AI
initFarmer(world);
initBuilder(world);

function updatePrices(dt) {
  const baseFood = 1;
  const baseWood = 0.5;
  const targetFood = baseFood * agentCount / Math.max(_stockFood, 1);
  const targetWood = baseWood * agentCount / Math.max(_stockWood, 1);
  _priceFood += (_priceFood ? (targetFood - _priceFood) : targetFood) * 0.1 * dt;
  _priceWood += (_priceWood ? (targetWood - _priceWood) : targetWood) * 0.1 * dt;
  if (Math.random() < dt * 0.1) {
    _priceFood *= 1 + (Math.random() - 0.5) * 0.02;
    _priceWood *= 1 + (Math.random() - 0.5) * 0.02;
  }
  _priceFood = Math.min(Math.max(_priceFood, 0.5), 8);
  _priceWood = Math.min(Math.max(_priceWood, 0.3), 6);
}

// Начальная передача карты
postMessage({ type:'init', mapW:MAP_W, mapH:MAP_H, tiles });

let last = performance.now();
function tick() {
  const now = performance.now();
  const dt  = (now - last) / 1000;
  last = now;

  // 1. Биологические нужды
  for (let i = 0; i < agentCount; i++) {
    hunger[i] = Math.max(0, hunger[i] - dt * 0.5);  // быстрее голодают
    thirst[i] = Math.max(0, thirst[i] - dt * 0.2);  // −0.2 ед/сек
    energy[i] = Math.min(100, energy[i] + dt * 0.5);// +0.5 ед/сек
    age[i]   += dt * AGE_SPEED;

    // смерть от голода или старости
    if (hunger[i] === 0 || age[i] > 70) {
      const lastId = --agentCount;
      if(homeId[i]>=0) houseOccupants[homeId[i]]--;
      posX[i]=posX[lastId]; posY[i]=posY[lastId];
      homeId[i]=homeId[lastId]; if(homeId[i]>=0) houseOccupants[homeId[i]]++;
      age[i]=age[lastId]; hunger[i]=hunger[lastId];
      thirst[i]=thirst[lastId]; energy[i]=energy[lastId];
      skillFood[i]=skillFood[lastId]; skillWood[i]=skillWood[lastId]; workTimer[i]=workTimer[lastId]; jobType[i]=jobType[lastId]; role[i]=role[lastId];
      i--;
      continue;
    }
  }

  // 2. Реген поля и леса (слабенький шанс)
  for (let i = 0; i < MAP_SIZE; i++) {
    if (tiles[i] === TILE_GRASS && Math.random() < 0.0005) {
      tiles[i] = TILE_FIELD;
    }
    if (tiles[i] === TILE_GRASS && Math.random() < 0.0003) {
      tiles[i] = TILE_FOREST;
    }
  }

  updatePrices(dt);

  // 3. Обновляем агентов
  for (let i = 0; i < agentCount; i++) {
    updateFarmer(i, dt, world);
    updateBuilder(i, dt, world);
  }

  // Размножение в домах
  for (let h = 0; h < houseCount && agentCount < MAX_AGENTS; h++) {
    if (houseOccupants[h] >= 2 && houseOccupants[h] < 5 && Math.random() < dt * 0.01) {
      spawnAgent(houseX[h], houseY[h]);
      homeId[agentCount - 1] = h;
      houseOccupants[h]++;
    }
  }

  // 4. Формируем статистику и отправляем её в UI
  postMessage({
    type: 'update',
    tiles,
    agents: {
      x: posX.slice(0, agentCount),
      y: posY.slice(0, agentCount),
      age: age.slice(0, agentCount),
      hunger: hunger.slice(0, agentCount),
      home: homeId.slice(0, agentCount),
      skillFood: skillFood.slice(0, agentCount),
      skillWood: skillWood.slice(0, agentCount)
    },
    houses: Array.from({ length: houseCount }, (_, i) => ({
      x: houseX[i],
      y: houseY[i],
      capacity: houseCapacity[i],
      occupants: houseOccupants[i]
    })),
    stats: { pop: agentCount, food: _stockFood, wood: _stockWood, priceFood: _priceFood, priceWood: _priceWood, houses: houseCount },
    fps: Math.round(1 / dt)
  });

  setTimeout(tick, 1000 / 30);
}

// Стартуем
tick();
