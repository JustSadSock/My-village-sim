import { test, expect } from '@jest/globals';
import { pathStep } from '../ai/path.js';

function createWorld(tiles, w, h) {
  return { MAP_W: w, MAP_H: h, tiles: new Uint8Array(tiles) };
}

function bfsLength(sx, sy, tx, ty, world) {
  const { MAP_W, MAP_H, tiles } = world;
  const visited = new Set();
  const queue = [{ x: sx, y: sy, d: 0 }];
  visited.add(`${sx},${sy}`);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  function passable(x, y) {
    if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return false;
    return tiles[y * MAP_W + x] !== 1;
  }
  let idx = 0;
  while (idx < queue.length) {
    const cur = queue[idx++];
    if (cur.x === tx && cur.y === ty) return cur.d;
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const key = `${nx},${ny}`;
      if (!passable(nx, ny) || visited.has(key)) continue;
      visited.add(key);
      queue.push({ x: nx, y: ny, d: cur.d + 1 });
    }
  }
  return Infinity;
}

function runPathStep(sx, sy, tx, ty, world) {
  let x = sx, y = sy;
  let steps = 0;
  let guard = 0;
  while ((x !== tx || y !== ty) && guard < 100) {
    const next = pathStep(x, y, tx, ty, world);
    if (next.x === x && next.y === y) break;
    x = next.x; y = next.y; steps++; guard++;
  }
  return steps;
}

test('A* path length is not longer than BFS on open grid', () => {
  const world = createWorld([
    0,0,0,
    0,0,0,
    0,0,0,
  ], 3, 3);
  const bfs = bfsLength(0,0,2,2,world);
  const astar = runPathStep(0,0,2,2,world);
  expect(astar).toBeLessThanOrEqual(bfs);
});

test('A* path length is not longer than BFS with obstacles', () => {
  const tiles = [
    0,0,0,0,0,
    0,1,1,1,0,
    0,0,0,1,0,
    0,1,0,0,0,
    0,0,0,0,0,
  ];
  const world = createWorld(tiles,5,5);
  const bfs = bfsLength(0,0,4,4,world);
  const astar = runPathStep(0,0,4,4,world);
  expect(astar).toBeLessThanOrEqual(bfs);
});
