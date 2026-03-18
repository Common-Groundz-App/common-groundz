import React from 'react';
import { useSyncExternalStore } from 'react';

// Shared module-level tick — one interval drives all instances
let tick = 0;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  setInterval(() => {
    tick++;
    listeners.forEach((l) => l());
  }, 60_000);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return tick;
}

function getServerSnapshot() {
  return 0;
}

function formatRelative(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface LastUpdatedIndicatorProps {
  date: Date;
}

export const LastUpdatedIndicator: React.FC<LastUpdatedIndicatorProps> = ({ date }) => {
  // Subscribe to the shared tick so all instances re-render together
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <span className="text-xs text-muted-foreground whitespace-nowrap">
      Updated {formatRelative(date)}
    </span>
  );
};
