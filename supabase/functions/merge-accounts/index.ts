import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { createMergeHandler } from "./merge-core.js";

const url = Deno.env.get("SUPABASE_URL") || "";
const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
if (!url || !secret) throw new Error("Merge service is not configured.");
const admin = createClient(url, secret, { auth: {
  persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
} });
const origins = new Set([
  "http://localhost:3210", "http://127.0.0.1:3210",
  ...(Deno.env.get("IRIG_ALLOWED_ORIGINS") || "").split(",").map((entry) => entry.trim()).filter(Boolean),
]);
Deno.serve(createMergeHandler({ admin, allowedOrigins: origins }));
