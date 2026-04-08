import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function getCutoffDateIso(): string {
    const now = new Date();
    const startOfTodayUtc = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );

    // Keep the last 2 calendar days.
    // Example: Apr 6 run => cutoff Apr 4 00:00 UTC, so Apr 3 and earlier are deleted.
    startOfTodayUtc.setUTCDate(startOfTodayUtc.getUTCDate() - 2);
    return startOfTodayUtc.toISOString();
}

export async function GET() {
    try {
        const cutoffIso = getCutoffDateIso();

        const { data, error } = await supabase
            .from("news_articles")
            .delete()
            .lt("published", cutoffIso)
            .select("id");

        if (error) {
            throw new Error(`Cleanup failed: ${error.message}`);
        }

        return NextResponse.json({
            success: true,
            cutoff: cutoffIso,
            deleted: data?.length ?? 0,
        });
    } catch (error) {
        console.error("[cleanup-old-articles cron] error:", error);
        return NextResponse.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        );
    }
}