export interface GregorianDateParts {
  gy: number;
  gm: number;
  gd: number;
}

export interface JalaliDateParts {
  jy: number;
  jm: number;
  jd: number;
}

const div = (a: number, b: number) => Math.floor(a / b);
const mod = (a: number, b: number) => a - Math.floor(a / b) * b;

const isGregorianLeap = (year: number) => (
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
);

export function toGregorianFromJalali(jy: number, jm: number, jd: number): GregorianDateParts {
  let jalaliYear = jy + 1595;
  let days = -355668
    + (365 * jalaliYear)
    + (div(jalaliYear, 33) * 8)
    + div((jalaliYear % 33) + 3, 4)
    + jd
    + (jm < 7 ? ((jm - 1) * 31) : (((jm - 7) * 30) + 186));

  let gy = 400 * div(days, 146097);
  days %= 146097;

  if (days > 36524) {
    gy += 100 * div(days - 1, 36524);
    days = (days - 1) % 36524;

    if (days >= 365) {
      days += 1;
    }
  }

  gy += 4 * div(days, 1461);
  days %= 1461;

  if (days > 365) {
    gy += div(days - 1, 365);
    days = (days - 1) % 365;
  }

  let gd = days + 1;
  const monthDays = [0, 31, isGregorianLeap(gy) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 1;

  while (gm <= 12 && gd > monthDays[gm]) {
    gd -= monthDays[gm];
    gm += 1;
  }

  return { gy, gm, gd };
}

export function toJalaliFromGregorian(gy: number, gm: number, gd: number): JalaliDateParts {
  const gregorianYear = gy - 1600;
  const gregorianMonth = gm - 1;
  const gregorianDay = gd - 1;
  const gregorianMonthDays = [31, isGregorianLeap(gy) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const jalaliMonthDays = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];

  let dayNumber = (365 * gregorianYear)
    + div(gregorianYear + 3, 4)
    - div(gregorianYear + 99, 100)
    + div(gregorianYear + 399, 400);

  for (let index = 0; index < gregorianMonth; index += 1) {
    dayNumber += gregorianMonthDays[index];
  }

  dayNumber += gregorianDay;

  let jalaliDayNumber = dayNumber - 79;
  const jalaliCycles = div(jalaliDayNumber, 12053);
  jalaliDayNumber = mod(jalaliDayNumber, 12053);

  let jy = 979 + (33 * jalaliCycles) + (4 * div(jalaliDayNumber, 1461));
  jalaliDayNumber = mod(jalaliDayNumber, 1461);

  if (jalaliDayNumber >= 366) {
    jy += div(jalaliDayNumber - 1, 365);
    jalaliDayNumber = mod(jalaliDayNumber - 1, 365);
  }

  let jm = 0;
  while (jm < 11 && jalaliDayNumber >= jalaliMonthDays[jm]) {
    jalaliDayNumber -= jalaliMonthDays[jm];
    jm += 1;
  }

  return { jy, jm: jm + 1, jd: jalaliDayNumber + 1 };
}
