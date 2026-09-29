import type { FieldErrors } from '@/lib/validation';

/**
 * Inline message under an input.
 *
 * Paired with the toast, not a replacement for it. A toast is transient and easy
 * to miss while focused on a long form, so field level problems are also
 * rendered next to the field they belong to.
 */
export function FieldError({
  errors,
  name,
  id,
}: {
  errors: FieldErrors | null;
  name: string;
  id?: string;
}) {
  const message = errors?.[name];
  if (!message) return null;

  return (
    <p
      id={id ?? `${name}-error`}
      role="alert"
      className="text-xs text-red-600 dark:text-red-400"
    >
      {message}
    </p>
  );
}

/**
 * Label + control + inline error.
 *
 * `name` is the logical field name and is the key the server action reports
 * errors under. `htmlFor` is the DOM id of the control. They are the same for a
 * plain create form but must differ inside an inline editor, where several rows
 * render the same field at once and therefore cannot share an id, while the
 * server still reports one shared error key for all of them.
 */
export function Field({
  label,
  name,
  htmlFor,
  errors,
  className,
  children,
}: {
  label: string;
  name: string;
  htmlFor?: string;
  errors: FieldErrors | null;
  className?: string;
  children: React.ReactNode;
}) {
  const controlId = htmlFor ?? name;

  return (
    <div className={className}>
      <label htmlFor={controlId} className="field-label mb-1.5 block">
        {label}
      </label>
      {children}
      <div className="mt-1">
        <FieldError errors={errors} name={name} id={`${controlId}-error`} />
      </div>
    </div>
  );
}
