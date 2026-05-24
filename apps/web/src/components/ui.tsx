import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';

/**
 * Legacy form/panel primitives used by the screens that haven't yet been
 * migrated to shadcn (Users, Clients, Campaigns, LandingPages, Pricing,
 * Orders, Replacements, LiveLeads). The signatures match what those screens
 * already pass in — only the visual tokens have moved from the old dark
 * slate to the shadcn light theme so they read correctly inside the new
 * SidebarShell. They will be replaced screen-by-screen in Chunk C.
 */

const fieldClass =
  'mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'text-foreground shadow-xs outline-none placeholder:text-muted-foreground ' +
  'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30';

export function Input({
  label,
  ...rest
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input {...rest} className={fieldClass} />
    </label>
  );
}

export function Select({
  label,
  children,
  ...rest
}: { label: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select {...rest} className={fieldClass}>
        {children}
      </select>
    </label>
  );
}

export function Button({ children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      <header className="border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            // eslint-disable-next-line react/no-array-index-key
            <tr
              key={rowIndex}
              className="border-b border-border/60 last:border-b-0 hover:bg-muted/40"
            >
              {row.map((cell, cellIndex) => (
                // eslint-disable-next-line react/no-array-index-key
                <td key={cellIndex} className="px-3 py-2.5 align-top text-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
