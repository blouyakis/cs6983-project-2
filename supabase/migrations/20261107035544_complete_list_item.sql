-- Complete a list item: mark it done and create an expense if there's a cost
CREATE OR REPLACE FUNCTION complete_list_item(
  item_id uuid,
  user_id uuid,
  group_id uuid,
  amount_cents integer,
  shares jsonb
) RETURNS uuid AS $$
DECLARE
  v_expense_id uuid;
BEGIN
  -- Verify user is a current member
  PERFORM * FROM group_members
  WHERE group_members.group_id = complete_list_item.group_id
    AND group_members.user_id = complete_list_item.user_id
    AND group_members.left_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User is not a current member of this group' USING SQLSTATE = '403';
  END IF;

  -- Verify item exists and is open
  PERFORM * FROM list_items
  WHERE id = item_id AND group_id = complete_list_item.group_id AND status = 'open';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found or already completed' USING SQLSTATE = '409';
  END IF;

  -- Create expense if there's a cost
  IF amount_cents > 0 THEN
    INSERT INTO expenses (group_id, description, amount_cents, payer_id, spent_on)
    VALUES (complete_list_item.group_id, '', amount_cents, user_id, CURRENT_DATE)
    RETURNING id INTO v_expense_id;

    -- Insert expense shares
    INSERT INTO expense_shares (expense_id, user_id, share_cents)
    SELECT v_expense_id, key::uuid, value::integer
    FROM jsonb_each_text(shares);
  END IF;

  -- Mark item as done
  UPDATE list_items
  SET status = 'done', completed_by = user_id, completed_at = now(), expense_id = v_expense_id
  WHERE id = item_id;

  RETURN v_expense_id;
END;
$$ LANGUAGE plpgsql;

-- Reopen a list item: mark it open and delete its expense
CREATE OR REPLACE FUNCTION reopen_list_item(
  item_id uuid,
  user_id uuid,
  group_id uuid
) RETURNS void AS $$
DECLARE
  v_expense_id uuid;
  v_completed_by uuid;
BEGIN
  -- Verify user is a current member
  PERFORM * FROM group_members
  WHERE group_members.group_id = reopen_list_item.group_id
    AND group_members.user_id = reopen_list_item.user_id
    AND group_members.left_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User is not a current member of this group' USING SQLSTATE = '403';
  END IF;

  -- Get item and verify it's done and user checked it off
  SELECT expense_id, completed_by INTO v_expense_id, v_completed_by
  FROM list_items
  WHERE id = item_id AND group_id = reopen_list_item.group_id AND status = 'done';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found or not completed' USING SQLSTATE = '409';
  END IF;

  IF v_completed_by != user_id THEN
    RAISE EXCEPTION 'Only the member who checked it off can uncheck it' USING SQLSTATE = '403';
  END IF;

  -- Delete expense if it exists and is unsettled
  IF v_expense_id IS NOT NULL THEN
    DELETE FROM expense_shares WHERE expense_id = v_expense_id;
    DELETE FROM expenses WHERE id = v_expense_id AND settlement_id IS NULL;
  END IF;

  -- Mark item as open
  UPDATE list_items
  SET status = 'open', completed_by = NULL, completed_at = NULL, expense_id = NULL
  WHERE id = item_id;
END;
$$ LANGUAGE plpgsql;
