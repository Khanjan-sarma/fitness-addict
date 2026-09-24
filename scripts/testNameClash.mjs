/**
 * Namesake handling, checked against the live member list.
 * Needs scripts/.sbkey (gitignored).
 */
import { readFileSync } from 'fs';

const normId = (s) => { if (!s) return ''; const t = String(s).toUpperCase().replace(/[^0-9A-Z]/g, ''); return t.replace(/^0+/, ''); };
const normName = (s) => (s || '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
const normPhone = (s) => { const d = String(s || '').replace(/\D/g, ''); return d.length > 10 ? d.slice(-10) : d; };
const bigrams = (s) => { const t = s.replace(/ /g, ''); const o = []; for (let i = 0; i < t.length - 1; i++) o.push(t.slice(i, i + 2)); return o; };
const dice = (a, b) => {
  const x = normName(a), y = normName(b);
  if (!x || !y) return 0; if (x === y) return 1;
  const A = bigrams(x), B = bigrams(y); if (!A.length || !B.length) return 0;
  const pool = B.slice(); let h = 0;
  for (const g of A) { const i = pool.indexOf(g); if (i >= 0) { h++; pool.splice(i, 1); } }
  return (2 * h) / (A.length + B.length);
};

const findNameClash = (rawName, rawPhone, taken) => {
  const n = normName(rawName);
  if (!n || n.length < 3) return { kind: 'none', others: [] };
  const phone = normPhone(rawPhone);
  if (!phone) return { kind: 'none', others: [] };
  const sameBoth = taken.members.filter((m) => { const mn = normName(m.name); if (!mn) return false; if (normPhone(m.phone) !== phone) return false; return mn === n || dice(mn, n) >= 0.92; });
  return sameBoth.length ? { kind: 'likely_same_person', others: sameBoth } : { kind: 'none', others: [] };
};

const SB = 'https://watcdqtbhvmqtogyeand.supabase.co';
const KEY = readFileSync('scripts/.sbkey', 'utf8').trim();
const get = async (p) => { const r = await fetch(`${SB}/rest/v1/${p}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }); return r.json(); };

const members = await get('members?select=member_id,name,phone,membership_end,hik_person_id&limit=20000');
const device = await get('hik_device_ids?select=employee_no,name&limit=2000');
const doorNames = new Map();
for (const d of device) { const n = normName(d.name); if (n) { const l = doorNames.get(n) || []; l.push(d.employee_no); doorNames.set(n, l); } }
const taken = { members, doorNames };
console.log(`loaded ${members.length} members, ${device.length} device records\n`);

// ---- how many duplicate names actually exist? ----
const byName = new Map();
for (const m of members) { const n = normName(m.name); if (!n) continue; const l = byName.get(n) || []; l.push(m); byName.set(n, l); }
const dupNames = [...byName.entries()].filter(([, l]) => l.length > 1);
let samePhoneGroups = 0;
console.log(`names shared by more than one member : ${dupNames.length}`);
for (const [n, l] of dupNames) {
  const phones = new Set(l.map((m) => normPhone(m.phone)).filter(Boolean));
  const flag = phones.size < l.length ? '  <-- SAME PHONE TOO, likely duplicate records' : '';
  if (phones.size < l.length) samePhoneGroups++;
  console.log(`  ${n}  x${l.length}  ids=[${l.map((m) => m.member_id || '?').join(', ')}]  phones=${phones.size}${flag}`);
  const onDoor = doorNames.get(n) || [];
  if (onDoor.length) console.log(`      door records with this name: ${onDoor.join(', ')}`);
}
console.log(`\ngroups where two records share a name AND a phone : ${samePhoneGroups}`);

// ---- the three behaviours ----
console.log('\n=== behaviour checks ===');
const cases = [];
if (dupNames.length) {
  const [n, l] = dupNames[0];
  cases.push({ name: l[0].name, phone: l[0].phone, want: 'likely_same_person', why: 'existing member re-entered with their own phone' });
  cases.push({ name: l[0].name, phone: '9999900001', want: 'none', why: 'same name but a different phone -> genuine namesake, no warning now' });
}
cases.push({ name: 'ZZQQ TESTPERSON', phone: '9999900002', want: 'none', why: 'brand new name, nothing to say' });

let pass = 0, fail = 0;
for (const c of cases) {
  const r = findNameClash(c.name, c.phone, taken);
  const ok = r.kind === c.want;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  name="${c.name}" phone=${c.phone}  got=${r.kind}  want=${c.want}`);
  console.log(`      ${c.why}`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

