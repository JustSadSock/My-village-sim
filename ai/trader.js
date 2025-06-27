// ai/trader.js — торговцы перемещают ресурсы между складами

import { JOB_IDLE, JOB_TRADER } from '../data/jobTypes.js';
import { pathStep } from './path.js';

export function init() {}

export function update(id, dt, world) {
  const {
    storeCount, storeFood, storeWood, storeX, storeY,
    posX, posY, carryFood, carryWood, jobType
  } = world;
  if (storeCount < 2) return;

  // choose richest and poorest stores by total resources
  let richest = 0, poorest = 0;
  let max = -1, min = Infinity;
  for (let i = 0; i < storeCount; i++) {
    const total = storeFood[i] + storeWood[i];
    if (total > max) { max = total; richest = i; }
    if (total < min) { min = total; poorest = i; }
  }

  if (carryFood[id] === 0 && carryWood[id] === 0) {
    // move to richest store and pick up resources
    const sx = storeX[richest], sy = storeY[richest];
    if (posX[id] !== sx || posY[id] !== sy) {
      stepToward(id, sx, sy, world);
      jobType[id] = JOB_TRADER;
      return;
    }
    const takeF = Math.min(10, storeFood[richest]);
    const takeW = Math.min(10, storeWood[richest]);
    if (takeF > 0 || takeW > 0) {
      if (world.withdraw(richest, takeF, takeW)) {
        carryFood[id] += takeF;
        carryWood[id] += takeW;
      }
    }
    jobType[id] = JOB_TRADER;
  } else {
    // move to poorest store and deposit resources
    const tx = storeX[poorest], ty = storeY[poorest];
    if (posX[id] !== tx || posY[id] !== ty) {
      stepToward(id, tx, ty, world);
      jobType[id] = JOB_TRADER;
      return;
    }
    world.deposit(poorest, carryFood[id], carryWood[id]);
    carryFood[id] = 0;
    carryWood[id] = 0;
    jobType[id] = JOB_IDLE;
  }
}

