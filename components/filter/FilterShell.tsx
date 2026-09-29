'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FilterX, Loader2, Search } from 'lucide-react';

/**
 * Filter state lives in the URL, not in the browser.
 *
 * Search is submitted explicitly (button or Enter) so a half typed term does not
 * fire a request per keystroke, while dropdowns and dates apply the moment they
 * change because choosing from a list is deliberate. Both paths end in the same
 * router.push, so a filtered view is always a shareable link and the browser
 * back button walks through previous filter states.
 *
 * Local state is seeded from the URL and re-synced whenever the URL changes, so
 * the controls stay correct after a back navigation.
 */

type FilterContextValue = {
  values: Record<string, string>;
  /** Sets a value and applies immediately. For selects and dates. */
  setValue: (field: string, value: string) => void;
  /** Sets one end of a range without applying, so a half finished range is not queried. */
  setRange: (field: 'from' | 'to', value: string) => void;
  /** Applies the current local state. For text inputs, on Enter or blur. */
  commit: (next: Record<string, string>) => void;
};

const FilterContext = createContext<FilterContextValue | null>(null);

/** Page specific filter fields read and write the shared form through this. */
export function useFilter() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilter must be used inside a <FilterShell>');
  }
  return context;
}

export default function FilterShell({
  fields,
  activeCount,
  searchPlaceholder = 'ค้นหา...',
  resultSummary,
  children,
}: {
  /** Query param names this form owns. Other params in the URL are preserved. */
  fields: readonly string[];
  activeCount: number;
  searchPlaceholder?: string;
  resultSummary?: ReactNode;
  children?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [values, setValues] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  // `fields` is a literal array on every render at the call site, so memoise it
  // into a stable key to keep this effect from looping.
  const fieldsKey = fields.join(',');

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const field of fieldsKey.split(',')) {
      if (field) next[field] = searchParams.get(field) ?? '';
    }
    setValues(next);
    setPending(false);
  }, [searchParams, fieldsKey]);

  const push = useMemo(
    () =>
      (next: Record<string, string>) => {
        const params = new URLSearchParams(searchParams.toString());

        for (const field of fieldsKey.split(',')) {
          if (!field) continue;
          const value = next[field]?.trim();
          if (value) params.set(field, value);
          else params.delete(field);
        }

        // A new filter must start from the first page; staying on a later page
        // of the old result set would show an empty table.
        params.delete('page');

        // Date filters mean a calendar day where the operator is sitting, so the
        // server needs their offset to bound the range correctly. Sent on every
        // apply, which also repairs a link that was shared without it.
        params.set('tz', String(-new Date().getTimezoneOffset()));

        const query = params.toString();
        setPending(true);
        router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
      },
    [fieldsKey, pathname, router, searchParams],
  );

  const context = useMemo<FilterContextValue>(
    () => ({
      values,
      setValue: (field, value) => {
        setValues((prev) => {
          const next = { ...prev, [field]: value };
          push(next);
          return next;
        });
      },
      setRange: (field, value) => {
        setValues((prev) => {
          const next = { ...prev, [field]: value };
          // Ignore an end date that precedes the start, otherwise the query
          // returns nothing and the table looks broken with no explanation.
          if (next.from && next.to && next.from > next.to) return prev;
          push(next);
          return next;
        });
      },
      commit: push,
    }),
    [values, push],
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    push(values);
  }

  return (
    <FilterContext.Provider value={context}>
      <form onSubmit={handleSubmit} className="card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label htmlFor="filter-search" className="field-label mb-1.5 block">
              ค้นหา
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle dark:text-slate-500"
                aria-hidden="true"
              />
              <input
                id="filter-search"
                name="search"
                type="search"
                value={values.search ?? ''}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, search: event.target.value }))
                }
                placeholder={searchPlaceholder}
                className="field pl-9"
              />
            </div>
          </div>

          {children}

          <div className="flex items-center gap-2">
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Search className="h-4 w-4" aria-hidden="true" />
              )}
              ค้นหา
            </button>

            {activeCount > 0 ? (
              <button
                type="button"
                onClick={() => router.push(pathname, { scroll: false })}
                className="btn"
              >
                <FilterX className="h-4 w-4" aria-hidden="true" />
                ล้าง ({activeCount})
              </button>
            ) : null}
          </div>
        </div>

        {resultSummary ? (
          <p className="mt-3 border-t border-line pt-3 text-xs text-ink-subtle dark:border-slate-500 dark:border-slate-800">
            {resultSummary}
          </p>
        ) : null}
      </form>
    </FilterContext.Provider>
  );
}
