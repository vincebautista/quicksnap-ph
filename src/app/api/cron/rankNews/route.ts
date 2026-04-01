import { scoreUnscored } from "@/lib/gemini";

export async function GET() {
    try {
        const count = await scoreUnscored();
        return Response.json({ success: true, scored: count });
    } catch (error) {
        console.error("[rank cron] error:", error);
        return Response.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        );
    }
}