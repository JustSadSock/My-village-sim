// sim.worker.js — Web Worker с ядром симуляции (исправленный)

import { init as initFarmer, update as updateFarmer } from './ai/farmer.js';
import { init as initBuilder, update as updateBuilder } from './ai/builder.js';

const MAP_W    = 64;
const MAP_H    = 64;
const MAP_SIZE = MAP_W * MAP_H;

// Тайлы: 0=grass, 1=water, 2=forest, 3=field
const TILE_GRASS  = 0;
const TILE_WATER  = 1;
const TILE_FOREST = 2;
const TILE_FIELD  = 3;

const tiles = new Uint8Array(MAP_SIZE);

// Генерация карты с полями, лесом и водой
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

// === ECS-массивы ===
const MAX_AGENTS = 200;
const posX    = new Uint8Array(MAX_AGENTS);
const posY    = new Uint8Array(MAX_AGENTS);
const age     = new Uint8Array(MAX_AGENTS);
const hunger  = new Uint8Array(MAX_AGENTS);
const thirst  = new Uint8Array(MAX_AGENTS);
const energy  = new Uint8Array(MAX_AGENTS);
const role    = new Uint8Array(MAX_AGENTS); // 0=worker
let agentCount = 0;

// Дома
const MAX_HOUSES      = 50;
const houseX          = new Uint8Array(MAX_HOUSES);
const houseY          = new Uint8Array(MAX_HOUSES);
const houseCapacity   = new Uint8Array(MAX_HOUSES);
const houseOccupants  = new Uint8Array(MAX_HOUSES);
let houseCount = 0;

// Ресурсы — теперь внутри world, чтобы AI мог их менять
let _stockFood = 50;
let _stockWood = 100;

// Вспомогательный объект, который будем передавать AI
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

// Функция-спавн для новых жителей
function spawnAgent(x, y) {
  const i = agentCount++;
  posX[i]   = x;
  posY[i]   = y;
  age[i]    = Math.floor(Math.random() * 30 + 10);
  hunger[i] = thirst[i] = energy[i] = 100;
  role[i]   = 0; // фермер-универсал
}

// Несколько стартовых жителей
for (let i = 0; i < 20; i++) {
  spawnAgent(
    Math.floor(Math.random() * MAP_W),
    Math.floor(Math.random() * MAP_H)
  );
}

// Инициализация модулей AI (им теперь передаётся мир)
initFarmer(world);
initBuilder(world);

// Сообщаем UI о параметрах мира
postMessage({ type: 'init', mapW: MAP_W, mapH: MAP_H, tiles });

// Основной цикл (30 FPS)
let last = performance.now();
function tick() {
  const now = performance.now();
  const dt  = (now - last) / 1000;
  last = now;

  // Обновляем всех агентов
  for (let i = 0; i < agentCount; i++) {
    updateFarmer(i, dt, world);
    updateBuilder(i, dt, world);
  }

  // Формируем статистику
  const stats = {
    pop:  world.agentCount,
    food: world.stockFood,
    wood: world.stockWood
  };

  // Отправляем в UI
  postMessage({
    type:   'update',
    tiles,
    agents: { x: posX.slice(0, agentCount), y: posY.slice(0, agentCount) },
    houses: Array.from({ length: houseCount }, (_, i) => ({
      x: houseX[i], y: houseY[i],
      capacity: houseCapacity[i],
      occupants: houseOccupants[i]
    })),
    stats,
    fps: Math.round(1 / dt)
  });

  setTimeout(tick, 1000 / 30);
}

// Стартуем
tick();