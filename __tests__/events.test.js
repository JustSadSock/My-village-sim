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
