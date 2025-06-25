import { test, expect } from '@jest/globals';

function removeAgent(i, world) {
  const {
    posX, posY, homeId, parentA, parentB, spouse,
    age, hunger, thirst, energy,
    skillFood, skillWood, workTimer, jobType, role,
    buildX, buildY, carryFood, carryWood,
    houseOccupants, reserved
  } = world;
  if (spouse[i] >= 0 && spouse[spouse[i]] === i) spouse[spouse[i]] = -1;
  const lastId = --world.agentCount;
  if (homeId[i] >= 0) houseOccupants[homeId[i]]--;
  posX[i] = posX[lastId]; posY[i] = posY[lastId];
  homeId[i] = homeId[lastId]; if (homeId[i] >= 0) houseOccupants[homeId[i]]++;
  parentA[i] = parentA[lastId]; parentB[i] = parentB[lastId]; spouse[i] = spouse[lastId];
  age[i] = age[lastId]; hunger[i] = hunger[lastId];
  thirst[i] = thirst[lastId]; energy[i] = energy[lastId];
  skillFood[i] = skillFood[lastId]; skillWood[i] = skillWood[lastId];
  workTimer[i] = workTimer[lastId]; jobType[i] = jobType[lastId]; role[i] = role[lastId];
  buildX[i] = buildX[lastId]; buildY[i] = buildY[lastId];
  carryFood[i] = carryFood[lastId]; carryWood[i] = carryWood[lastId];
  for (let r = 0; r < reserved.length; r++) if (reserved[r] === i) reserved[r] = -1;
  for (let r = 0; r < reserved.length; r++) if (reserved[r] >= world.agentCount) reserved[r] = -1;
}

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
