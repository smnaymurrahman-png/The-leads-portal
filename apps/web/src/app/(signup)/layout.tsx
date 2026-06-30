import type { ReactNode } from 'react';

export default function SignupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [background-image:radial-gradient(circle_at_top,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_55%),radial-gradient(circle_at_bottom_right,color-mix(in_oklch,var(--chart-2)_12%,transparent),transparent_60%)]"
      />
      {children}
    </div>
  );
}
