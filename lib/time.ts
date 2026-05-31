import type { EventItem } from "@/lib/types";

const DAY = 24 * 60 * 60 * 1000;
const STALE_EVENT_GRACE = 2 * 60 * 60 * 1000;

export function eventEndTime(event: EventItem) {
  const start = new Date(event.startDateTime).getTime();
  const end = event.endDateTime ? new Date(event.endDateTime).getTime() : start + 4 * 60 * 60 * 1000;
  return Number.isFinite(end) ? end : start;
}

export function isUpcoming(event: EventItem, now = new Date()) {
  const start = new Date(event.startDateTime).getTime();
  if (!Number.isFinite(start)) return eventEndTime(event) >= now.getTime();
  return start >= now.getTime() - STALE_EVENT_GRACE;
}

export function isTonight(event: EventItem, now = new Date()) {
  const start = new Date(event.startDateTime);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + DAY);
  return start >= today && start < tomorrow && start.getHours() >= 15;
}

export function isToday(event: EventItem, now = new Date()) {
  return isWithinDays(event, 0, 1, now);
}

export function isTomorrow(event: EventItem, now = new Date()) {
  return isWithinDays(event, 1, 2, now);
}

export function isThisWeekend(event: EventItem, now = new Date()) {
  const start = new Date(event.startDateTime);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const daysUntilSaturday = (6 - today.getDay() + 7) % 7;
  const saturday = new Date(today.getTime() + daysUntilSaturday * DAY);
  const monday = new Date(saturday.getTime() + 2 * DAY);
  return start >= saturday && start < monday;
}

export function isNextWeek(event: EventItem, now = new Date()) {
  return isWithinDays(event, 7, 14, now);
}

export function isWithinDateRange(event: EventItem, startDate?: string, endDate?: string) {
  const eventDate = eventDateKey(event);
  if (!eventDate) return false;
  if (!startDate && !endDate) return true;
  if (startDate && eventDate < startDate) return false;
  if (endDate && eventDate > endDate) return false;
  return true;
}

export function isoDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function formatEventTime(event: EventItem) {
  const start = new Date(event.startDateTime);
  if (!Number.isFinite(start.getTime())) return event.timeText || "Soon";
  return start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });
}

export function dayLabel(event: EventItem) {
  const start = new Date(event.startDateTime);
  return start.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export function sortSoonest(a: EventItem, b: EventItem) {
  return new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime();
}

function isWithinDays(event: EventItem, startOffset: number, endOffset: number, now = new Date()) {
  const start = new Date(event.startDateTime);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const lower = new Date(today.getTime() + startOffset * DAY);
  const upper = new Date(today.getTime() + endOffset * DAY);
  return start >= lower && start < upper;
}

function eventDateKey(event: EventItem) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(event.date)) return event.date;
  const start = new Date(event.startDateTime);
  if (!Number.isFinite(start.getTime())) return "";
  const year = start.getFullYear();
  const month = String(start.getMonth() + 1).padStart(2, "0");
  const day = String(start.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
