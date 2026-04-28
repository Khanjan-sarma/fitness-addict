import { MembershipStatus } from '../types';

export const calculateStatus = (endDateStr: string): MembershipStatus => {
  if (!endDateStr) return 'Expired';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Parse YYYY-MM-DD explicitly to avoid timezone shifts
  const [year, month, day] = endDateStr.split('-').map(Number);
  const endDate = new Date(year, month - 1, day);
  endDate.setHours(0, 0, 0, 0);

  const todayTime = today.getTime();
  const endTime = endDate.getTime();

  if (todayTime > endTime) {
    return 'Expired';
  } else if (todayTime === endTime) {
    return 'Due';
  } else {
    return 'Active';
  }
};
