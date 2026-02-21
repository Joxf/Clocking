const { SHIFT_TEMPLATES } = require('../config/constants');

// Get the number of days in a month
const getDaysInMonth = (year, month) => {
  return new Date(year, month, 0).getDate();
};

// Parse shift times and return start/end as Date objects
const parseShiftTimes = (shift) => {
  const [startHour, startMin] = shift.start_time.split(':').map(Number);
  const [endHour, endMin] = shift.end_time.split(':').map(Number);
  
  const start = new Date(`${shift.shift_date}T${shift.start_time}:00Z`);
  let end = new Date(`${shift.shift_date}T${shift.end_time}:00Z`);
  
  // Handle overnight shifts (end time is earlier than start time)
  if (endHour < startHour || (endHour === startHour && endMin < startMin)) {
    end.setDate(end.getDate() + 1);
  }
  
  return { start, end };
};

// Get ISO week number
const getWeekNumber = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

// Format date as YYYY-MM-DD
const formatDate = (date) => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

// Check if a date is a weekend
const isWeekend = (dateStr) => {
  const date = new Date(dateStr);
  const day = date.getDay();
  return day === 0 || day === 6;
};

module.exports = {
  getDaysInMonth,
  parseShiftTimes,
  getWeekNumber,
  formatDate,
  isWeekend
};
