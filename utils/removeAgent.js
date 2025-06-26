export function removeAgent(i, world) {
  const {
    posX, posY, homeId, parentA, parentB, spouse,
    age, hunger, thirst, energy,
    skillFood, skillWood, workTimer, jobType, role,
    buildX, buildY, carryFood, carryWood,
    morale, friend,
    houseOccupants, reserved
  } = world;
  let { agentCount } = world;

  if (spouse[i] >= 0 && spouse[spouse[i]] === i) spouse[spouse[i]] = -1;
  const lastId = --agentCount;
  if (homeId[i] >= 0) houseOccupants[homeId[i]]--;

  posX[i] = posX[lastId];
  posY[i] = posY[lastId];
  homeId[i] = homeId[lastId];
  if (homeId[i] >= 0) houseOccupants[homeId[i]]++;
  parentA[i] = parentA[lastId];
  parentB[i] = parentB[lastId];
  spouse[i] = spouse[lastId];
  age[i] = age[lastId];
  hunger[i] = hunger[lastId];
  thirst[i] = thirst[lastId];
  energy[i] = energy[lastId];
  skillFood[i] = skillFood[lastId];
  skillWood[i] = skillWood[lastId];
  workTimer[i] = workTimer[lastId];
  jobType[i] = jobType[lastId];
  role[i] = role[lastId];
  buildX[i] = buildX[lastId];
  buildY[i] = buildY[lastId];
  carryFood[i] = carryFood[lastId];
  carryWood[i] = carryWood[lastId];
  if (morale) morale[i] = morale[lastId];
  if (friend) friend[i] = friend[lastId];

  for (let r = 0; r < reserved.length; r++) {
    if (reserved[r] === i) reserved[r] = -1;
  }

  for (let r = 0; r < reserved.length; r++) {
    if (reserved[r] >= agentCount) reserved[r] = -1;
  }

  if (friend) {
    for (let f = 0; f < agentCount; f++) {
      if (friend[f] === lastId) friend[f] = i;
      if (friend[f] >= agentCount) friend[f] = -1;
    }
  }

  world.agentCount = agentCount;
}
