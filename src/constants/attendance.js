export const ATTENDANCE_STATUS = {
  FULL_DAY: 'full_day',
  FIRST_HALF: 'first_half',
  SECOND_HALF: 'second_half',
  LEAVE: 'leave',
};

export const ATTENDANCE_LABELS = {
  [ATTENDANCE_STATUS.FULL_DAY]: 'Full Day',
  [ATTENDANCE_STATUS.FIRST_HALF]: '1st Half',
  [ATTENDANCE_STATUS.SECOND_HALF]: '2nd Half',
  [ATTENDANCE_STATUS.LEAVE]: 'Leave',
};

export const ATTENDANCE_SHORT = {
  [ATTENDANCE_STATUS.FULL_DAY]: 'P',
  [ATTENDANCE_STATUS.FIRST_HALF]: '½',
  [ATTENDANCE_STATUS.SECOND_HALF]: '½',
  [ATTENDANCE_STATUS.LEAVE]: 'L',
};

export const EMPLOYEE_TYPE = {
  DAILY: 'daily',
  MONTHLY: 'monthly',
};
