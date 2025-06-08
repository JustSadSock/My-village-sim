// sim.worker.js

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

// Агенты
const MAX_AGENTS = 200;
const posX    = new Uint8Array(MAX_AGENTS);
const posY    = new Uint8Array(MAX_AGENTS);
const age     = new Uint8Array(MAX_AGENTS);
const hunger  = new Uint8Array(MAX_AGENTS);
const thirst  = new Uint8Array(MAX_AGENTS);
const energy  = new Uint8Array(MAX_AGENTS);
const role    = new Uint8Array(MAX_AGENTS);
let   agentCount = 0;

// Дома
const MAX_HOUSES     = 50;
const houseX         = new Uint8Array(MAX_HOUSES);
const houseY         = new Uint8Array(MAX_HOUSES);
const houseCapacity  = new Uint8Array(MAX_HOUSES);
const houseOccupants = new Uint8Array(MAX_HOUSES);
let   houseCount     = 0;

// Ресурсы
let stockFood = 50;
let stockWood = 100;

// Функция спавна
function spawnAgent(x, y) {
  const i = agentCount++;
  posX[i]   = x;
  posY[i]   = y;
  age[i]    = Math.floor(Math.random() * 30 + 10);
  hunger[i] = thirst[i] = energy[i] = 100;
  role[i]   = 0; // универсальный крестьянин
}

// Стартовый спавн
for (let i = 0; i < 20; i++) {
  spawnAgent(
    Math.floor(Math.random() * MAP_W),
    Math.floor(Math.random() * MAP_H)
  );
}

// Инициализация AI-модулей
initFarmer();
initBuilder();

// Первый месседж — чтобы UI знал размеры карты
postMessage({ type: 'init', mapW: MAP_W, mapH: MAP_H, tiles });

// Основной цикл (≈30 FPS)
let last = performance.now();
function tick() {
  const now = performance.now();
  const dt  = (now - last) / 1000;
  last = now;

  // обновляем каждого
  for (let i = 0; i < agentCount; i++) {
    updateFarmer(i, dt, {
      posX, posY, age, hunger, thirst, energy, role,
      MAP_W, MAP_H, tiles,
      stockFood, stockWood,
      agentCount, houseX, houseY, houseCapacity, houseOccupants, houseCount
    });
    updateBuilder(i, dt, {
      posX, posY, age, hunger, thirst, energy, role,
      MAP_W, MAP_H, tiles,
      stockFood, stockWood,
      agentCount, houseX, houseY, houseCapacity, houseOccupants, houseCount
    });
  }

  // шлём статистику в UI
  postMessage({
    type: 'update',
    tiles,
    agents: {
      x: posX.slice(0, agentCount),
      y: posY.slice(0, agentCount)
    },
    houses: Array.from({length: houseCount}, (_, i) => ({
      x: houseX[i],
      y: houseY[i],
      capacity: houseCapacity[i],
      occupants: houseOccupants[i]
    })),
    stats: {
      pop:  agentCount,
      food: stockFood,
      wood: stockWood
    },
    fps: Math.round(1 / dt)
  });

  setTimeout(tick, 1000 / 30);
}
tick();