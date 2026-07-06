export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const SESSION_ICONS = {
  swim: '🏊',
  bike: '🚴',
  run: '🏃',
  brick: '⚡',
  strength: '💪',
  rest: '😴',
};

export const SESSION_LABELS = {
  swim: 'Swim',
  bike: 'Bike',
  run: 'Run',
  brick: 'Brick',
  strength: 'Strength',
  rest: 'Rest / easy',
};

export const SESSION_ABBR = {
  swim: 'SW',
  bike: 'BI',
  run: 'RU',
  brick: 'BK',
  strength: 'ST',
  rest: '—',
};

export const PILLAR_CYCLE = [
  { p: 1, label: 'Foundations', cls: 'p1' },
  { p: 2, label: 'Technique',   cls: 'p2' },
  { p: 3, label: 'Durability',  cls: 'p3' },
  { p: 4, label: 'Intensity',   cls: 'p4' },
  { p: 5, label: 'Race craft',  cls: 'p5' },
  { p: 6, label: 'Integration', cls: 'p6' },
];

export const PHASES_39 = [
  { label: 'Base building',          weeks: [1,2,3,4,5,6,7],          defaultCadence: 'base' },
  { label: 'Build 1',                weeks: [8,9,10,11,12,13,14],      defaultCadence: 'build' },
  { label: 'Build 2',                weeks: [15,16,17,18,19,20,21],    defaultCadence: 'build' },
  { label: 'Race preparation',       weeks: [22,23,24,25,26],          defaultCadence: 'peak' },
  { label: 'Recovery',               weeks: [27],                      defaultCadence: 'taper' },
  { label: 'Second cycle — base',    weeks: [28,29,30,31,32,33,34],    defaultCadence: 'base' },
  { label: 'Second cycle — build',   weeks: [35,36,37,38,39],          defaultCadence: 'build' },
];
