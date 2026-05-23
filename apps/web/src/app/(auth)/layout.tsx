import type { ReactNode } from 'react';

/** Layout shared by the unauthenticated auth screens (login, etc.). */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center">{children}</div>;
}
