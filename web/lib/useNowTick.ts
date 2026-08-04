"use client";

import { useEffect, useState } from "react";

// A shared ticking clock for any component that needs to recompute a
// deadline-relative value (a countdown, a closed/open flag) every second
// without a manual page refresh. One interval per consuming component,
// starting from the real Date.now() -- never a fixed/estimated value.
export function useNowTick(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
