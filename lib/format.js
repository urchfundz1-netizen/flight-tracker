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

const EVENT_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

/** Formats a TIMESTAMPTZ value (ISO string) for the history log. */
export function formatDateTime(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return EVENT_FMT.format(date);
}

export function minutesToShiftLabel(minutes) {
  if (minutes > 0) return `+${minutes} min`;
  return `${minutes} min`;
}

/**
 * The passenger letter shown when a flight is in the emergency-landing state.
 * The flight name leads the body; the airport is the admin-entered emergency
 * airport when set, otherwise the flight's destination. Returns a structured
 * object so the ticket and live view can lay it out properly.
 */
export function emergencyNotice(flight) {
  const name = flight.flight_number || flight.code;
  const airport =
    flight.emergency_airport || flight.destination_city || flight.destination;
  const airline = (flight.airline || "").trim();

  return {
    heading: "Notice",
    paragraphs: [
      `Flight ${name} made an emergency landing at ${airport} following a fire warning in the cargo hold. All 142 passengers and crew were evacuated as a precaution, with two people reportedly sustaining minor injuries.`,
      "We sincerely apologize for the inconvenience and disruption caused by this unexpected incident.",
      "Please be assured that **arrangements are being made for passengers to board another aircraft to continue their journey.** Further information regarding boarding arrangements and the revised departure time will be communicated as soon as it is confirmed.",
      "Passenger safety remains our top priority. We appreciate your patience, understanding, and cooperation during this time.",
      `Thank you for choosing ${airline || "our airline"}. We sincerely regret the inconvenience and look forward to helping you continue your journey safely.`,
    ],
    signature: airline ? `${airline} Customer Service Team` : "Airline Customer Service Team",
  };
}

/**
 * Splits text on `**bold**` markers into ordered segments so renderers can emit
 * <strong> for the emphasised parts without ever using dangerouslySetInnerHTML.
 */
export function splitEmphasis(text) {
  return String(text)
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((chunk) =>
      chunk.startsWith("**") && chunk.endsWith("**")
        ? { text: chunk.slice(2, -2), bold: true }
        : { text: chunk, bold: false },
    );
}
