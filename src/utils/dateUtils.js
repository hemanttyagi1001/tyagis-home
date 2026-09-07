export function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getToday() {
  return formatDate(new Date());
}

// Built from the parts rather than new Date('2026-09-07'), which the spec reads
// as UTC midnight - west of Greenwich that lands on the previous day. Passing
// day + n to the constructor rolls months and years over on its own.
export function addDays(dateStr, days) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return formatDate(new Date(year, month - 1, day + days));
}

// Every date from start to end, inclusive. ISO strings sort chronologically, so
// the bound is a plain string compare; start after end gives an empty list.
export function datesInRange(start, end) {
  const dates = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

export function getMonthDays(year, month) {
  return new Date(year, month, 0).getDate();
}

export function getMonthName(month) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1];
}

export function getShortMonthName(month) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[month - 1];
}

export function getDayName(dayIndex) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[dayIndex];
}

export function getFirstDayOfMonth(year, month) {
  return new Date(year, month - 1, 1).getDay();
}

export function getCurrentMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function getPreviousMonth(year, month) {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

export function getNextMonth(year, month) {
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

export function isFutureDate(dateStr) {
  const today = getToday();
  return dateStr > today;
}

export function isCurrentOrLastMonth(year, month) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const prev = getPreviousMonth(currentYear, currentMonth);

  return (
    (year === currentYear && month === currentMonth) ||
    (year === prev.year && month === prev.month)
  );
}
