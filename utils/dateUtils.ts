export const toLocalIsoDate = (date: Date = new Date()) => {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

export const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A';

  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return dateString;
};

export const addMonthsClamped = (dateString: string, monthsToAdd: number) => {
  const [year, month, day] = dateString.split('-').map(Number);

  if (![year, month, day, monthsToAdd].every(Number.isFinite)) {
    return dateString;
  }

  const targetMonth = month - 1 + monthsToAdd;
  const lastDayOfTargetMonth = new Date(year, targetMonth + 1, 0).getDate();
  const clampedDay = Math.min(day, lastDayOfTargetMonth);

  return toLocalIsoDate(new Date(year, targetMonth, clampedDay));
};
