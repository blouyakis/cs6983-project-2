type ToggleProps<Value extends string> = {
  // Names the group for screen readers. The visible title is up to the parent.
  label: string;
  name: string;
  options: readonly { value: Value; label: string }[];
  value: Value;
  onChange: (value: Value) => void;
};

// A two-option switch, such as Evenly / Custom amounts (DESIGN.md "Toggle").
// It is a radio group, so the arrow keys move between the options and a
// screen reader says which one is selected. The selected option is filled with
// `ink`. It never shrinks: overflow-hidden lets a flex item shrink to nothing,
// and in FormSheet's scrolling body that squashed it to its two borders.
export function Toggle<Value extends string>({
  label,
  name,
  options,
  value,
  onChange,
}: ToggleProps<Value>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex shrink-0 self-start overflow-hidden rounded-lg border-2 border-ink"
    >
      {options.map((option) => (
        <label key={option.value} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
            className="peer sr-only"
          />
          <span
            className={`block px-3 py-2 font-semibold peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-4 peer-focus-visible:outline-action ${
              option.value === value
                ? "bg-ink text-surface"
                : "bg-surface text-ink"
            }`}
          >
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}
