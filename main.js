// main.js — UI и рендер, оптимизировано для мобильных

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
const detailsBtn = document.getElementById('details-btn');
const speedControls = document.getElementById('speed-controls');

let mapW = 0, mapH = 0;
let tiles, agents = { x: [], y: [], age: [], hunger: [], home: [], skillFood: [], skillWood: [] }, houses = [];
let stats = { pop: 0, food: 0, wood: 0, priceFood: 0, priceWood: 0, houses: 0 }, fps = 0;
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
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}
window.addEventListener('keydown', e => {
  if (e.key === 'v') togglePanel();
});
detailsBtn.addEventListener('click', togglePanel);
if (speedControls) {
  speedControls.addEventListener('click', e => {
    const v = e.target.getAttribute('data-s');
    if (v !== null) worker.postMessage({type:'speed', value: Number(v)});
  });
}

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
  const now = performance.now();
  const dt  = (now - lastTime) / 1000;
  lastTime = now;

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
        if (t === 1) ctx.fillStyle = (x + y) % 2 ? '#28f' : '#39f';
        else if (t === 2) ctx.fillStyle = (x + y) % 2 ? '#2a2' : '#1f2';
        else if (t === 3) ctx.fillStyle = (x + y) % 2 ? '#ca5' : '#db6';
        else ctx.fillStyle = (x + y) % 2 ? '#3c3' : '#4d4';
        ctx.fillRect(x * ts, y * ts, ts, ts);
      }
    }

    // дома
    houses.forEach(h => {
      ctx.fillStyle = (h.x + h.y) % 2 ? '#a52' : '#b63';
      ctx.fillRect(h.x * ts, h.y * ts, ts, ts);
    });

    // поселенцы
    for (let i = 0; i < agents.x.length; i++) {
      ctx.fillStyle = agents.age[i] > 50 ? '#ccc' : '#eee';
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
  hud.food.textContent   = `Food: ${stats.food}`;
  hud.wood.textContent   = `Wood: ${stats.wood}`;
  hud.priceFood.textContent = `F$ ${stats.priceFood.toFixed(2)}`;
  hud.priceWood.textContent = `W$ ${stats.priceWood.toFixed(2)}`;
  hud.houses.textContent = `Houses: ${stats.houses}`;
  hud.fps.textContent    = `FPS:  ${fps}`;

  if (panel.style.display !== 'none') {
    let html = `<b>World</b> pop:${stats.pop} food:${stats.food} wood:${stats.wood} houses:${stats.houses}<br/>` +
               `priceF:${stats.priceFood.toFixed(2)} priceW:${stats.priceWood.toFixed(2)}<br/><br/>`;
    for (let i = 0; i < agents.x.length; i++) {
      html += `#${i} age:${agents.age[i].toFixed(1)} hunger:${agents.hunger[i].toFixed(0)} home:${agents.home[i]} food:${agents.skillFood[i]} wood:${agents.skillWood[i]}<br/>`;
    }
    panel.innerHTML = html;
  }

  requestAnimationFrame(render);
}

// старт отрисовки
requestAnimationFrame(render);
