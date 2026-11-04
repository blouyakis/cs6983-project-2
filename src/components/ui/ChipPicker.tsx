type ChipPickerProps = {
  // The visible title of the group of chips.
  label: string;
  name: string;
  options: readonly { value: string; label: string }[];
  selected: readonly string[];
  onChange: (selected: string[]) => void;
  // Choose several chips with checkboxes, instead of one with radios.
  multiple?: boolean;
  // Chips that are always selected and can't be cleared, such as the payer in
  // "Shared by" (AGENTS.md Section 6.2). Only meaningful with `multiple`.
  locked?: readonly string[];
};

// A row of chips for picking a group, or for picking who shares a cost
// (DESIGN.md "ChipPicker"). A selected chip is filled with `ink`, and in a
// multi-select it also shows a check mark. The chips are real radios or
// checkboxes, so the keyboard and screen readers work without extra code.
export function ChipPicker({
  label,
  name,
  options,
  selected,
  onChange,
  multiple = false,
  locked = [],
}: ChipPickerProps) {
  const chosen = new Set([...selected, ...locked]);

  function toggle(value: string) {
    if (!multiple) {
      onChange([value]);
      return;
    }
    const next = new Set(chosen);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    // Keep the order of the options, so the result doesn't depend on the order
    // the user clicked in.
    onChange(
      options.map((option) => option.value).filter((id) => next.has(id)),
    );
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1 font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = chosen.has(option.value);
          const isLocked = locked.includes(option.value);
          return (
            <label key={option.value} className="cursor-pointer">
              <input
                type={multiple ? "checkbox" : "radio"}
                name={name}
                value={option.value}
                checked={isSelected}
                disabled={isLocked}
                onChange={() => toggle(option.value)}
                className="peer sr-only"
              />
              <span
                className={`block rounded-full border-2 border-ink px-3 py-1 font-semibold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-action peer-disabled:cursor-default ${
                  isSelected ? "bg-ink text-surface" : "bg-surface text-ink"
                }`}
              >
                {multiple && isSelected ? (
                  <span aria-hidden="true">✓ </span>
                ) : null}
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
