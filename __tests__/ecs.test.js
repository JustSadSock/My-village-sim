import { addEntity, removeEntity, getEntities } from '../ecs/ecs.js';

test('add and remove entity', () => {
  const id1 = addEntity();
  const id2 = addEntity();
  expect(getEntities().length).toBeGreaterThanOrEqual(2);

  removeEntity(id1);
  expect(getEntities()).not.toContain(id1);

  removeEntity(id2);
  expect(getEntities()).not.toContain(id2);
});
