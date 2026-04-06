export const runtime = "nodejs";

import { postScheduledArticles } from "@/lib/facebook";

export async function GET(request: Request) {
    const authHeader = request.headers.get("Authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

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
