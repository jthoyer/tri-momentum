// Exploratory script — pulls real data from a user's intervals.icu account so we can
// see what fields are actually available before deciding what TRI Momentum should use.
// Run with: node --env-file=.env.local scripts/intervals-test.mjs [days]
//
// intervals.icu itself syncs from Strava/Garmin/TrainingPeaks/etc, so this is a single
// integration point for whatever source the athlete already has connected there.

import { writeFile, mkdir } from 'node:fs/promises';

const API_KEY = process.env.INTERVALS_API_KEY;
const ATHLETE_ID = process.env.INTERVALS_ATHLETE_ID || '0';
const DAYS = Number(process.argv[2]) || 30;

if (!API_KEY) {
  console.error('Missing INTERVALS_API_KEY. Copy backend/.env.example to backend/.env.local and fill it in.');
  process.exit(1);
}

const auth = 'Basic ' + Buffer.from(`API_KEY:${API_KEY}`).toString('base64');
const base = 'https://intervals.icu/api/v1';

async function get(path) {
  const res = await fetch(base + path, { headers: { Authorization: auth } });
  if (!res.ok) {
    throw new Error(`${path} -> ${res.status} ${res.statusText}: ${await res.text()}`);
  }
  return res.json();
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function keyUnion(records) {
  const keys = new Set();
  for (const r of records) Object.keys(r).forEach((k) => keys.add(k));
  return [...keys].sort();
}

async function main() {
  const newest = new Date();
  const oldest = new Date(newest.getTime() - DAYS * 24 * 60 * 60 * 1000);
  const range = `oldest=${isoDate(oldest)}&newest=${isoDate(newest)}`;

  console.log(`Fetching last ${DAYS} days for athlete "${ATHLETE_ID}"...\n`);

  const [profile, activities, wellness] = await Promise.all([
    get(`/athlete/${ATHLETE_ID}`),
    get(`/athlete/${ATHLETE_ID}/activities?${range}`),
    get(`/athlete/${ATHLETE_ID}/wellness?${range}`),
  ]);

  console.log('=== Athlete profile ===');
  console.log(`Name: ${profile.name ?? '(none)'}  Sex: ${profile.sex ?? '?'}`);
  console.log(`Fields present: ${Object.keys(profile).sort().join(', ')}\n`);

  console.log(`=== Activities (${activities.length}) ===`);
  for (const a of activities) {
    console.log(`${a.start_date_local?.slice(0, 10) ?? '?'}  ${a.type ?? '?'}  ${a.name ?? ''}`);
  }
  console.log(`\nFields seen across all activities: ${keyUnion(activities).join(', ')}\n`);

  console.log(`=== Wellness (${wellness.length}) ===`);
  for (const w of wellness) {
    console.log(`${w.id ?? '?'}  readiness=${w.readiness ?? '-'} hrv=${w.hrv ?? '-'} restingHR=${w.restingHR ?? '-'} sleepSecs=${w.sleepSecs ?? '-'}`);
  }
  console.log(`\nFields seen across all wellness records: ${keyUnion(wellness).join(', ')}\n`);

  await mkdir(new URL('../tmp/', import.meta.url), { recursive: true });
  await writeFile(new URL('../tmp/profile.json', import.meta.url), JSON.stringify(profile, null, 2));
  await writeFile(new URL('../tmp/activities.json', import.meta.url), JSON.stringify(activities, null, 2));
  await writeFile(new URL('../tmp/wellness.json', import.meta.url), JSON.stringify(wellness, null, 2));
  console.log('Raw responses saved to backend/tmp/*.json for closer inspection.');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
