/**
 * Member ID conflict checking.
 *
 * An ID can already be taken in two places:
 *   - by another CRM member  (members.member_id)
 *   - by a record on the door terminal (hik_device_ids)
 *
 * The original version of this file treated BOTH as a conflict and refused the
 * ID. That was wrong, and it blocked the normal way staff actually work:
 * enrol the finger at the terminal first, let the device hand out a number,
 * then type that number into the CRM. Device 605 is DOROTHI GHOSH and no CRM
 * member holds 605 - typing 605 for Dorothi is correct, not a duplicate.
 * 248 device records are in that state.
 *
 * The question is not "does this ID exist" but "does it belong to SOMEBODY
 * ELSE". So:
 *
 *   another CRM member holds it            -> block   (a real duplicate)
 *   on the door, name matches this member   -> allow   (same person; link it)
 *   on the door, name does not match        -> confirm (staff must tick)
 *   in the CRM and on the door, names differ-> block   (the 552 case:
 *                                               device 552 = RITU AHMED,
 *                                               CRM 552 = SAGAR SUTRADHAR)
 *
 * IDs are compared after normalising, because the terminal treats "0312" and
 * "312" as the same person.
 */

export interface DeviceId {
  employee_no: string;
  name?: string | null;
  has_fingerprint?: boolean | null;
}

/** allow = nothing to say, confirm = staff must tick, block = cannot proceed */
export type IdSeverity = 'allow' | 'confirm' | 'block';

export interface IdConflict {
  severity: IdSeverity;
  where: 'crm' | 'door' | 'both' | null;
  holder: string;
  message: string;
  /**
   * Device record this member can safely be linked to, when the ID is on the
   * door, the name agrees, and no other member has claimed it. Saving this as
   * hik_person_id means the nightly sync manages the member from day one
   * instead of ignoring them until someone runs a repair by hand.
   */
  linkDeviceId: string | null;
  /** how close the typed name is to the name on the door record, 0..1 */
  nameScore: number;
}

/** Same rule the sync uses: strip punctuation, uppercase, drop leading zeros. */
export const normId = (s: string): string => {
  if (!s) return '';
  const t = String(s).toUpperCase().replace(/[^0-9A-Z]/g, '');
  return t.replace(/^0+/, '');
};

/** Same name normalisation as the door sync. */
export const normName = (s: string): string =>
  (s || '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();

const bigrams = (s: string): string[] => {
  const t = s.replace(/ /g, '');
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  return out;
};

/**
 * Dice coefficient, the same measure the door sync uses to confirm a name
 * before it writes. ALTAF RAHMAN vs ALTAF RAHAMAN scores 0.89; a genuine
 * mismatch scores near 0.
 */
export const dice = (a: string, b: string): number => {
  const x = normName(a), y = normName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const A = bigrams(x), B = bigrams(y);
  if (!A.length || !B.length) return 0;
  const pool = B.slice();
  let hits = 0;
  for (const g of A) {
    const i = pool.indexOf(g);
    if (i >= 0) { hits++; pool.splice(i, 1); }
  }
  return (2 * hits) / (A.length + B.length);
};

/** The sync refuses to write below this. Same bar here. */
export const NAME_MATCH_MIN = 0.80;

export interface TakenMap {
  crm: Map<string, string>;     // normalised member_id -> member name
  door: Map<string, string>;    // normalised employee_no -> device record name
  claimed: Map<string, string>; // normalised hik_person_id -> member who holds it
}

export const buildTakenMap = (
  members: { member_id?: string | null; name?: string | null; hik_person_id?: string | null }[],
  deviceIds: DeviceId[]
): TakenMap => {
  const crm = new Map<string, string>();
  const door = new Map<string, string>();
  const claimed = new Map<string, string>();
  for (const m of members) {
    const k = normId(m.member_id || '');
    if (k) crm.set(k, (m.name || '').trim());
    const l = normId(m.hik_person_id || '');
    if (l) claimed.set(l, (m.name || '').trim());
  }
  for (const d of deviceIds) {
    const k = normId(d.employee_no || '');
    if (k) door.set(k, (d.name || '').trim());
  }
  return { crm, door, claimed };
};

const none = (): IdConflict =>
  ({ severity: 'allow', where: null, holder: '', message: '', linkDeviceId: null, nameScore: 0 });

/**
 * @param rawId  what the receptionist typed in the ID box
 * @param rawName the name being entered on the same form - needed to tell
 *                "this is the same person" from "this is somebody else"
 */
export const checkId = (rawId: string, taken: TakenMap, rawName = ''): IdConflict => {
  const k = normId(rawId);
  if (!k) return none();

  const inCrm = taken.crm.get(k);
  const onDoor = taken.door.get(k);

  // ---- in the CRM already: somebody else is this member. Always a duplicate.
  if (inCrm !== undefined) {
    if (onDoor !== undefined) {
      const score = dice(inCrm, onDoor);
      if (score < NAME_MATCH_MIN) {
        return {
          severity: 'block', where: 'both', holder: inCrm || onDoor, nameScore: score,
          linkDeviceId: null,
          message:
            `Two different people already use this ID: member ${inCrm || '(no name)'}, ` +
            `and ${onDoor || 'an unnamed record'} on the door. Pick a different one.`
        };
      }
    }
    return {
      severity: 'block', where: 'crm', holder: inCrm, nameScore: 0, linkDeviceId: null,
      message: `This is already ${inCrm || '(no name)'}'s ID.`
    };
  }

  // ---- on the door only. Nobody in the CRM holds it, so this is very likely
  //      the person who was just enrolled at the terminal.
  if (onDoor !== undefined) {
    const alreadyClaimed = taken.claimed.get(k);
    const score = dice(rawName, onDoor);

    if (score >= NAME_MATCH_MIN) {
      if (alreadyClaimed) {
        // the device record is spoken for - do not steal the link
        return {
          severity: 'confirm', where: 'door', holder: onDoor, nameScore: score, linkDeviceId: null,
          message:
            `Door record ${rawId.trim()} (${onDoor}) is already linked to member ${alreadyClaimed}. ` +
            `The ID can still be used, but the door link will not be set automatically.`
        };
      }
      return {
        severity: 'allow', where: 'door', holder: onDoor, nameScore: score, linkDeviceId: k,
        message: `Matches ${onDoor} already enrolled at the door. They will be linked automatically.`
      };
    }

    // name does not agree - could be a spelling variant, could be a different
    // person. Only the receptionist can tell, so inform and let them decide.
    return {
      severity: 'confirm', where: 'door', holder: onDoor, nameScore: score, linkDeviceId: null,
      message:
        `ID ${rawId.trim()} is already on the door as ${onDoor || 'an unnamed record'}. ` +
        `If that is not this person, use a different ID or two people will share one number.`
    };
  }

  return none();
};

/** Kept for the error text and the hint under the field. */
export const isBlocked = (c: IdConflict): boolean => c.severity === 'block';

/**
 * Lowest numeric IDs free in BOTH places. Safe to type here and to use at the
 * terminal, which keeps the CRM and the door in agreement from the start.
 */
export const suggestFreeIds = (taken: TakenMap, count = 5, limit = 4000): string[] => {
  const out: string[] = [];
  for (let n = 1; n <= limit && out.length < count; n++) {
    const k = normId(String(n));
    if (!taken.crm.has(k) && !taken.door.has(k)) out.push(String(n));
  }
  return out;
};
