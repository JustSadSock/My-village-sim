export function serializeWorld(world) {
  return {
    time: world.time,
    tiles: Array.from(world.tiles),
    tileTimer: Array.from(world.tileTimer),
    reserved: Array.from(world.reserved),
    agentCount: world.agentCount,
    posX: Array.from(world.posX.slice(0, world.agentCount)),
    posY: Array.from(world.posY.slice(0, world.agentCount)),
    age: Array.from(world.age.slice(0, world.agentCount)),
    hunger: Array.from(world.hunger.slice(0, world.agentCount)),
    thirst: Array.from(world.thirst.slice(0, world.agentCount)),
    energy: Array.from(world.energy.slice(0, world.agentCount)),
    homeId: Array.from(world.homeId.slice(0, world.agentCount)),
    parentA: Array.from(world.parentA.slice(0, world.agentCount)),
    parentB: Array.from(world.parentB.slice(0, world.agentCount)),
    spouse: Array.from(world.spouse.slice(0, world.agentCount)),
    skillFood: Array.from(world.skillFood.slice(0, world.agentCount)),
    skillWood: Array.from(world.skillWood.slice(0, world.agentCount)),
    workTimer: Array.from(world.workTimer.slice(0, world.agentCount)),
    jobType: Array.from(world.jobType.slice(0, world.agentCount)),
    role: Array.from(world.role.slice(0, world.agentCount)),
    buildX: Array.from(world.buildX.slice(0, world.agentCount)),
    buildY: Array.from(world.buildY.slice(0, world.agentCount)),
    carryFood: Array.from(world.carryFood.slice(0, world.agentCount)),
    carryWood: Array.from(world.carryWood.slice(0, world.agentCount)),
    morale: world.morale ? Array.from(world.morale.slice(0, world.agentCount)) : undefined,
    friend: world.friend ? Array.from(world.friend.slice(0, world.agentCount)) : undefined,
    houseCount: world.houseCount,
    houseX: Array.from(world.houseX.slice(0, world.houseCount)),
    houseY: Array.from(world.houseY.slice(0, world.houseCount)),
    houseCapacity: Array.from(world.houseCapacity.slice(0, world.houseCount)),
    houseOccupants: Array.from(world.houseOccupants.slice(0, world.houseCount)),
    storeCount: world.storeCount,
    storeX: Array.from(world.storeX.slice(0, world.storeCount)),
    storeY: Array.from(world.storeY.slice(0, world.storeCount)),
    storeSize: Array.from(world.storeSize.slice(0, world.storeCount)),
    storeFood: Array.from(world.storeFood.slice(0, world.storeCount)),
    storeWood: Array.from(world.storeWood.slice(0, world.storeCount)),
    marketCount: world.marketCount,
    marketX: Array.from(world.marketX.slice(0, world.marketCount)),
    marketY: Array.from(world.marketY.slice(0, world.marketCount)),
    corpseCount: world.corpseCount,
    corpseX: Array.from(world.corpseX.slice(0, world.corpseCount)),
    corpseY: Array.from(world.corpseY.slice(0, world.corpseCount)),
    corpseTimer: Array.from(world.corpseTimer.slice(0, world.corpseCount)),
    stockFood: world.stockFood,
    stockWood: world.stockWood,
    priceFood: world.priceFood,
    priceWood: world.priceWood
  };
}

function copyArray(target, src, count) {
  for (let i = 0; i < count; i++) target[i] = src[i];
}

export function deserializeWorld(world, data) {
  if (!data) return;
  if (Array.isArray(data.tiles)) world.tiles.set(data.tiles);
  if (Array.isArray(data.tileTimer)) world.tileTimer.set(data.tileTimer);
  if (Array.isArray(data.reserved)) world.reserved.set(data.reserved);

  world.time = data.time ?? 0;

  world.agentCount = data.agentCount ?? 0;
  copyArray(world.posX, data.posX || [], world.agentCount);
  copyArray(world.posY, data.posY || [], world.agentCount);
  copyArray(world.age, data.age || [], world.agentCount);
  copyArray(world.hunger, data.hunger || [], world.agentCount);
  copyArray(world.thirst, data.thirst || [], world.agentCount);
  copyArray(world.energy, data.energy || [], world.agentCount);
  copyArray(world.homeId, data.homeId || [], world.agentCount);
  copyArray(world.parentA, data.parentA || [], world.agentCount);
  copyArray(world.parentB, data.parentB || [], world.agentCount);
  copyArray(world.spouse, data.spouse || [], world.agentCount);
  copyArray(world.skillFood, data.skillFood || [], world.agentCount);
  copyArray(world.skillWood, data.skillWood || [], world.agentCount);
  copyArray(world.workTimer, data.workTimer || [], world.agentCount);
  copyArray(world.jobType, data.jobType || [], world.agentCount);
  copyArray(world.role, data.role || [], world.agentCount);
  copyArray(world.buildX, data.buildX || [], world.agentCount);
  copyArray(world.buildY, data.buildY || [], world.agentCount);
  copyArray(world.carryFood, data.carryFood || [], world.agentCount);
  copyArray(world.carryWood, data.carryWood || [], world.agentCount);
  if (world.morale) copyArray(world.morale, data.morale || [], world.agentCount);
  if (world.friend) copyArray(world.friend, data.friend || [], world.agentCount);

  world.houseCount = data.houseCount ?? 0;
  copyArray(world.houseX, data.houseX || [], world.houseCount);
  copyArray(world.houseY, data.houseY || [], world.houseCount);
  copyArray(world.houseCapacity, data.houseCapacity || [], world.houseCount);
  copyArray(world.houseOccupants, data.houseOccupants || [], world.houseCount);

  world.storeCount = data.storeCount ?? 0;
  copyArray(world.storeX, data.storeX || [], world.storeCount);
  copyArray(world.storeY, data.storeY || [], world.storeCount);
  copyArray(world.storeSize, data.storeSize || [], world.storeCount);
  copyArray(world.storeFood, data.storeFood || [], world.storeCount);
  copyArray(world.storeWood, data.storeWood || [], world.storeCount);

  world.marketCount = data.marketCount ?? 0;
  copyArray(world.marketX, data.marketX || [], world.marketCount);
  copyArray(world.marketY, data.marketY || [], world.marketCount);

  world.corpseCount = data.corpseCount ?? 0;
  copyArray(world.corpseX, data.corpseX || [], world.corpseCount);
  copyArray(world.corpseY, data.corpseY || [], world.corpseCount);
  copyArray(world.corpseTimer, data.corpseTimer || [], world.corpseCount);

  if (typeof data.stockFood === 'number') world.stockFood = data.stockFood;
  if (typeof data.stockWood === 'number') world.stockWood = data.stockWood;
  if (typeof data.priceFood === 'number') world.priceFood = data.priceFood;
  if (typeof data.priceWood === 'number') world.priceWood = data.priceWood;
}

function waitForSave(worker) {
  return new Promise(resolve => {
    const handler = e => {
      if (e.data && e.data.type === 'save') {
        worker.removeEventListener('message', handler);
        resolve(e.data.state);
      }
    };
    worker.addEventListener('message', handler);
    worker.postMessage({ type: 'save' });
  });
}

export async function saveGame(worker) {
  const state = await waitForSave(worker);
  localStorage.setItem('village-save', JSON.stringify(state));
}

export function loadGame(worker) {
  const text = localStorage.getItem('village-save');
  if (!text) return false;
  const state = JSON.parse(text);
  worker.postMessage({ type: 'load', state });
  return true;
}

export function hasSavedGame() {
  return localStorage.getItem('village-save') !== null;
}
