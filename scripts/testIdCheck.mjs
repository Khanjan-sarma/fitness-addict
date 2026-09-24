/**
 * Proves the new ID rules against the REAL device roster and member list.
 * Run:  node scripts/testIdCheck.mjs
 */
import { readFileSync } from 'fs';

// --- inline the logic under test (same source as utils/idCheck.ts) ---------
const normId = (s) => {
  if (!s) return '';
  const t = String(s).toUpperCase().replace(/[^0-9A-Z]/g, '');
  return t.replace(/^0+/, '');
};
const normName = (s) => (s || '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
const bigrams = (s) => { const t = s.replace(/ /g, ''); const o = []; for (let i = 0; i < t.length - 1; i++) o.push(t.slice(i, i + 2)); return o; };
const dice = (a, b) => {
  const x = normName(a), y = normName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const A = bigrams(x), B = bigrams(y);
  if (!A.length || !B.length) return 0;
  const pool = B.slice(); let hits = 0;
  for (const g of A) { const i = pool.indexOf(g); if (i >= 0) { hits++; pool.splice(i, 1); } }
  return (2 * hits) / (A.length + B.length);
};
const NAME_MATCH_MIN = 0.80;

const checkId = (rawId, taken, rawName = '') => {
  const k = normId(rawId);
  if (!k) return { severity: 'allow', linkDeviceId: null, message: '', nameScore: 0 };
  const inCrm = taken.crm.get(k);
  const onDoor = taken.door.get(k);
  if (inCrm !== undefined) {
    if (onDoor !== undefined) {
      const score = dice(inCrm, onDoor);
      if (score < NAME_MATCH_MIN) return { severity: 'block', linkDeviceId: null, nameScore: score, message: `Two different people already use this ID: member ${inCrm}, and ${onDoor} on the door.` };
    }
    return { severity: 'block', linkDeviceId: null, nameScore: 0, message: `This is already ${inCrm}'s ID.` };
  }
  if (onDoor !== undefined) {
    const claimedBy = taken.claimed.get(k);
    const score = dice(rawName, onDoor);
    if (score >= NAME_MATCH_MIN) {
      if (claimedBy) return { severity: 'confirm', linkDeviceId: null, nameScore: score, message: `Door record ${rawId} (${onDoor}) is already linked to ${claimedBy}.` };
      return { severity: 'allow', linkDeviceId: k, nameScore: score, message: `Matches ${onDoor} already enrolled at the door. They will be linked automatically.` };
    }
    return { severity: 'confirm', linkDeviceId: null, nameScore: score, message: `ID ${rawId} is already on the door as ${onDoor}.` };
  }
  return { severity: 'allow', linkDeviceId: null, nameScore: 0, message: '' };
};

// --- load live data -------------------------------------------------------
const SB = 'https://watcdqtbhvmqtogyeand.supabase.co';
const KEY = readFileSync('scripts/.sbkey', 'utf8').trim();
const get = async (path) => {
  const r = await fetch(`${SB}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
};

const members = await get('members?select=member_id,name,hik_person_id&limit=20000');
const device  = await get('hik_device_ids?select=employee_no,name&limit=2000');

const crm = new Map(), door = new Map(), claimed = new Map();
for (const m of members) {
  const k = normId(m.member_id); if (k) crm.set(k, (m.name || '').trim());
  const l = normId(m.hik_person_id); if (l) claimed.set(l, (m.name || '').trim());
}
for (const d of device) { const k = normId(d.employee_no); if (k) door.set(k, (d.name || '').trim()); }
const taken = { crm, door, claimed };
console.log(`loaded ${members.length} members, ${device.length} device records\n`);

// --- the cases that matter ----------------------------------------------
const cases = [
  { id: '605', name: 'DOROTHI GHOSH',    want: 'allow',   why: 'the owner\'s bug: enrolled at door first, no CRM member holds 605' },
  { id: '605', name: 'RAJU DAS',         want: 'confirm', why: 'same ID but a different person - must warn, must not link' },
  { id: '552', name: 'SAGAR SUTRADHAR',  want: 'block',   why: 'device 552 is RITU AHMED - the original disaster, still blocked' },
  { id: '606', name: 'OLIVA GHOSH',      want: 'allow',   why: 'another door-only record, should link' },
  { id: '0605', name: 'DOROTHI GHOSH',   want: 'allow',   why: 'leading zero must normalise to 605' },
  { id: '99999999', name: 'BRAND NEW',   want: 'allow',   why: 'unused number, nothing to say' },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const r = checkId(c.id, taken, c.name);
  const ok = r.severity === c.want;
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  id=${c.id.padEnd(9)} name=${c.name.padEnd(17)} got=${r.severity.padEnd(7)} want=${c.want.padEnd(7)} link=${String(r.linkDeviceId).padEnd(8)} score=${r.nameScore.toFixed(2)}`);
  console.log(`      ${c.why}`);
  if (r.message) console.log(`      msg: ${r.message}`);
}

// --- how many of the 248 blocked records does this unblock? -------------
let unblocked = 0, wouldConfirm = 0;
for (const [k, dname] of door) {
  if (crm.has(k)) continue;
  const r = checkId(k, taken, dname);      // staff typing the same name as the door
  if (r.severity === 'allow' && r.linkDeviceId) unblocked++;
  else if (r.severity === 'confirm') wouldConfirm++;
}
console.log(`\ndoor-only IDs that now go straight through and auto-link : ${unblocked}`);
console.log(`door-only IDs that still ask for a tick                 : ${wouldConfirm}`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
