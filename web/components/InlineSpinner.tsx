"use client";

// Shared in-flight indicator for write-triggering buttons (Release Balance,
// Appeal Verdict, Resolve Appeal, Retry automatic fulfillment, purchase,
// create listing, register provider, etc.) -- reuses the exact same
// material-symbols "autorenew" + animate-spin treatment PipelineProgress's
// active-stage row and LoadingState already use elsewhere in this app,
// rather than each button inventing its own in-progress look or falling
// back to a plain disabled/greyed static state with no visible motion.
export function InlineSpinner({ className = "" }: { className?: string }) {
  return (
    <span className={`material-symbols-outlined text-base animate-spin ${className}`} aria-hidden="true">
      autorenew
    </span>
  );
}
