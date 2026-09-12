import { toLocalIsoDate, addMonthsClamped } from './dateUtils';

/**
 * Renewal policy.
 *
 * A member who renews a few days late is treated normally - their new date is
 * counted from their old expiry so they keep their billing day.
 *
 * A member who has been gone longer than the grace period is NOT renewed
 * automatically. The receptionist is shown a notice and enters the end date
 * herself, because how to treat a long absence is a business decision
 * (rejoining fee, goodwill, owner approval) that software should not guess.
 *
 * Underneath both paths one rule always applies: a renewal can never save an
 * end date earlier than today. That guard is what stops a member paying and
 * still being refused at the door.
 */

/** Days past expiry that still count as a normal renewal. */
export const RENEWAL_GRACE_DAYS = 7;

/** Shown to the receptionist when a member has been away longer than the grace period. */
export const LAPSED_NOTICE =
  'This membership expired a while ago, so no dates have been filled in automatically. ' +
  'Set the new end date below.';

/** Whole days between a YYYY-MM-DD date and today. Positive = in the past. */
export const daysSince = (dateString: string): number => {
  if (!dateString) return 0;
  const [y, m, d] = dateString.split('-').map(Number);
  if (![y, m, d].every(Number.isFinite)) return 0;
  const then = new Date(y, m - 1, d);
  const today = new Date();
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((midnight.getTime() - then.getTime()) / 86400000);
};

/**
 * True when the member has been expired for longer than the grace period.
 * A missing end date also counts as lapsed - there is nothing to count from,
 * so the receptionist must set the date herself rather than hit a dead end.
 */
export const isLapsed = (membershipEnd: string): boolean => {
  if (!membershipEnd) return true;
  return daysSince(membershipEnd) > RENEWAL_GRACE_DAYS;
};

/** A sensible starting suggestion for a lapsed member: one month from today. */
export const suggestedRestartDate = (): string =>
  addMonthsClamped(toLocalIsoDate(), 1);

/** True when the date is today or later. Renewals must never save anything else. */
export const isTodayOrLater = (dateString: string): boolean => {
  if (!dateString) return false;
  return dateString >= toLocalIsoDate();
};

/** Human wording for how long someone has been gone. */
export const describeGap = (membershipEnd: string): string => {
  if (!membershipEnd) return 'no end date on record';
  const days = daysSince(membershipEnd);
  if (days <= 0) return 'not expired yet';
  if (days === 1) return '1 day';
  if (days < 60) return `${days} days`;
  const months = Math.floor(days / 30);
  return `${days} days (about ${months} months)`;
};
