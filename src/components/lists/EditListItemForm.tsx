"use client";

import { useState } from "react";
import { FormSheet } from "@/components/ui/FormSheet";
import type { ListItem } from "@/lib/db/list-items";
import { centsToInputText } from "@/lib/domain/money";
import { patchJson } from "@/lib/http/api-client";
import { ListItemInputs } from "./ListItemInputs";
import { readListItemFields, type ListItemTexts } from "./list-item-fields";

type EditListItemFormProps = {
  // An open item. A done one has to be unchecked first (#12).
  item: ListItem;
  open: boolean;
  onClose: () => void;
  onSaved: (item: ListItem) => void;
  // The server refused the edit as a whole, such as a 409 because someone
  // checked the item off first, or a 404 because someone deleted it. The list
  // on the page is out of date then. Not called for a field error.
  onRefused?: () => void;
};

function textsOf(item: ListItem): ListItemTexts {
  return {
    title: item.title,
    quantityText: item.quantity === null ? "" : String(item.quantity),
    note: item.note ?? "",
    estimateText:
      item.estimatedCents === null ? "" : centsToInputText(item.estimatedCents),
  };
}

// Edits an open item (DESIGN.md "ListItemRow"). Every field is sent, so a
// cleared estimate, quantity or note is cleared on the server too. Render it
// with a key per item, so it opens filled in with the item it was opened for.
export function EditListItemForm({
  item,
  open,
  onClose,
  onSaved,
  onRefused,
}: EditListItemFormProps) {
  const [texts, setTexts] = useState(() => textsOf(item));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const read = readListItemFields(texts);
    if (!read.ok) {
      setErrors(read.errors);
      setFormError(undefined);
      return;
    }
    setSubmitting(true);
    const result = await patchJson<{ item: ListItem }>(
      `/api/groups/${item.groupId}/list-items/${item.id}`,
      read.input,
    );
    setSubmitting(false);
    if (result.ok) {
      onSaved(result.data.item);
      onClose();
      return;
    }
    setErrors(result.error.fields ?? {});
    setFormError(result.error.fields ? undefined : result.error.message);
    if (!result.error.fields) {
      onRefused?.();
    }
  }

  return (
    <FormSheet
      open={open}
      title="Edit item"
      primaryLabel="Save changes"
      onSubmit={handleSubmit}
      onClose={onClose}
      submitting={submitting}
      error={formError}
    >
      <ListItemInputs
        texts={texts}
        errors={errors}
        onChange={(changes, cleared) => {
          setTexts((current) => ({ ...current, ...changes }));
          setErrors((current) =>
            Object.fromEntries(
              Object.entries(current).filter(([field]) => field !== cleared),
            ),
          );
        }}
      />
    </FormSheet>
  );
}
