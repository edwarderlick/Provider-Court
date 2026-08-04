"use client";

// Every Studio read in this app previously rendered as a single line of
// plain text ("[LOADING] Reading X from GenLayer Studio...") -- easy to miss,
// and indistinguishable from a hung page during Studio's real multi-second
// (sometimes multi-attempt, see lib/rpc-retry.ts's withBusyRetry) response
// times. This is the one shared, visually prominent replacement, styled to
// match the app's existing surfaces (hardware-border card, mono fonts, the
// same animate-spin + text-primary treatment PipelineProgress's active-stage
// row already uses) rather than introducing a new loading idiom.
export function LoadingState({
  label,
  fullPage = false,
}: {
  label: string;
  fullPage?: boolean;
}) {
  const content = (
    <div className="hardware-border bg-surface-container-low px-6 py-8 flex flex-col items-center justify-center gap-3 text-center">
      <span className="material-symbols-outlined text-3xl text-primary animate-spin">
        autorenew
      </span>
      <p className="font-mono-data text-mono-data text-on-surface-variant">{label}</p>
    </div>
  );

  if (!fullPage) return content;

  return <div className="max-w-2xl mx-auto p-margin-mobile">{content}</div>;
}
