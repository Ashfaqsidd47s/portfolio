import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Pointer capture that never throws. Synthetic pointers (the autopilot's)
 * aren't "active" to the browser, and capturing one raises NotFoundError.
 */
export function capturePointer(el: Element, pointerId: number) {
  try {
    el.setPointerCapture(pointerId)
  } catch {
    /* nothing to capture: window listeners still see the events */
  }
}
