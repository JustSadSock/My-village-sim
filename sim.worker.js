// sim.worker.js — Web Worker с ядром симуляции (исправлено: убрали смерть от жажды, замедлили падение, режем только по голоду)

import { init as initFarmer, update as updateFarmer } from './ai/farmer.js';
import { init as initBuilder, update as updateBuilder } from './ai/builder.js';

const MAP_W    = 64;
const MAP_H    = 64;
const MAP_SIZE = MAP_W * MAP_H;

const TILE_GRASS  = 0;
const TILE_WATER  = 1;
const TILE_FOREST = 2;
const TILE_FIELD  = 3;

// Карта
const tiles = new Uint8Array(MAP_SIZE);
function genMap() {
  for (let i = 0; i < MAP_SIZE; i++) {
    const r = Math.random();
    tiles[i] = r < 0.08
      ? TILE_WATER
      : r < 0.18
        ? TILE_FIELD
        : r < 0.40
          ? TILE_FOREST
          : TILE_GRASS;
  }
}
genMap();

// ECS-массивы
const MAX_AGENTS = 200;
const posX   = new Uint8Array(MAX_AGENTS);
const posY   = new Uint8Array(MAX_AGENTS);
const age    = new Uint8Array(MAX_AGENTS);
const hunger = new Float32Array(MAX_AGENTS);
const thirst = new Float32Array(MAX_AGENTS);
const energy = new Float32Array(MAX_AGENTS);
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

// Мир для AI
const world = {
  MAP_W, MAP_H, tiles,
  posX, posY, age, hunger, thirst, energy, role,
  houseX, houseY, houseCapacity, houseOccupants,
  get agentCount() { return agentCount; },
  set agentCount(v) { agentCount = v; },
  get houseCount() { return houseCount; },
  set houseCount(v) { houseCount = v; },
  get stockFood() { return _stockFood; },
  set stockFood(v) { _stockFood = v; },
  get stockWood() { return _stockWood; },
  set stockWood(v) { _stockWood = v; }
};

// Спавн крестьян
function spawnAgent(x, y) {
  const i = agentCount++;
  posX[i]   = x;
  posY[i]   = y;
  age[i]    = Math.random() * 30 + 10 | 0;
  hunger[i] = thirst[i] = energy[i] = 100;
  role[i]   = 0;
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

// Начальная передача карты
postMessage({ type:'init', mapW:MAP_W, mapH:MAP_H, tiles });

let last = performance.now();
function tick() {
  const now = performance.now();
  const dt  = (now - last) / 1000;
  last = now;

  // 1. Биологические нужды
  for (let i = 0; i < agentCount; i++) {
    hunger[i] = Math.max(0, hunger[i] - dt * 0.2);  // −0.2 ед/сек
    thirst[i] = Math.max(0, thirst[i] - dt * 0.2);  // −0.2 ед/сек
    energy[i] = Math.min(100, energy[i] + dt * 0.5);// +0.5 ед/сек

    // смерть только от голода
    if (hunger[i] === 0) {
      const lastId = --agentCount;
      posX[i]=posX[lastId]; posY[i]=posY[lastId];
      age[i]=age[lastId]; hunger[i]=hunger[lastId];
      thirst[i]=thirst[lastId]; energy[i]=energy[lastId];
      role[i]=role[lastId];
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

  // 3. Обновляем агентов
  for (let i = 0; i < agentCount; i++) {
    updateFarmer(i, dt, world);
    updateBuilder(i, dt, world);
  }

  // 4. Отправляем в UI
  postMessage({
    type: 'update',
    tiles,
    agents: { x: posX.slice(0,agentCount), y: posY.slice(0,agentCount) },
    houses: Array.from({length:houseCount}, (_,i)=>({
      x:houseX[i