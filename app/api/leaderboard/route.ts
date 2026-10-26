import { NextResponse } from "next/server";
import { errorResponse, getActiveProfile } from "@/lib/http";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function isLeaderboardRow(value: unknown): value is { display_name: string; weekly_xp: number; rank_position: number } {
  return value !== null
    && typeof value === "object"
    && "display_name" in value && typeof value.display_name === "string"
    && "weekly_xp" in value && typeof value.weekly_xp === "number"
    && "rank_position" in value && typeof value.rank_position === "number";
}

export async function GET() {
  if (!isSupabaseConfigured()) return errorResponse("Supabase is not configured.", 503);
  const session = await getActiveProfile();
  if (!session) return errorResponse("Authentication required.", 401);

  const { data, error } = await session.client.rpc("weekly_leaderboard");
  if (error) {
    console.error("Could not load the weekly leaderboard.", error);
    return errorResponse("The weekly leaderboard is temporarily unavailable.", 502);
  }
  const rows: unknown = data ?? [];
  if (!Array.isArray(rows) || !rows.every(isLeaderboardRow)) {
    console.error("Weekly leaderboard RPC returned an invalid response shape.");
    return errorResponse("The weekly leaderboard is temporarily unavailable.", 502);
  }
  return NextResponse.json({
    entries: rows.map((entry) => ({
      displayName: entry.display_name,
      weeklyXp: entry.weekly_xp,
      rank: entry.rank_position,
    })),
  });
}
