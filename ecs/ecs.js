// ecs/ecs.js — простейший менеджер сущностей

let _nextEntityId = 0;
const activeEntities = new Set();

/**
 * Создаёт новую сущность и возвращает её ID.
 */
export function addEntity() {
  const id = _nextEntityId++;
  activeEntities.add(id);
  return id;
}

/**
 * Удаляет сущность из активного списка.
 */
export function removeEntity(id) {
  activeEntities.delete(id);
}

/**
 * Возвращает массив всех активных ID.
 */
export function getEntities() {
  return Array.from(activeEntities);
}
