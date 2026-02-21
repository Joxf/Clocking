const SHIFT_TEMPLATES = {
  early: { label: "Early", start: "08:00", end: "14:00", hours: 6, color: "#FBBF24" },
  late: { label: "Late", start: "14:00", end: "20:00", hours: 6, color: "#60A5FA" },
  night: { label: "Night", start: "20:00", end: "08:00", hours: 12, color: "#A78BFA" },
  long_day: { label: "Long Day", start: "08:00", end: "20:00", hours: 12, color: "#34D399" }
};

const COVERAGE_BASELINE = {
  nurse: 2,
  carer: 6
};

const MIN_REST_HOURS = 11;
const MAX_CONSECUTIVE_DAYS = 2;
const MIN_WEEKLY_HOURS = 36.0;

const JWT_EXPIRATION_HOURS = 8;

module.exports = {
  SHIFT_TEMPLATES,
  COVERAGE_BASELINE,
  MIN_REST_HOURS,
  MAX_CONSECUTIVE_DAYS,
  MIN_WEEKLY_HOURS,
  JWT_EXPIRATION_HOURS
};
