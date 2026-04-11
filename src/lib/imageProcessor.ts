import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import path from "path";
import fs from "fs";

// Register font once at module level
const FONT_PATH = path.join(process.cwd(), "public", "fonts", "Oswald-Bold.ttf");
if (fs.existsSync(FONT_PATH)) {
    GlobalFonts.registerFromPath(FONT_PATH, "Oswald");
} else {
    console.warn("[imageProcessor] NotoSans-Bold.ttf not found at", FONT_PATH);
}

const BRAND_COLOR = "#0065eb";
const BORDER_WIDTH = 8;
const LOGO_SIZE = 80;
const LOGO_PADDING = 16;
const BAR_HEIGHT_RATIO = 0.35;
const BAR_OPACITY = 0.82;
const LOGO_PATH = path.join(process.cwd(), "public", "logo.png");

export interface ProcessedImage {
    base64: string;
    mimeType: "image/png";
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Image fetch failed: ${res.status} ${url}`);
    return Buffer.from(await res.arrayBuffer());
}

function wrapText(
    ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
    text: string,
    maxWidth: number
): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let current = "";

    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (ctx.measureText(candidate).width <= maxWidth) {
            current = candidate;
        } else {
            if (current) lines.push(current);
            current = word;
        }
    }
    if (current) lines.push(current);
    return lines;
}

export async function processArticleImage(
    imageUrl: string,
    headline: string
): Promise<ProcessedImage> {
    // ── 1. Load source image ──────────────────────────────────────────────────
    const sourceBuffer = await fetchImageBuffer(imageUrl);
    const sourceImg = await loadImage(sourceBuffer);

    const W = sourceImg.width;
    const H = sourceImg.height;

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    // ── 2. Draw source photo ──────────────────────────────────────────────────
    ctx.drawImage(sourceImg, 0, 0, W, H);

    // ── 3. Bottom bar overlay ─────────────────────────────────────────────────
    const barH = Math.round(H * BAR_HEIGHT_RATIO);
    const barY = H - barH;
    ctx.fillStyle = `rgba(0, 0, 0, ${BAR_OPACITY})`;
    ctx.fillRect(0, barY, W, barH);

    // ── 4. Brand border ───────────────────────────────────────────────────────
    ctx.strokeStyle = BRAND_COLOR;
    ctx.lineWidth = BORDER_WIDTH * 2;
    ctx.strokeRect(0, 0, W, H);

    // ── 5. Headline text ──────────────────────────────────────────────────────
    const horizontalPad = W * 0.06;
    const maxTextWidth = W - horizontalPad * 2;
    const rawFontSize = Math.round(W * 0.032);
    const fontSize = Math.max(16, Math.min(34, rawFontSize));
    const lineHeight = fontSize * 1.3;

    // Use registered NotoSans if available, fallback to sans-serif
    const fontFamily = GlobalFonts.has("NotoSans") ? "NotoSans" : "sans-serif";
    ctx.font = `bold ${fontSize}px "${fontFamily}"`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const lines = wrapText(ctx, headline.toUpperCase(), maxTextWidth);
    const totalTextHeight = lines.length * lineHeight;
    const textBlockStartY = barY + (barH - totalTextHeight) / 2 + lineHeight / 2;

    lines.forEach((line, i) => {
        const y = textBlockStartY + i * lineHeight;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(line, W / 2, y);
    });

    // ── 6. Logo watermark ─────────────────────────────────────────────────────
    try {
        const logoBuffer = await fs.promises.readFile(LOGO_PATH);
        const logo = await loadImage(logoBuffer);
        const logoX = W - LOGO_SIZE - LOGO_PADDING - BORDER_WIDTH;
        const logoY = LOGO_PADDING + BORDER_WIDTH;

        ctx.save();
        ctx.beginPath();
        ctx.arc(logoX + LOGO_SIZE / 2, logoY + LOGO_SIZE / 2, LOGO_SIZE / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(logo, logoX, logoY, LOGO_SIZE, LOGO_SIZE);
        ctx.restore();
    } catch {
        console.warn("[imageProcessor] Logo not found — skipping watermark");
    }

    // ── 7. Return as base64 PNG ───────────────────────────────────────────────
    const base64 = canvas.toBuffer("image/png").toString("base64");
    return { base64, mimeType: "image/png" };
}