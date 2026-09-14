import { supabase } from '../services/supabase';

/**
 * Tells the door terminal that a member's dates changed.
 *
 * Only the member's row id is sent - never the dates. n8n reads the dates from
 * Supabase itself, so a tampered request cannot grant anyone access beyond what
 * the database already says.
 *
 * The logged-in user's Supabase token is sent so n8n can confirm the caller is
 * real staff.
 *
 * This must never block saving a renewal. If it fails, the nightly reconcile
 * re-derives every difference from scratch and fixes it.
 */

const HOOK_URL = 'https://fitnessaddict.duckdns.org/webhook/hik-sync';

export type DoorOutcome =
  | 'written_and_verified'
  | 'already_correct'
  | 'not_enrolled'
  | 'ambiguous_link'
  | 'not_on_device'
  | 'token_dead'
  | 'device_unreachable'
  | 'write_failed'
  | 'verify_failed'
  | 'unreachable';

export interface DoorResult {
  ok: boolean;
  outcome: DoorOutcome | string;
  message: string;
}

/** Short sentence for the front desk. Silence is wrong here - they need to know. */
const describe = (outcome: string, ok: boolean): string => {
  switch (outcome) {
    case 'written_and_verified': return 'Door updated';
    case 'already_correct':      return 'Door already correct';
    case 'not_enrolled':         return 'Not enrolled at the door - scan their finger at the terminal';
    case 'not_on_device':        return 'No door record found - needs enrolling at the terminal';
    case 'ambiguous_link':       return 'Door record does not match this member - needs checking';
    case 'token_dead':           return 'Door offline (login expired) - will sync tonight';
    case 'device_unreachable':   return 'Door not responding - will sync tonight';
    case 'write_failed':         return 'Door did not accept the change - will sync tonight';
    case 'verify_failed':        return 'Door change could not be confirmed - will sync tonight';
    case 'unreachable':          return 'Could not reach the door service - will sync tonight';
    default:                     return ok ? 'Door updated' : 'Door not updated - will sync tonight';
  }
};

export const syncMemberToDoor = async (memberUuid: string): Promise<DoorResult> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(HOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
      },
      body: JSON.stringify({ id: memberUuid, action: 'renew' })
    });

    if (res.status === 401) {
      return { ok: false, outcome: 'unreachable', message: 'Door service refused the login' };
    }
    const data = await res.json().catch(() => null);
    if (!data) {
      return { ok: false, outcome: 'unreachable', message: describe('unreachable', false) };
    }
    const outcome = String(data.reason || '');
    return { ok: Boolean(data.ok), outcome, message: describe(outcome, Boolean(data.ok)) };
  } catch {
    return { ok: false, outcome: 'unreachable', message: describe('unreachable', false) };
  }
};
