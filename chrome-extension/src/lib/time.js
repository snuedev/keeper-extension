const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

const shortDate = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
});

const dateWithYear = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

export function relativeTime(millis, now = Date.now()) {
  if (millis == null || !Number.isFinite(millis)) return 'Just now';

  const elapsed = now - millis;

  // Also catches a negative elapsed time from a clock that runs ahead.
  if (elapsed < MINUTE) return 'Just now';

  // Intl.RelativeTimeFormat expects a negative value for the past.
  if (elapsed < HOUR) {
    return relative.format(-Math.floor(elapsed / MINUTE), 'minute');
  }

  if (elapsed < DAY) {
    return relative.format(-Math.floor(elapsed / HOUR), 'hour');
  }

  if (elapsed < WEEK) {
    return relative.format(-Math.floor(elapsed / DAY), 'day');
  }

  const then = new Date(millis);

  return then.getFullYear() === new Date(now).getFullYear()
    ? shortDate.format(then)
    : dateWithYear.format(then);
}
