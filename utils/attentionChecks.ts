import { Member } from '../types';
import { toLocalIsoDate, formatDate } from './dateUtils';

/**
 * Checks that can be answered from the CRM alone - no door terminal needed.
 *
 * Device-side problems (member not enrolled, no fingerprint, on the door but
 * not a member, ten-year windows) come from the nightly reconcile and are
 * added separately.
 *
 * Nothing here changes data. Every flag is a suggestion for a human.
 */

export type Severity = 'high' | 'medium' | 'low';

export interface PaymentRow {
  member_id: string;          // uuid of the member
  amount: number | string;
  payment_date: string;
  plan_name?: string;
}

export interface Flag {
  code: string;
  severity: Severity;
  memberUuid: string;
  memberId: string;
  name: string;
  phone: string;
  title: string;
  detail: string;
  daysOwed?: number;
}

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/** Days a plan name is worth. -1 means the receptionist chose the date herself. */
const planDays = (plan?: string): number => {
  if (!plan) return 30;
  const m = plan.match(/^\s*(\d+)\s*Month/i);
  if (m) return parseInt(m[1], 10) * 30;
  if (/custom/i.test(plan)) return -1;
  return 30;
};

const daysBetween = (fromIso: string, toIso: string): number => {
  const [y1, m1, d1] = fromIso.split('-').map(Number);
  const [y2, m2, d2] = toIso.split('-').map(Number);
  if (![y1, m1, d1, y2, m2, d2].every(Number.isFinite)) return 0;
  const a = new Date(y1, m1 - 1, d1).getTime();
  const b = new Date(y2, m2 - 1, d2).getTime();
  return Math.round((b - a) / 86400000);
};

const normName = (s: string): string =>
  (s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

export const computeFlags = (members: Member[], payments: PaymentRow[]): Flag[] => {
  const today = toLocalIsoDate();
  const flags: Flag[] = [];

  // group payments by member, newest first
  const byMember = new Map<string, PaymentRow[]>();
  for (const p of payments) {
    if (!p.member_id) continue;
    const list = byMember.get(p.member_id) || [];
    list.push(p);
    byMember.set(p.member_id, list);
  }
  byMember.forEach(list => list.sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || '')));

  // duplicate names across the whole roster
  const nameCounts = new Map<string, number>();
  for (const m of members) {
    const key = normName(m.name);
    if (!key) continue;
    nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
  }

  for (const m of members) {
    const base = {
      memberUuid: m.id,
      memberId: m.member_id || m.id.split('-')[0].toUpperCase(),
      name: m.name,
      phone: m.phone || ''
    };
    const end = m.membership_end || '';
    const mine = byMember.get(m.id) || [];
    const latest = mine[0];
    const expired = end !== '' && end < today;

    // ---------- HIGH ----------

    // Paid AFTER their membership had already ended, and it is still in the past.
    if (latest && expired && latest.payment_date > end) {
      flags.push({
        ...base,
        code: 'paid_but_expired',
        severity: 'high',
        title: 'Paid but still shows expired',
        detail: `Paid ${'\u20B9'}${latest.amount} on ${formatDate(latest.payment_date)}, but the membership ended ${formatDate(end)}. Cannot enter.`,
        daysOwed: daysBetween(end, today)
      });
    }

    // Received far less access than the plan they bought.
    if (latest && end) {
      const expect = planDays(latest.plan_name);
      const got = daysBetween(latest.payment_date, end);
      if (expect > 0 && got < Math.floor(expect * 0.6)) {
        const already = flags.some(f => f.memberUuid === m.id && f.code === 'paid_but_expired');
        if (!already) {
          flags.push({
            ...base,
            code: 'shortchanged',
            severity: 'high',
            title: 'Got less time than paid for',
            detail: `Paid for ${latest.plan_name} on ${formatDate(latest.payment_date)} but received ${got} day${got === 1 ? '' : 's'} (ends ${formatDate(end)}).`,
            daysOwed: expect - got
          });
        }
      }

      // ---------- MEDIUM ----------

      // Far more access than the payment suggests - usually a mistyped year.
      if (expect > 0 && got > expect * 2 + 60) {
        flags.push({
          ...base,
          code: 'overlong_term',
          severity: 'medium',
          title: 'Access far longer than paid for',
          detail: `Paid for ${latest.plan_name} on ${formatDate(latest.payment_date)} but has ${got} days, until ${formatDate(end)}. Check the year is right.`
        });
      }
    }

    // Membership starts in the future - the door lets them in already.
    if (m.membership_start && m.membership_start > today) {
      flags.push({
        ...base,
        code: 'future_start',
        severity: 'medium',
        title: 'Membership starts in the future',
        detail: `Starts ${formatDate(m.membership_start)}, but the door already accepts them.`
      });
    }

    // Active with no payment ever recorded.
    if (!expired && end && mine.length === 0) {
      flags.push({
        ...base,
        code: 'no_payment_record',
        severity: 'medium',
        title: 'Active with no payment recorded',
        detail: `Membership runs to ${formatDate(end)} but there is no payment on file.`
      });
    }

    // ---------- LOW ----------

    const dupCount = nameCounts.get(normName(m.name)) || 0;
    if (dupCount > 1) {
      flags.push({
        ...base,
        code: 'duplicate_name',
        severity: 'low',
        title: 'Same name as another member',
        detail: `${dupCount} members are called "${m.name}". Check you are renewing the right one.`
      });
    }

    const rawId = m.member_id ?? '';
    if (rawId !== rawId.trim() || /["']/.test(rawId)) {
      flags.push({
        ...base,
        code: 'dirty_member_id',
        severity: 'low',
        title: 'Member ID has stray characters',
        detail: `Stored as "${rawId}" - extra spaces or quotes cause mismatches with the door.`
      });
    }

    const digits = (m.phone || '').replace(/\D/g, '');
    if (digits.length < 10) {
      flags.push({
        ...base,
        code: 'no_phone',
        severity: 'low',
        title: 'No usable phone number',
        detail: m.phone ? `Stored as "${m.phone}".` : 'No phone number on file - cannot be sent renewal reminders.'
      });
    }
  }

  flags.sort((a, b) => {
    const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (s !== 0) return s;
    return (b.daysOwed || 0) - (a.daysOwed || 0);
  });

  return flags;
};

export const countBySeverity = (flags: Flag[]) => ({
  high: flags.filter(f => f.severity === 'high').length,
  medium: flags.filter(f => f.severity === 'medium').length,
  low: flags.filter(f => f.severity === 'low').length
});

/** Total days of access owed across all high-severity flags. */
export const totalDaysOwed = (flags: Flag[]): number =>
  flags.filter(f => f.severity === 'high').reduce((sum, f) => sum + (f.daysOwed || 0), 0);
