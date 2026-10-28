# Architecture

<!-- TODO(#3): replace this draft with the final schema and add the schema diagram. Behavioral rules live in AGENTS.md Section 6. -->

Draft schema, moved out of `AGENTS.md` so the rules file stays short.

- `users`: id, email (unique, stored lowercase), password_hash, name, created_at
- `groups`: id, name, is_personal, archived_at, created_by, created_at
- `group_members`: group_id, user_id, default_share_weight, joined_at, left_at
- `list_items`: id, group_id, title, quantity, note, estimated_cents, status (`open` | `done`), added_by, completed_by, completed_at, expense_id
- `expenses`: id, group_id, description, amount_cents, payer_id, spent_on, settlement_id (null until settled), created_at, edited_at
- `expense_shares`: expense_id, user_id, share_cents
- `payments`: id, group_id, from_user_id, to_user_id, amount_cents, status (`pending` | `confirmed`), settlement_id, created_at, confirmed_at
- `settlements`: id, group_id, status (`open` | `closed`), started_by, started_at, closed_at
