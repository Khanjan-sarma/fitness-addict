/**
 * Member ID conflict checking.
 *
 * An ID can already be taken in two places:
 *   - by another CRM member  (members.member_id)
 *   - by a record on the door terminal (hik_device_ids), which may belong to
 *     somebody who is not a member at all - staff, a test record, or someone
 *     enrolled before their paperwork was done
 *
 * The second case is the dangerous one and used to be invisible here. Device
 * record 552 is RITU AHMED while CRM member 552 is SAGAR SUTRADHAR: two people,
 * one number, and nothing looks wrong on screen.
 *
 * IDs are compared after normalising, because the terminal treats "0312" and
 * "312" as the same person.
 */

export interface DeviceId {
  employee_no: string;
  name?: string | null;
  has_fingerprint?: boolean | null;
}

export interface IdConflict {
  taken: boolean;
  where: 'crm' | 'door' | 'both' | null;
  holder: string;
  message: string;
}

/** Same rule the sync uses: strip punctuation, uppercase, drop leading zeros. */
export const normId = (s: string): string => {
  if (!s) return '';
  const t = String(s).toUpperCase().replace(/[^0-9A-Z]/g, '');
  return t.replace(/^0+/, '');
};

export interface TakenMap {
  crm: Map<string, string>;    // normalised id -> member name
  door: Map<string, string>;   // normalised id -> device record name
}

export const buildTakenMap = (
  members: { member_id?: string | null; name?: string | null }[],
  deviceIds: DeviceId[]
): TakenMap => {
  const crm = new Map<string, string>();
  const door = new Map<string, string>();
  for (const m of members) {
    const k = normId(m.member_id || '');
    if (k) crm.set(k, (m.name || '').trim());
  }
  for (const d of deviceIds) {
    const k = normId(d.employee_no || '');
    if (k) door.set(k, (d.name || '').trim());
  }
  return { crm, door };
};

export const checkId = (raw: string, taken: TakenMap): IdConflict => {
  const k = normId(raw);
  if (!k) return { taken: false, where: null, holder: '', message: '' };

  const inCrm = taken.crm.get(k);
  const onDoor = taken.door.get(k);

  // Used in both places. If the two names differ, this ID means DIFFERENT
  // PEOPLE on each side - the dangerous case, and the point the receptionist
  // needs to understand immediately.
  if (inCrm !== undefined && onDoor !== undefined) {
    const sameName =
      inCrm && onDoor &&
      inCrm.toUpperCase().replace(/[^A-Z0-9]/g, '') === onDoor.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (sameName) {
      return {
        taken: true,
        where: 'both',
        holder: inCrm,
        message: `This is already ${inCrm}'s ID.`
      };
    }
    return {
      taken: true,
      where: 'both',
      holder: inCrm || onDoor,
      message:
        `Two different people already use this ID: member ${inCrm || '(no name)'}, ` +
        `and ${onDoor || 'an unnamed record'} on the door. Pick a different one.`
    };
  }
  if (inCrm !== undefined) {
    return {
      taken: true,
      where: 'crm',
      holder: inCrm,
      message: `This is already ${inCrm || '(no name)'}'s ID.`
    };
  }
  if (onDoor !== undefined) {
    return {
      taken: true,
      where: 'door',
      holder: onDoor,
      message: `${onDoor || 'An unnamed record'} already uses this ID on the door, but is not a member. Using it would give two people one ID.`
    };
  }
  return { taken: false, where: null, holder: '', message: '' };
};

/**
 * Lowest numeric IDs free in BOTH places. These are safe to type here and to
 * use at the terminal, which keeps the CRM and the door in agreement from the
 * start and saves the sync from having to guess by name.
 */
export const suggestFreeIds = (taken: TakenMap, count = 5, limit = 4000): string[] => {
  const out: string[] = [];
  for (let n = 1; n <= limit && out.length < count; n++) {
    const k = normId(String(n));
    if (!taken.crm.has(k) && !taken.door.has(k)) out.push(String(n));
  }
  return out;
};
