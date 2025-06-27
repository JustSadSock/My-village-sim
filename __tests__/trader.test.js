import { test, expect } from '@jest/globals';
import { update as updateTrader } from '../ai/trader.js';
import { JOB_IDLE, JOB_TRADER } from '../data/jobTypes.js';
import { TILE_GRASS } from '../data/constants.js';

function createWorld() {
  const storeCount = 2;
  return {
    MAP_W: 3,
    MAP_H: 1,
    tiles: new Uint8Array([TILE_GRASS, TILE_GRASS, TILE_GRASS]),
    storeCount,
    storeX: new Uint8Array([0, 2]),
    storeY: new Uint8Array([0, 0]),
    storeSize: new Uint8Array([1, 1]),
    storeFood: new Uint16Array([50, 0]),
    storeWood: new Uint16Array([0, 0]),
    posX: new Uint8Array(1),
    posY: new Uint8Array(1),
    carryFood: new Uint8Array(1),
    carryWood: new Uint8Array(1),
    jobType: new Uint8Array(1).fill(JOB_IDLE),
    deposit(i, f = 0, w = 0) {
      this.storeFood[i] += f;
      this.storeWood[i] += w;
    },
    withdraw(i, f = 0, w = 0) {
      if (f > this.storeFood[i] || w > this.storeWood[i]) return false;
      this.storeFood[i] -= f;
      this.storeWood[i] -= w;
      return true;
    }
  };
}

test('trader transfers resources between stores', () => {
  const world = createWorld();
  world.posX[0] = 0; // at first store
  world.posY[0] = 0;

  updateTrader(0, 0, world); // pick up from store 0
  expect(world.carryFood[0]).toBeGreaterThan(0);
  expect(world.storeFood[0]).toBeLessThan(50);
  expect(world.jobType[0]).toBe(JOB_TRADER);

  // move to second store
  world.posX[0] = 2;
  updateTrader(0, 0, world); // deposit to store 1
  expect(world.carryFood[0]).toBe(0);
  expect(world.storeFood[1]).toBeGreaterThan(0);
  expect(world.jobType[0]).toBe(JOB_IDLE);
});

test('trader sells resources at market', () => {
  const world = createWorld();
  world.marketCount = 1;
  world.marketX = new Uint8Array([1]);
  world.marketY = new Uint8Array([0]);

  world.posX[0] = 0;
  world.posY[0] = 0;
  updateTrader(0, 0, world); // pick up from store 0
  expect(world.carryFood[0]).toBeGreaterThan(0);

  // move to market to sell
  world.posX[0] = 1;
  updateTrader(0, 0, world);
  expect(world.carryFood[0]).toBe(0);
  expect(world.jobType[0]).toBe(JOB_IDLE);
});
