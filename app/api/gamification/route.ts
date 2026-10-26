import { NextResponse } from "next/server";
import { errorResponse, getActiveProfile } from "@/lib/http";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function GET() {
  if (!isSupabaseConfigured()) return errorResponse("Supabase is not configured.", 503);
  const session = await getActiveProfile();
  if (!session) return errorResponse("Authentication required.", 401);

  const [progress, awards] = await Promise.all([
    session.client.from("user_progress")
      .select("xp,current_streak,longest_streak,last_studied_on")
      .eq("user_id", session.profile.id)
      .maybeSingle(),
    session.client.from("user_badges")
      .select("awarded_at,badges(name,description,slug)")
      .eq("user_id", session.profile.id)
      .order("awarded_at", { ascending: false }),
  ]);
  const error = progress.error ?? awards.error;
  if (error) {
    console.error("Could not load account gamification data.", error);
    return errorResponse("Study progress is temporarily unavailable.", 502);
  }

  const xp = progress.data?.xp ?? 0;
  const badges = (awards.data ?? []).flatMap((award) => {
    const badge = Array.isArray(award.badges) ? award.badges[0] : award.badges;
    return badge ? [{
      slug: badge.slug,
      name: badge.name,
      description: badge.description,
      awardedAt: award.awarded_at,
    }] : [];
  });
  return NextResponse.json({
    xp,
    level: Math.floor(xp / 100) + 1,
    xpIntoLevel: xp % 100,
    xpForNextLevel: 100,
    currentStreak: progress.data?.current_streak ?? 0,
    longestStreak: progress.data?.longest_streak ?? 0,
    lastStudiedOn: progress.data?.last_studied_on ?? null,
    badges,
  });
}
