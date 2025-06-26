import { test, expect } from '@jest/globals';
import { removeAgent } from '../utils/removeAgent.js';

test('removing agent clears reservations and keeps carry values', () => {
  const world = {
    agentCount: 2,
    posX: new Uint8Array(2),
    posY: new Uint8Array(2),
    homeId: new Int16Array(2).fill(-1),
    parentA: new Int16Array(2).fill(-1),
    parentB: new Int16Array(2).fill(-1),
    spouse: new Int16Array(2).fill(-1),
    age: new Float32Array(2),
    hunger: new Float32Array(2),
    thirst: new Float32Array(2),
    energy: new Float32Array(2),
    skillFood: new Uint16Array(2),
    skillWood: new Uint16Array(2),
    workTimer: new Float32Array(2),
    jobType: new Uint8Array(2),
    role: new Uint8Array(2),
    buildX: new Int16Array(2).fill(-1),
    buildY: new Int16Array(2).fill(-1),
    carryFood: new Uint8Array(2),
    carryWood: new Uint8Array(2),
    houseOccupants: new Uint8Array(1),
    reserved: new Int16Array([0, 1])
  };

  world.buildX[1] = 5;
  world.buildY[1] = 6;
  world.carryFood[1] = 3;
  world.carryWood[1] = 4;

  removeAgent(0, world);

  expect(world.agentCount).toBe(1);
  expect(world.buildX[0]).toBe(5);
  expect(world.buildY[0]).toBe(6);
  expect(world.carryFood[0]).toBe(3);
  expect(world.carryWood[0]).toBe(4);
  for (let r of world.reserved) expect(r).toBe(-1);
});
