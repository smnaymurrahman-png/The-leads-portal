import Link from 'next/link';
import type { ReactNode } from 'react';
import { LogoutButton } from './LogoutButton';

export interface NavLink {
  href: string;
  label: string;
}

/**
 * Header + navigation chrome shared by every page inside a role area.
 * Used by each role group's layout.
 */
export function AreaShell({
  area,
  links,
  children,
}: {
  area: string;
  links: NavLink[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-900/60">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
          <span className="text-sm font-semibold text-slate-100">{area}</span>
          <nav className="flex flex-1 flex-wrap gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded px-2.5 py-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <LogoutButton />
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
    </div>
  );
}
