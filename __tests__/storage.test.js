import { test, expect, describe, beforeEach } from '@jest/globals';

function createStorage(size = 1) {
  const storeSize = new Uint8Array(size);
  const storeFood = new Uint16Array(size);
  const storeWood = new Uint16Array(size);
  let storeCount = size;
  let _stockFood = 0;
  let _stockWood = 0;
  let tickFoodIn = 0, tickWoodIn = 0, tickFoodOut = 0, tickWoodOut = 0;

  function deposit(storeIndex, food = 0, wood = 0) {
    if (storeIndex < 0 || storeIndex >= storeCount) return 0;
    const cap = storeSize[storeIndex] * 100;
    const used = storeFood[storeIndex] + storeWood[storeIndex];
    let free = cap - used;
    let deposited = 0;
    if (food > 0 && free > 0) {
      const df = Math.min(food, free);
      storeFood[storeIndex] += df;
      _stockFood += df;
      tickFoodIn += df;
      free -= df;
      deposited += df;
    }
    if (wood > 0 && free > 0) {
      const dw = Math.min(wood, free);
      storeWood[storeIndex] += dw;
      _stockWood += dw;
      tickWoodIn += dw;
      deposited += dw;
    }
    return deposited;
  }

  function withdraw(storeIndex, food = 0, wood = 0) {
    if (storeIndex < 0 || storeIndex >= storeCount) return false;
    if (food > storeFood[storeIndex] || wood > storeWood[storeIndex]) return false;
    storeFood[storeIndex] -= food;
    storeWood[storeIndex] -= wood;
    _stockFood -= food;
    _stockWood -= wood;
    tickFoodOut += food;
    tickWoodOut += wood;
    return true;
  }

  return {
    storeSize,
    storeFood,
    storeWood,
    deposit,
    withdraw,
    get stockFood() { return _stockFood; },
    get stockWood() { return _stockWood; },
  };
}

describe('storage deposit/withdraw', () => {
  let storage;
  beforeEach(() => {
    storage = createStorage(1);
    storage.storeSize[0] = 1; // capacity 100
  });

  test('depositing into a full store does nothing', () => {
    storage.storeFood[0] = 70;
    storage.storeWood[0] = 30; // 100/100 used
    const deposited = storage.deposit(0, 10, 10);
    expect(deposited).toBe(0);
    expect(storage.storeFood[0]).toBe(70);
    expect(storage.storeWood[0]).toBe(30);
    expect(storage.stockFood).toBe(0);
    expect(storage.stockWood).toBe(0);
  });

  test('partial deposits and withdrawals work', () => {
    storage.storeFood[0] = 80;
    let deposited = storage.deposit(0, 30, 10); // only 20 space free
    expect(deposited).toBe(20);
    expect(storage.storeFood[0]).toBe(100);
    expect(storage.stockFood).toBe(20);

    const withdrew = storage.withdraw(0, 10, 0);
    expect(withdrew).toBe(true);
    expect(storage.storeFood[0]).toBe(90);
    expect(storage.stockFood).toBe(10);

    deposited = storage.deposit(0, 0, 25); // space only for 10 wood
    expect(deposited).toBe(10);
    expect(storage.storeWood[0]).toBe(10);
    expect(storage.stockWood).toBe(10);

    const withdrewBoth = storage.withdraw(0, 5, 5);
    expect(withdrewBoth).toBe(true);
    expect(storage.storeFood[0]).toBe(85);
    expect(storage.storeWood[0]).toBe(5);
    expect(storage.stockFood).toBe(5);
    expect(storage.stockWood).toBe(5);
  });

  test('withdrawing more than available fails', () => {
    storage.storeFood[0] = 3;
    const ok = storage.withdraw(0, 5, 0);
    expect(ok).toBe(false);
    expect(storage.storeFood[0]).toBe(3);
    expect(storage.stockFood).toBe(0);
  });
});

