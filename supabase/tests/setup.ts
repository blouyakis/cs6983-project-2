import { inject } from "vitest";

// lib/db reads these, so database tests use the same client as the app.
process.env.SUPABASE_URL = inject("supabaseUrl");
process.env.SUPABASE_SERVICE_ROLE_KEY = inject("serviceRoleKey");
