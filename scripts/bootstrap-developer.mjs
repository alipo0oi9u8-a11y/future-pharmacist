import { createClient } from "@supabase/supabase-js";

const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "DEVELOPER_EMAIL", "NEXT_PUBLIC_SITE_URL"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exitCode = 1;
} else {
  const email = process.env.DEVELOPER_EMAIL.trim().toLowerCase();
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: existingDeveloper, error: lookupError } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "developer")
    .maybeSingle();

  if (lookupError) {
    console.error("Could not verify the developer bootstrap state.", lookupError.message);
    process.exitCode = 1;
  } else if (existingDeveloper) {
    console.error("A developer is already configured; refusing to bootstrap another owner.");
    process.exitCode = 1;
  } else {
    const redirectTo = new URL("/auth/callback?next=%2Fapp", process.env.NEXT_PUBLIC_SITE_URL).toString();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { full_name: "Future Pharmacists Developer" },
    });
    if (error || !data.user) {
      console.error("Could not send the initial developer invitation.", error?.message ?? "No user was returned.");
      process.exitCode = 1;
    } else {
      const { error: bootstrapError } = await admin.rpc("bootstrap_developer", {
        p_user_id: data.user.id,
        p_email: email,
      });
      if (bootstrapError) {
        const { error: cleanupError } = await admin.auth.admin.deleteUser(data.user.id);
        console.error("Developer bootstrap failed; account cleanup was attempted.", {
          bootstrapError: bootstrapError.message,
          cleanupError: cleanupError?.message ?? null,
        });
        process.exitCode = 1;
      } else {
        console.info(`Developer invitation sent to ${email}. Complete the invitation to sign in.`);
      }
    }
  }
}
