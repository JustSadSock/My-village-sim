// events/events.js — минимальный EventEmitter для симуляции

const listeners = {};
export const eventQueue = [];

/**
 * Подписаться на событие.
 * @param {string} event — имя события
 * @param {Function} fn — обработчик (payload) => void
 */
export function on(event, fn) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(fn);
}

/**
 * Отписаться от события.
 * @param {string} event
 * @param {Function} fn
 */
export function off(event, fn) {
  const arr = listeners[event];
  if (!arr) return;
  const idx = arr.indexOf(fn);
  if (idx !== -1) arr.splice(idx, 1);
}

/**
 * Вызвать событие для всех подписчиков.
 * @param {string} event
 * @param {any} payload
 */
export function emit(event, payload) {
  const arr = listeners[event];
  if (arr) {
    // копируем, чтобы обработчики могли отписываться во время итерации
    arr.slice().forEach(fn => {
      try {
        fn(payload);
      } catch (e) {
        console.error(`Error in handler for "${event}":`, e);
      }
    });
  }
  eventQueue.push({ type: event, payload });
}
