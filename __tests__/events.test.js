import { on, off, emit } from '../events/events.js';

test('on/emit/off works for events', () => {
  let value = 0;
  function handler(payload) {
    value += payload;
  }

  on('tick', handler);
  emit('tick', 1);
  expect(value).toBe(1);

  off('tick', handler);
  emit('tick', 1);
  expect(value).toBe(1);
});

test('birth, death and building-complete payloads', () => {
  const births = [];
  const deaths = [];
  const builds = [];
  function bh(p) { births.push(p); }
  function dh(p) { deaths.push(p); }
  function ch(p) { builds.push(p); }

  on('birth', bh);
  on('death', dh);
  on('building-complete', ch);

  const bData = { id: 1, x: 2, y: 3 };
  const dData = { id: 2, x: 4, y: 5 };
  const cData = { type: 'house', x: 5, y: 6 };
  emit('birth', bData);
  emit('death', dData);
  emit('building-complete', cData);

  expect(births[0]).toEqual(bData);
  expect(deaths[0]).toEqual(dData);
  expect(builds[0]).toEqual(cData);

  off('birth', bh);
  off('death', dh);
  off('building-complete', ch);
});
