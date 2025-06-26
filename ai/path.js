const dirs = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function manhattan(x1, y1, x2, y2) {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

function passable(x, y, world) {
  const { MAP_W, MAP_H, tiles } = world;
  if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return false;
  return tiles[y * MAP_W + x] !== 1;
}

function reconstructPath(nodes, endIdx) {
  const path = [];
  let n = nodes[endIdx];
  while (n) {
    path.push({ x: n.x, y: n.y });
    n = n.prev != null ? nodes[n.prev] : null;
  }
  return path.reverse();
}

function aStar(sx, sy, tx, ty, world) {
  if (sx === tx && sy === ty) return [{ x: sx, y: sy }];
  const nodes = [];
  const open = [];
  const visited = new Map();

  const start = { x: sx, y: sy, g: 0, h: manhattan(sx, sy, tx, ty) };
  start.f = start.g + start.h;
  start.prev = null;
  nodes.push(start);
  open.push(0);
  visited.set(`${sx},${sy}`, 0);

  let endIdx = -1;
  while (open.length > 0) {
    let best = 0;
    for (let i = 1; i < open.length; i++) {
      if (nodes[open[i]].f < nodes[open[best]].f) best = i;
    }
    const curIdx = open.splice(best, 1)[0];
    const cur = nodes[curIdx];

    if (cur.x === tx && cur.y === ty) { endIdx = curIdx; break; }

    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!passable(nx, ny, world)) continue;
      const key = `${nx},${ny}`;
      const g = cur.g + 1;
      if (visited.has(key)) {
        const idx = visited.get(key);
        if (g < nodes[idx].g) {
          nodes[idx].g = g;
          nodes[idx].f = g + nodes[idx].h;
          nodes[idx].prev = curIdx;
          if (!open.includes(idx)) open.push(idx);
        }
        continue;
      }
      const h = manhattan(nx, ny, tx, ty);
      const node = { x: nx, y: ny, g, h, f: g + h, prev: curIdx };
      const idx = nodes.push(node) - 1;
      visited.set(key, idx);
      open.push(idx);
    }
  }

  if (endIdx === -1) return [{ x: sx, y: sy }];
  return reconstructPath(nodes, endIdx);
}

const pathCache = new Map();

export function clearPathCache(limit = 200) {
  if (pathCache.size > limit) pathCache.clear();
}

export function pathStep(sx, sy, tx, ty, world) {
  const key = `${sx},${sy}->${tx},${ty}`;
  let entry = pathCache.get(key);

  if (!entry || entry.path[entry.index].x !== sx || entry.path[entry.index].y !== sy) {
    const path = aStar(sx, sy, tx, ty, world);
    entry = { path, index: 0 };
  }

  if (entry.path.length < 2 || entry.index + 1 >= entry.path.length) {
    pathCache.delete(key);
    return { x: sx, y: sy };
  }

  const next = entry.path[entry.index + 1];
  pathCache.delete(key);
  if (entry.index + 1 < entry.path.length - 1) {
    pathCache.set(`${next.x},${next.y}->${tx},${ty}`, { path: entry.path, index: entry.index + 1 });
  }

  return { x: next.x, y: next.y };
}
