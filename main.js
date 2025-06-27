// main.js — UI и рендер, оптимизировано для мобильных

import { TILE_GRASS, TILE_WATER, TILE_FOREST, TILE_FIELD,
         TILE_FIELD_GROW, TILE_FOREST_GROW } from './data/constants.js';
import { JOBS } from './data/jobTypes.js';
import { saveGame, loadGame, hasSavedGame, getSaveInfo } from './utils/stateStorage.js';

class SoundManager {
  constructor() {
    this.sounds = {
      birth: new Audio('assets/birth.wav'),
      death: new Audio('assets/death.wav'),
      build: new Audio('assets/build.wav'),
    };
  }
  play(name) {
    const snd = this.sounds[name];
    if (snd) {
      try {
        snd.currentTime = 0;
      } catch (e) {}
      snd.play().catch(() => {});
    }
  }
}
const sound = new SoundManager();
const worker = new Worker('sim.worker.js', { type: 'module' });
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const hud = {
  pop:    document.getElementById('pop'),
  food:   document.getElementById('food'),
  wood:   document.getElementById('wood'),
  priceFood: document.getElementById('price-food'),
  priceWood: document.getElementById('price-wood'),
  houses: document.getElementById('houses'),
  fps:    document.getElementById('fps'),
};
const panel = document.getElementById('villagers');
const agentInfo = document.getElementById('agent-info');
const detailsBtn = document.getElementById('details-btn');
const speedControls = document.getElementById('speed-controls');
const buildControls = document.getElementById('build-controls');
const traderBtn = document.getElementById('trader-btn');
const saveBtn = document.getElementById('save-btn');
const loadBtn = document.getElementById('load-btn');
const notifications = document.createElement('div');
notifications.id = 'notifications';
document.body.appendChild(notifications);

const loadModal = document.getElementById('load-modal');


function notify(text) {
  const div = document.createElement('div');
  div.className = 'notification';
  div.textContent = text;
  notifications.appendChild(div);
  setTimeout(() => div.remove(), 4000);
}

function showLoadPrompt() {
  const info = getSaveInfo();
  if (!info) return;
  const date = info.savedAt ? new Date(info.savedAt) : null;
  const text = date ? `Load game from ${date.toLocaleString()}?` : 'Load saved game?';
  loadModal.innerHTML = '';
  const msg = document.createElement('div');
  msg.textContent = text;
  const btns = document.createElement('div');
  const yes = document.createElement('button');
  yes.textContent = 'Load';
  yes.addEventListener('click', () => {
    loadGame(worker);
    loadModal.style.display = 'none';
  });
  const no = document.createElement('button');
  no.textContent = 'Cancel';
  no.addEventListener('click', () => {
    loadModal.style.display = 'none';
  });
  btns.appendChild(yes);
  btns.appendChild(no);
  loadModal.appendChild(msg);
  loadModal.appendChild(btns);
  loadModal.style.display = 'block';
}

let mapW = 0, mapH = 0;

let animTimer = 0;
let zoom = 1;

// более мягкие цвета тайлов и простые функции рисования
const TILE_COLORS = {
  grass:  '#3b963b',
  water:  '#3093ff',
  forest: '#2e7b2e',
  field:  '#cfa447',
  fieldGrow: '#9c7c32',
  forestGrow: '#1f5d1f'
};

function drawHouse(x, y, ts) {
  ctx.fillStyle = '#b57a40';
  ctx.fillRect(x * ts + ts * 0.1, y * ts + ts * 0.4, ts * 0.8, ts * 0.6);
  ctx.fillStyle = '#8a4a2f';
  ctx.beginPath();
  ctx.moveTo(x * ts + ts * 0.05, y * ts + ts * 0.4);
  ctx.lineTo(x * ts + ts / 2, y * ts + ts * 0.05);
  ctx.lineTo(x * ts + ts * 0.95, y * ts + ts * 0.4);
  ctx.closePath();
  ctx.fill();
}

function drawStore(x, y, ts) {
  ctx.fillStyle = '#777';
  ctx.fillRect(x * ts + ts * 0.1, y * ts + ts * 0.1, ts * 0.8, ts * 0.8);
  ctx.strokeStyle = '#fff';
  ctx.setLineDash([ts * 0.2, ts * 0.2]);
  ctx.strokeRect(x * ts + ts * 0.1, y * ts + ts * 0.1, ts * 0.8, ts * 0.8);
  ctx.setLineDash([]);
}

function drawMarket(x, y, ts) {
  ctx.fillStyle = '#cdbb3b';
  ctx.fillRect(x * ts + ts * 0.05, y * ts + ts * 0.2, ts * 0.9, ts * 0.6);
  ctx.fillStyle = '#946b2d';
  ctx.beginPath();
  ctx.moveTo(x * ts + ts * 0.05, y * ts + ts * 0.2);
  ctx.lineTo(x * ts + ts * 0.5, y * ts + ts * 0.05);
  ctx.lineTo(x * ts + ts * 0.95, y * ts + ts * 0.2);
  ctx.closePath();
  ctx.fill();
}

function drawCorpse(x, y, ts) {
  ctx.fillStyle = '#aa2222';
  ctx.beginPath();
  ctx.arc(x * ts + ts / 2, y * ts + ts / 2, ts * 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawVillager(x, y, ts, old) {
  const shade = animTimer % 1 < 0.5 ? 238 : 220;
  ctx.fillStyle = old ? '#ccc' : `rgb(${shade},${shade},${shade})`;
  ctx.beginPath();
  ctx.arc(x * ts + ts / 2, y * ts + ts / 2, ts * 0.4, 0, Math.PI * 2);
  ctx.fill();
}
let tiles, agents = { x: [], y: [], age: [], hunger: [], home: [], skillFood: [], skillWood: [], job: [] },
    houses = [], stores = [], markets = [], corpses = [];
let stats = { pop: 0, food: 0, wood: 0, priceFood: 0, priceWood: 0, houses: 0, stores: 0, markets: 0 }, fps = 0;
let lastTime = performance.now();
// убираем смену дня и ночи

// учёт DPR для чётких пикселей
const dpr = Math.min(window.devicePixelRatio || 1, 2);
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// переключение панели с жителями
function togglePanel() {
  const open = panel.style.display === 'none';
  panel.style.display = open ? 'block' : 'none';
  detailsBtn.classList.toggle('active', open);
}
window.addEventListener('keydown', e => {
  if (e.key === 'v') togglePanel();
});
detailsBtn.addEventListener('click', togglePanel);
if (speedControls) {
  const defaultBtn = speedControls.querySelector('[data-s="1"]');
  if (defaultBtn) defaultBtn.classList.add('active');
  speedControls.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const v = btn.getAttribute('data-s');
    if (v !== null) {
      worker.postMessage({type:'speed', value: Number(v)});
      speedControls.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
  });
}
if (buildControls) {
  buildControls.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const mode = btn.getAttribute('data-build');
    if (mode) {
      buildMode = mode;
      buildControls.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
  });
}
if (traderBtn) {
  traderBtn.addEventListener('click', () => {
    if (assignRole === JOBS.TRADER) {
      assignRole = null;
      traderBtn.classList.remove('active');
    } else {
      assignRole = JOBS.TRADER;
      traderBtn.classList.add('active');
    }
  });
}
if (saveBtn) {
  saveBtn.addEventListener('click', () => {
    saveGame(worker);
  });
}
if (loadBtn) {
  loadBtn.addEventListener('click', () => {
    showLoadPrompt();
  });
}

// панорамирование
let panX = 0, panY = 0, panning = false, startX = 0, startY = 0;
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 0.9 : 1.1;
  zoom = Math.min(Math.max(0.5, zoom * factor), 4);
});
let buildMode = null;
let assignRole = null;

function showAgent(e) {
  if (!mapW || !mapH) return;
  const ts = Math.floor(Math.min(
    window.innerWidth / mapW,
    window.innerHeight / mapH
  ) * zoom);
  const x = Math.floor((e.clientX - panX) / ts);
  const y = Math.floor((e.clientY - panY) / ts);
  let idx = -1;
  for (let i = 0; i < agents.x.length; i++) {
    if (agents.x[i] === x && agents.y[i] === y) { idx = i; break; }
  }
  if (idx !== -1) {
    agentInfo.style.display = 'block';
    agentInfo.style.left = e.clientX + 10 + 'px';
    agentInfo.style.top  = e.clientY + 10 + 'px';
    const jobMap = {};
    jobMap[JOBS.IDLE] = 'idle';
    jobMap[JOBS.HARVEST] = 'harvest';
    jobMap[JOBS.CHOP] = 'chop';
    jobMap[JOBS.BUILD] = 'build';
    jobMap[JOBS.STORE_FOOD] = 'store food';
    jobMap[JOBS.STORE_WOOD] = 'store wood';
    jobMap[JOBS.BUILD_STORE] = 'build store';
    jobMap[JOBS.FARM] = 'farm';
    jobMap[JOBS.TRADER] = 'trader';
    const job = jobMap[agents.job[idx]] || 'unknown';
    agentInfo.textContent = `age:${agents.age[idx].toFixed(0)}\nhunger:${agents.hunger[idx].toFixed(0)}\ntask:${job}`;
    return;
  }
  for (let i = 0; i < houses.length; i++) {
    if (houses[i].x === x && houses[i].y === y) {
      agentInfo.style.display = 'block';
      agentInfo.style.left = e.clientX + 10 + 'px';
      agentInfo.style.top  = e.clientY + 10 + 'px';
      agentInfo.textContent = `house ${i}\ncap:${houses[i].capacity} occ:${houses[i].occupants}`;
      return;
    }
  }
  for (let i = 0; i < stores.length; i++) {
    if (stores[i].x === x && stores[i].y === y) {
      agentInfo.style.display = 'block';
      agentInfo.style.left = e.clientX + 10 + 'px';
      agentInfo.style.top  = e.clientY + 10 + 'px';
      agentInfo.textContent = `store ${i}\nfood:${stores[i].food} wood:${stores[i].wood}`;
      return;
    }
  }
  for (let i = 0; i < markets.length; i++) {
    if (markets[i].x === x && markets[i].y === y) {
      agentInfo.style.display = 'block';
      agentInfo.style.left = e.clientX + 10 + 'px';
      agentInfo.style.top  = e.clientY + 10 + 'px';
      agentInfo.textContent = `market ${i}`;
      return;
    }
  }
  agentInfo.style.display = 'none';
}
canvas.addEventListener('pointerdown', e => {
  const ts = Math.floor(Math.min(
    window.innerWidth / mapW,
    window.innerHeight / mapH
  ) * zoom);
  const x = Math.floor((e.clientX - panX) / ts);
  const y = Math.floor((e.clientY - panY) / ts);
  if (assignRole !== null) {
    let idx = -1;
    for (let i = 0; i < agents.x.length; i++) {
      if (agents.x[i] === x && agents.y[i] === y) { idx = i; break; }
    }
    if (idx !== -1) worker.postMessage({type:'set-role', role: assignRole, id: idx});
    assignRole = null;
    if (traderBtn) traderBtn.classList.remove('active');
    return;
  }
  if (buildMode) {
    worker.postMessage({type:'place', what: buildMode, x, y});
    buildMode = null;
    if (buildControls) {
      buildControls.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    }
    return;
  }
  panning = true;
  startX = e.clientX; startY = e.clientY;
  showAgent(e);
});
canvas.addEventListener('pointermove', e => {
  if (panning) {
    panX += e.clientX - startX;
    panY += e.clientY - startY;
    startX = e.clientX; startY = e.clientY;
  } else {
    showAgent(e);
  }
});
canvas.addEventListener('pointerup',   () => panning = false);
canvas.addEventListener('pointercancel',() => panning = false);
canvas.addEventListener('pointerleave', () => agentInfo.style.display = 'none');

// обработка сообщений от симуляции
worker.onmessage = e => {
  const msg = e.data;
  if (msg.type === 'init') {
    mapW = msg.mapW; mapH = msg.mapH;
    tiles = msg.tiles;
  } else if (msg.type === 'update') {
    tiles    = msg.tiles;
    agents   = msg.agents;
    houses   = msg.houses;
    stores   = msg.stores || [];
    markets  = msg.markets || [];
    corpses  = msg.corpses || [];
    stats    = msg.stats;
    fps      = msg.fps;
    if (msg.events) {
      msg.events.forEach(ev => {
        let text = ev.type;
        if (ev.type === 'birth') {
          text = `Birth at (${ev.payload.x},${ev.payload.y})`;
          sound.play('birth');
        } else if (ev.type === 'death') {
          text = `Death at (${ev.payload.x},${ev.payload.y})`;
          sound.play('death');
        } else if (ev.type === 'building-complete') {
          text = `Built ${ev.payload.type} at (${ev.payload.x},${ev.payload.y})`;
          sound.play('build');
        }
        notify(text);
      });
    }
  }
};

// рисование кадра
function render() {
  const now = performance.now();
  const dt  = (now - lastTime) / 1000;
  lastTime = now;
  animTimer += dt;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  if (tiles && mapW && mapH) {
    // размер одного тайла, чтобы весь мир помещался
    const base = Math.floor(Math.min(
      window.innerWidth / mapW,
      window.innerHeight / mapH
    ));
    const ts = base;
    // отрисовка земли
    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        const t = tiles[y * mapW + x];
        if (t === TILE_WATER) ctx.fillStyle = TILE_COLORS.water;
        else if (t === TILE_FOREST) ctx.fillStyle = TILE_COLORS.forest;
        else if (t === TILE_FIELD) ctx.fillStyle = TILE_COLORS.field;
        else if (t === TILE_FIELD_GROW) ctx.fillStyle = TILE_COLORS.fieldGrow;
        else if (t === TILE_FOREST_GROW) ctx.fillStyle = TILE_COLORS.forestGrow;
        else ctx.fillStyle = TILE_COLORS.grass;
        ctx.fillRect(x * ts, y * ts, ts, ts);
      }
    }

    // дома
    houses.forEach(h => {
      drawHouse(h.x, h.y, ts);
    });

    // склады
    stores.forEach(s => {
      drawStore(s.x, s.y, ts);
    });

    // рынки
    markets.forEach(m => {
      drawMarket(m.x, m.y, ts);
    });

    // трупы
    corpses.forEach(c => drawCorpse(c.x, c.y, ts));

    // поселенцы
    for (let i = 0; i < agents.x.length; i++) {
      drawVillager(agents.x[i], agents.y[i], ts, agents.age[i] > 50);
    }
  }

  ctx.restore();

  // обновляем HUD
  hud.pop.textContent  = `Pop:  ${stats.pop}`;
  hud.food.textContent   = `Food: ${stats.food}`;
  hud.wood.textContent   = `Wood: ${stats.wood}`;
  hud.priceFood.textContent = `F$ ${stats.priceFood.toFixed(2)}`;
  hud.priceWood.textContent = `W$ ${stats.priceWood.toFixed(2)}`;
  hud.houses.textContent = `Houses: ${stats.houses} S:${stats.stores} M:${stats.markets}`;
  hud.fps.textContent    = `FPS:  ${fps}`;

  if (panel.style.display !== 'none') {
    let text = `World pop:${stats.pop} food:${stats.food} wood:${stats.wood} houses:${stats.houses} stores:${stats.stores} markets:${stats.markets}\n` +
               `priceF:${stats.priceFood.toFixed(2)} priceW:${stats.priceWood.toFixed(2)}\n\n`;
    for (let i = 0; i < agents.x.length; i++) {
      text += `#${i} age:${agents.age[i].toFixed(1)} hunger:${agents.hunger[i].toFixed(0)} home:${agents.home[i]} food:${agents.skillFood[i]} wood:${agents.skillWood[i]}\n`;
    }
    panel.textContent = text;
  }

  requestAnimationFrame(render);
}

// старт отрисовки
requestAnimationFrame(render);

// load saved game on start if present
if (hasSavedGame()) {
  showLoadPrompt();
}
