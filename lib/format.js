const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const SHORT_DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

/** Formats minutes as "2h 35m", or just "45m" under an hour. */
export function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatDate(date) {
  if (!date) return "—";
  return DATE_FMT.format(new Date(`${date}T00:00:00Z`));
}

export function formatShortDate(date) {
  if (!date) return "—";
  return SHORT_DATE_FMT.format(new Date(`${date}T00:00:00Z`));
}

export function formatTime(time) {
  if (!time) return "—";
  return time;
}

export function minutesToShiftLabel(minutes) {
  if (minutes > 0) return `+${minutes} min`;
  return `${minutes} min`;
}
