// Turning a timestamp into the phrase a person would actually say: "2 hours
// ago" rather than "19/08/2026, 14:03". On a list of your own notes the useful
// question is almost always "how long ago", not "on what date".

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

// Intl.RelativeTimeFormat is built into the browser and knows how to say this
// in whatever language Chrome is set to — no date library needed. Passing
// `undefined` as the locale means "use the browser's". numeric: 'auto' is what
// turns -1 day into "yesterday" instead of "1 day ago".
const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

// Past the point where "3 weeks ago" stops being helpful, fall back to a date.
const shortDate = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
});

const dateWithYear = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

// `millis` may be null: a note saved a moment ago has no server timestamp yet,
// because Firestore fills that in when the write arrives. "Just now" is both
// true and what the next snapshot will say anyway.
//
// `now` is a parameter rather than a straight Date.now() call so the behaviour
// can be checked at a chosen moment instead of at whatever time it happens to
// be.
export function relativeTime(millis, now = Date.now()) {
  if (millis == null || !Number.isFinite(millis)) return 'Just now';

  const elapsed = now - millis;

  // A note written on a machine whose clock runs ahead would land here. "Just
  // now" beats "in 4 minutes" on something you know you already wrote.
  if (elapsed < MINUTE) return 'Just now';

  // RelativeTimeFormat wants a negative number for the past, and a whole unit:
  // -2 with 'hour' is "2 hours ago". Math.round would call 89 minutes "2 hours
  // ago" before it has been two, so this floors instead.
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

  // Within this year the year adds nothing; across years, leaving it off is
  // actively misleading.
  return then.getFullYear() === new Date(now).getFullYear()
    ? shortDate.format(then)
    : dateWithYear.format(then);
}
