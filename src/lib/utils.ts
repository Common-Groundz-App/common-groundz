import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCount(count: number | null | undefined, singular: string, plural?: string): string {
  const n = Number(count ?? 0);
  const safeN = Number.isNaN(n) ? 0 : n;
  const p = plural || `${singular}s`;
  return safeN === 1 ? `1 ${singular}` : `${safeN} ${p}`;
}
