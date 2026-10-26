import { Suspense } from "react";
import { redirect } from "next/navigation";
import FuturePharmacistsApp from "../future-pharmacists-app";
import { getActiveProfile } from "@/lib/http";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function WorkspacePage() {
  return (
    <Suspense fallback={<main>Loading workspace...</main>}>
      <AuthenticatedWorkspace />
    </Suspense>
  );
}
async function AuthenticatedWorkspace() {
  if (!isSupabaseConfigured()) redirect("/");
  const session = await getActiveProfile();
  if (!session) redirect("/");

  return (
    <FuturePharmacistsApp
      authenticatedUser={{
        id: session.profile.id,
        name: session.profile.full_name || session.profile.email,
        email: session.profile.email,
        role: session.profile.role,
        canSubmitNotes: session.profile.role === "developer" || await canSubmitNotes(session.client, session.profile.id),
      }}
    />
  );
}

async function canSubmitNotes(client: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>, userId: string) {
  const { data, error } = await client
    .from("contribution_permissions")
    .select("user_id")
    .eq("user_id", userId)
    .eq("content_type", "note")
    .maybeSingle();
  if (error) throw new Error("Could not load contribution permissions.");
  return Boolean(data);
}
