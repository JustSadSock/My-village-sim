// sim.worker.js — Web Worker с ядром симуляции

import { init as initFarmer, update as updateFarmer } from './ai/farmer.js';
import { init as initBuilder, update as updateBuilder } from './ai/builder.js';

const MAP_W = 64, MAP_H = 64;
const MAP_SIZE = MAP_W * MAP_H;

// Тайлы: 0=grass, 1=water, 2=forest, 3=field
const tiles = new Uint8Array(MAP_SIZE);

// Максимумы
const MAX_AGENTS = 200;
const MAX_HOUSES = 50;

// Агентские массивы
const posX    = new Uint8Array(MAX_AGENTS);
const posY    = new Uint8Array(MAX_AGENTS);
const age     = new Uint8Array(MAX_AGENTS);
const hunger  = new Uint8Array(MAX_AGENTS);
const thirst  = new Uint8Array(MAX_AGENTS);
const energy  = new Uint8Array(MAX_AGENTS);
const role    = new Uint8Array(MAX_AGENTS); // 0=worker

let agentCount = 0;

// Дома
const houseX         = new Uint8Array(MAX_HOUSES);
const houseY         = new Uint8Array(MAX_HOUSES);
const houseCapacity  = new Uint8Array(MAX_HOUSES);
const houseOccupants = new Uint8Array(MAX_HOUSES);
let houseCount = 0;

// Ресурсы
let stockFood = 50;
let stockWood = 100;

// Генерация карты (лес/вода/трава)
function genMap() {
  for (let i = 0; i < MAP_SIZE; i++) {
    const r = Math.random();
    tiles[i] = r < 0.08 ? 1
             : r < 0.25 ? 2
             : 0;
  }
}
genMap();

// Спавн поселенца
function spawnAgent(x, y) {
  const i = agentCount++;
  posX[i]   = x;
  posY[i]   = y;
  age[i]    = Math.floor(Math.random() * 30 + 10);
  hunger[i] = thirst[i] = energy[i] = 100;
  role[i]   = 0; // фермер-по умолчанию
}

// Несколько стартовых жителей
for (let i = 0; i < 20; i++) {
  spawnAgent(
    Math.floor(Math.random() * MAP_W),
    Math.floor(Math.random() * MAP_H)
  );
}

// Инициализация модулей AI
initFarmer();
initBuilder();

// Сообщаем UI о параметрах мира
postMessage({ type: 'init', mapW: MAP_W, mapH: MAP_H, tiles });

// Основной цикл (30 FPS)
let last = Date.now();
function tick() {
  const now = Date.now();
  const dt  = (now - last) / 1000;
  last = now;

  // Обновляем агентов
  for (let i = 0; i < agentCount; i++) {
    // сначала фермерская логика
    updateFarmer(i, dt, {
      posX, posY, age, hunger, thirst, energy, role,
      MAP_W, MAP_H, tiles,
      stockFood, stockWood,
      houseX, houseY, houseCapacity, houseOccupants,
      agentCount, houseCount
    });
    // затем строители (если переключились)
    updateBuilder(i, dt, {
      posX, posY, age, hunger, thirst, energy, role,
      MAP_W, MAP_H, tiles,
      stockFood, stockWood,
      houseX, houseY, houseCapacity, houseOccupants,
      agentCount, houseCount
    });
  }

  // Статистика
  const stats = {
    pop:  agentCount,
    food: stockFood,
    wood: stockWood
  };

  // Передаём в UI текущий стейт
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
    fps: Math.round(1000 / (dt * 1000))
  });

  setTimeout(tick, 1000 / 30);
}

// Старт
tick();
