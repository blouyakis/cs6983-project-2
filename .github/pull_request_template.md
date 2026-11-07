## Summary

<!-- Briefly describe what this PR does -->

Closes #

## How it was tested

<!-- Describe how you tested this feature -->
- [ ] Unit tests pass: `npm test`
- [ ] Type check passes: `npm run typecheck`
- [ ] Linting passes: `npm run lint`
- [ ] E2E tests pass (if applicable): `npm run test:e2e`

## Migration checklist

⚠️ **If this PR adds a SQL migration** (`supabase/migrations/`):
- [ ] Partner has run the migration against the hosted Supabase project (see [`docs/architecture.md`](../docs/architecture.md) Section 7)
- [ ] The migration is working on a preview URL (tested register → create group → add expense)
- [ ] `.github/workflows/ci.yml` includes a `db-test` job that runs the migration

## Notes for reviewers

<!-- Any additional context for the reviewer -->
