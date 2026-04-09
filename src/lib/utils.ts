import { createId } from "@paralleldrive/cuid2";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return createId();
}

// SQLite's datetime('now') stores UTC without a timezone indicator
// e.g. "2024-01-15 10:30:00" — JavaScript treats this as LOCAL time unless we normalize it
function toIso(dateString: string): string {
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(dateString)
    ? dateString.replace(" ", "T") + "Z"
    : dateString;
}

export function formatDate(dateString: string): string {
  return new Date(toIso(dateString)).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(dateString: string): string {
  return new Date(toIso(dateString)).toLocaleString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
