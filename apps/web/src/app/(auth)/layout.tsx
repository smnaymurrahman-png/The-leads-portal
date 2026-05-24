import type { ReactNode } from 'react';

/** Layout shared by the unauthenticated auth screens (login, etc.). */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* Soft violet glow behind the card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [background-image:radial-gradient(circle_at_top,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_55%),radial-gradient(circle_at_bottom_right,color-mix(in_oklch,var(--chart-2)_12%,transparent),transparent_60%)]"
      />
      {children}
    </div>
  );
}
