import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';

const fieldClass =
  'mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-sm ' +
  'text-slate-100 outline-none focus:border-blue-500';

export function Input({ label, ...rest }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-xs text-slate-400">{label}</span>
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
      <span className="text-xs text-slate-400">{label}</span>
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
      className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
            {headers.map((h) => (
              <th key={h} className="px-2 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            // eslint-disable-next-line react/no-array-index-key
            <tr key={rowIndex} className="border-b border-slate-800/60">
              {row.map((cell, cellIndex) => (
                // eslint-disable-next-line react/no-array-index-key
                <td key={cellIndex} className="px-2 py-2 align-top text-slate-300">
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
