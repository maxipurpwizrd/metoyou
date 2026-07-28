export function normalizeTimestamp(value: string | number | Date | null | undefined): string | null {
  if (value == null || value === "") return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const input = String(value).trim();
  if (!input) return null;

  let normalized = input;

  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/.test(normalized)) {
    normalized = `${normalized.replace(" ", "T")}Z`;
  }

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function parseDisplayTimestamp(value: string | number | Date | null | undefined): Date | null {
  const normalized = normalizeTimestamp(value);
  if (!normalized) return null;

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDisplayDateTime(value: string | number | Date | null | undefined, options?: Intl.DateTimeFormatOptions) {
  const date = parseDisplayTimestamp(value);
  if (!date) return "";

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  }).format(date);
}

export function formatDisplayTime(value: string | number | Date | null | undefined) {
  const date = parseDisplayTimestamp(value);
  if (!date) return "";

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatDisplayDate(value: string | number | Date | null | undefined) {
  const date = parseDisplayTimestamp(value);
  if (!date) return "";

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function getRelativeTime(value: string | number | Date | null | undefined) {
  const date = parseDisplayTimestamp(value);
  if (!date) return "just now";

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDisplayDate(date);
}
