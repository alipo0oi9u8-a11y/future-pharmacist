import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminKey, getSupabasePublicConfig, isSupabaseConfigured } from "./config";

export function createSupabaseAdminClient() {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
  const { url } = getSupabasePublicConfig();
  return createClient(url, getSupabaseAdminKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
