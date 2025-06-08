// sim.worker.js — обновлённое ядро: реген полей/леса, голод/жажда, динамический выбор работы

import { init as initFarmer, update as updateFarmer } from './ai/farmer.js';
import { init as initBuilder, update as updateBuilder } from './ai/builder.js';

const MAP_W    = 64;
const MAP_H    = 64;
const MAP_SIZE = MAP_W * MAP_H;

const TILE_GRASS  = 0;
const TILE_WATER  = 1;
const TILE_FOREST = 2;
const TILE_FIELD  = 3;

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
const hunger = new Uint8Array(MAX_AGENTS);
const thirst = new Uint8Array(MAX_AGENTS);
const energy = new Uint8Array(MAX_AGENTS);
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
  set stockWood(v) { _stockWood = v; },
  fieldCount: 0,
  forestCount: 0
};

function spawnAgent(x, y) {
  const i = agentCount++;
  posX[i] = x; posY[i] = y;
  age[i] = Math.random() * 30 + 10 | 0;
  hunger[i] = thirst[i] = energy[i] = 100;
  role[i] = 0;
}
for (let i = 0; i < 20; i++) {
  spawnAgent(
    Math.random() * MAP_W | 0,
    Math.random() * MAP_H | 0
  );
}

initFarmer(world);
initBuilder(world);
postMessage({ type:'init', mapW:MAP_W, mapH:MAP_H, tiles });

let last = performance.now();
function tick() {
  const now = performance.now();
  const dt  = (now - last) / 1000;
  last = now;

  // 1. Голод и жажда
  for (let i = 0; i < agentCount; i++) {
    hunger[i] = Math.max(0, hunger[i] - dt * 2);   // −2 единицы в секунду
    thirst[i] = Math.max(0, thirst[i] - dt * 3);   // −3 ед.
    energy[i] = Math.min(100, energy[i] + dt * 1); // +1 ед. в сек. (отдых)
    // смерть от голода/жажды
    if (hunger[i] === 0 || thirst[i] === 0) {
      // убираем агента и сдвигаем последний на место i
      const lastId = --agentCount;
      posX[i]=posX[lastId]; posY[i]=posY[lastId];
      age[i]=age[lastId]; hunger[i]=hunger[lastId];
      thirst[i]=thirst[lastId]; energy[i]=energy[lastId];
      role[i]=role[lastId];
      i--; 
      continue;
    }
  }

  // 2. Реген полей и леса (ежесекундно)
  for (let i = 0; i < MAP_SIZE; i++) {
    if (tiles[i] === TILE_GRASS && Math.random() < 0.0005) {
      tiles[i] = TILE_FIELD;         // мелкое "автопосев"
    }
    if (tiles[i] === TILE_GRASS && Math.random() < 0.0003) {
      tiles[i] = TILE_FOREST;        // случайный рост деревьев
    }
  }

  // 3. Считаем остатки полей/леса
  let fC=0, F=0;
  for (let t of tiles) {
    if (t === TILE_FIELD) fC++;
    else if (t === TILE_FOREST) F++;
  }
  world.fieldCount  = fC;
  world.forestCount = F;

  // 4. Обновляем агентов
  for (let i = 0; i < agentCount; i++) {
    updateFarmer(i, dt, world);
    updateBuilder(i, dt, world);
  }

  // 5. Отправляем UI
  postMessage({
    type: 'update',
    tiles,
    agents: { x: posX.slice(0,agentCount), y: posY.slice(0,agentCount) },
    houses: Array.from({length:houseCount}, (_,i)=>({
      x:houseX[i], y:houseY[i],
      capacity:houseCapacity[i],
      occupants:houseOccupants[i]
    })),
    stats: { pop:agentCount, food:_stockFood, wood:_stockWood },
    fps: Math.round(1/dt)
  });

  setTimeout(tick, 1000/30);
}
tick();