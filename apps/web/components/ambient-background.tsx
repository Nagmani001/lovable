"use client";

export function AmbientBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div
        className="absolute inset-0 dark:opacity-80 opacity-40"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 50% 55%, #fc385190 0%, transparent 60%),
            radial-gradient(ellipse 60% 50% at 30% 40%, #406fd080 0%, transparent 55%),
            radial-gradient(ellipse 60% 50% at 70% 45%, #d895f560 0%, transparent 55%),
            radial-gradient(ellipse 90% 40% at 50% 70%, #fa94ea70 0%, transparent 50%)
          `,
        }}
      />
    </div>
  );
}
