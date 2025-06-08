// main.js — UI и рендер, оптимизировано для мобильных

const worker = new Worker('sim.worker.js', { type: 'module' });
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const hud = {
  pop:  document.getElementById('pop'),
  food: document.getElementById('food'),
  wood: document.getElementById('wood'),
  fps:  document.getElementById('fps'),
};

let mapW = 0, mapH = 0;
let tiles, agents = { x: [], y: [] }, houses = [];
let stats = { pop: 0, food: 0, wood: 0 }, fps = 0;

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

// панорамирование
let panX = 0, panY = 0, panning = false, startX = 0, startY = 0;
canvas.addEventListener('pointerdown', e => {
  panning = true;
  startX = e.clientX; startY = e.clientY;
});
canvas.addEventListener('pointermove', e => {
  if (panning) {
    panX += e.clientX - startX;
    panY += e.clientY - startY;
    startX = e.clientX; startY = e.clientY;
  }
});
canvas.addEventListener('pointerup',   () => panning = false);
canvas.addEventListener('pointercancel',() => panning = false);

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
    stats    = msg.stats;
    fps      = msg.fps;
  }
};

// рисование кадра
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(panX, panY);

  if (tiles && mapW && mapH) {
    // размер одного тайла, чтобы весь мир помещался
    const ts = Math.floor(Math.min(
      window.innerWidth / mapW,
      window.innerHeight / mapH
    ));
    // отрисовка земли
    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        const t = tiles[y * mapW + x];
        // 0 = grass, 1 = water, 2 = forest, 3 = field
        ctx.fillStyle = t === 1 ? '#28f'
                       : t === 2 ? '#2a2'
                       : t === 3 ? '#ca5'
                       : '#3c3';
        ctx.fillRect(x * ts, y * ts, ts, ts);
      }
    }

    // дома
    ctx.fillStyle = '#a52';
    houses.forEach(h => {
      ctx.fillRect(h.x * ts, h.y * ts, ts, ts);
    });

    // поселенцы
    ctx.fillStyle = '#eee';
    for (let i = 0; i < agents.x.length; i++) {
      ctx.fillRect(
        agents.x[i] * ts,
        agents.y[i] * ts,
        ts, ts
      );
    }
  }

  ctx.restore();

  // обновляем HUD
  hud.pop.textContent  = `Pop:  ${stats.pop}`;
  hud.food.textContent = `Food: ${stats.food}`;
  hud.wood.textContent = `Wood: ${stats.wood}`;
  hud.fps.textContent  = `FPS:  ${fps}`;

  requestAnimationFrame(render);
}

// старт отрисовки
requestAnimationFrame(render);
