-- Demo data for local development. `npx supabase db reset` loads it after the migrations, and so
-- does `npx supabase start` on a new database. It never reaches the hosted database.
--
-- Accounts, all with the password lifeboard-demo (bcrypt, cost 12):
--   demo@lifeboard.test (Demo), sam@lifeboard.test (Sam), jo@lifeboard.test (Jo)
--
-- Uneven splits give the leftover cents to the payer (AGENTS.md Section 6.2).

do $seed$
declare
  password_hash constant text := '$2b$12$Kh07LBmIMmG40h22DJL6VuUhWNgY71HvnAyIypsI2mvdDwQPPYFrG';
  demo uuid;
  sam uuid;
  jo uuid;
  flat uuid;
  toilet_paper uuid;
begin
  -- Each gets a personal space too.
  demo := public.register_user('demo@lifeboard.test', password_hash, 'Demo');
  sam := public.register_user('sam@lifeboard.test', password_hash, 'Sam');
  jo := public.register_user('jo@lifeboard.test', password_hash, 'Jo');

  insert into public.groups (name, created_by)
  values ('Flat', demo)
  returning id into flat;

  insert into public.group_members (group_id, user_id, default_share_weight)
  values (flat, demo, 1), (flat, sam, 1), (flat, jo, 1);

  -- $60.00, split evenly.
  perform public.create_expense(flat, 'Electricity', 6000, demo, date '2026-10-05', jsonb_build_array(
    jsonb_build_object('user_id', demo, 'share_cents', 2000),
    jsonb_build_object('user_id', sam, 'share_cents', 2000),
    jsonb_build_object('user_id', jo, 'share_cents', 2000)
  ));

  -- $45.10 doesn't divide by three: Sam paid, so Sam's share has the extra cent.
  perform public.create_expense(flat, 'Groceries', 4510, sam, date '2026-10-12', jsonb_build_array(
    jsonb_build_object('user_id', demo, 'share_cents', 1503),
    jsonb_build_object('user_id', sam, 'share_cents', 1504),
    jsonb_build_object('user_id', jo, 'share_cents', 1503)
  ));

  -- $30.00, split evenly.
  perform public.create_expense(flat, 'Internet', 3000, jo, date '2026-10-15', jsonb_build_array(
    jsonb_build_object('user_id', demo, 'share_cents', 1000),
    jsonb_build_object('user_id', sam, 'share_cents', 1000),
    jsonb_build_object('user_id', jo, 'share_cents', 1000)
  ));

  -- A list item Sam checked off for $8.99 (two leftover cents to Sam), and one still to buy.
  toilet_paper := public.create_expense(flat, 'Toilet paper', 899, sam, date '2026-10-12', jsonb_build_array(
    jsonb_build_object('user_id', demo, 'share_cents', 299),
    jsonb_build_object('user_id', sam, 'share_cents', 301),
    jsonb_build_object('user_id', jo, 'share_cents', 299)
  ));

  insert into public.list_items
    (group_id, title, quantity, added_by, status, completed_by, completed_at, expense_id)
  values
    (flat, 'Toilet paper', 1, demo, 'done', sam, timestamptz '2026-10-12 18:00:00+00', toilet_paper);

  insert into public.list_items (group_id, title, quantity, estimated_cents, added_by)
  values (flat, 'Dish soap', 1, 399, jo);

  -- Jo paid Demo $10.00 back directly, and Demo confirmed it.
  insert into public.payments
    (group_id, from_user_id, to_user_id, amount_cents, status, paid_at, confirmed_at)
  values
    (flat, jo, demo, 1000, 'confirmed', timestamptz '2026-10-18 10:00:00+00', timestamptz '2026-10-18 12:00:00+00');
end;
$seed$;
