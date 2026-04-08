export const runtime = "nodejs";

import { postScheduledArticles } from "@/lib/facebook";

export async function GET() {
    try {
        const posted = await postScheduledArticles();
        return Response.json({ success: true, posted });
    } catch (error) {
        console.error("[postToFacebook cron] error:", error);
        return Response.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        );
    }
}
