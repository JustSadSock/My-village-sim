import { test, expect } from '@jest/globals';
import { update as updateBuilder } from '../ai/builder.js';
import { TILE_GRASS } from '../data/constants.js';
import { JOB_IDLE } from '../data/jobTypes.js';

function createWorld() {
  return {
    age: new Float32Array(1),
    posX: new Uint8Array(1),
    posY: new Uint8Array(1),
    homeId: new Int16Array(1).fill(-1),
    hunger: new Float32Array(1).fill(100),
    houseX: new Uint8Array(1),
    houseY: new Uint8Array(1),
    houseCapacity: new Uint8Array(1),
    houseOccupants: new Uint8Array(1),
    houseCount: 0,
    MAP_W: 1,
    MAP_H: 1,
    tiles: new Uint8Array([TILE_GRASS]),
    reserved: new Int16Array(1).fill(-1),
    stockWood: 0,
    stockFood: 0,
    workTimer: new Float32Array(1),
    jobType: new Uint8Array(1).fill(JOB_IDLE),
    buildX: new Int16Array(1).fill(-1),
    buildY: new Int16Array(1).fill(-1),
    storeX: new Uint8Array(1),
    storeY: new Uint8Array(1),
    storeSize: new Uint8Array(1),
    storeCount: 0,
    storeFood: new Uint16Array(1),
    agentCount: 1,
    withdraw() { return true; },
    carryFood: new Uint8Array(1),
    role: new Uint8Array(1).fill(1)
  };
}

test('builder toggles back when food stock is sufficient', () => {
  const world = createWorld();

  // low food causes switch to farmer
  updateBuilder(0, 0, world);
  expect(world.role[0]).toBe(0);

  // replenish food and run update again
  world.stockFood = 2;
  updateBuilder(0, 0, world);
  expect(world.role[0]).toBe(1);
});
