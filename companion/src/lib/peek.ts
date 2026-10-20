// The peek stack: following a reference opens it in the side panel, on top of
// whatever was there, so the reader never loses their place in Euclid.
import { useSyncExternalStore } from "react";

let stack: string[] = [];
let enabled = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const peek = {
  open(id: string) {
    if (stack[stack.length - 1] === id) return;
    stack = [...stack, id];
    emit();
  },
  back() {
    stack = stack.slice(0, -1);
    emit();
  },
  clear() {
    if (!stack.length) return;
    stack = [];
    emit();
  },
  /** Reading pages (which have a panel) turn peeking on; other pages navigate. */
  setEnabled(v: boolean) {
    enabled = v;
  },
  get enabled() {
    return enabled;
  },
};

export function usePeek(): string[] {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => stack,
  );
}
