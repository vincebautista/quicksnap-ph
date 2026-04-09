/**
 * lib/imageProcessor.ts
 *
 * Processes a news article image by adding:
 * - A semi-transparent black overlay
 * - Center-aligned headline text
 * - Logo watermark in the upper-right corner
 * - Brand-color border around the whole image
 *
 * Uses `canvas` (npm: `canvas`) — works in Node.js / Next.js API routes.
 * Install: npm install canvas
 */

import { createCanvas, loadImage, registerFont, CanvasRenderingContext2D as NodeCanvasRenderingContext2D } from "canvas";
import path from "path";

const BRAND_COLOR = "#0065eb";
const BORDER_WIDTH = 8;            // px — brand-color border around entire image
const LOGO_SIZE = 80;              // px — logo in upper-right (larger for visibility)
const LOGO_PADDING = 16;           // px — distance from corner edges
// Bottom bar: opaque black rectangle over the lower portion of the image
const BAR_HEIGHT_RATIO = 0.35;     // 35% of image height — increase if headline wraps a lot
const BAR_OPACITY = 0.82;          // near-opaque so text is always legible

// Path to your fox logo (place a square PNG in /public/logo.png)
const LOGO_PATH = path.join(process.cwd(), "public", "logo.png");

// Optional: register a custom font for the headline
// registerFont(path.join(process.cwd(), "public", "fonts", "NotoSans-Bold.ttf"), { family: "NotoSans", weight: "bold" });

export interface ProcessedImage {
    /** Base64-encoded PNG (no data-URI prefix) */
    base64: string;
    mimeType: "image/png";
}

/**
 * Download a remote image and return a Buffer.
 */
async function fetchImageBuffer(url: string): Promise<Buffer> {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Image fetch failed: ${res.status} ${url}`);
    return Buffer.from(await res.arrayBuffer());
}

/**
 * Wrap text into lines that fit within `maxWidth` pixels.
 */
function wrapText(
    ctx: NodeCanvasRenderingContext2D,
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

/**
 * Core function: fetch the original image and composite the overlay.
 *
 * @param imageUrl  - Remote URL of the article's hero image
 * @param headline  - Tagalog (or English) headline text to display
 * @returns         - Base64 PNG suitable for uploading to Facebook /photos
 */
export async function processArticleImage(
    imageUrl: string,
    headline: string
): Promise<ProcessedImage> {
    // ── 1. Load the source image ──────────────────────────────────────────────
    const sourceBuffer = await fetchImageBuffer(imageUrl);
    const sourceImg = await loadImage(sourceBuffer);

    const W = sourceImg.width;
    const H = sourceImg.height;

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    // ── 2. Draw source photo ──────────────────────────────────────────────────
    ctx.drawImage(sourceImg, 0, 0, W, H);

    // ── 3. Bottom-bar black overlay ───────────────────────────────────────────
    // Only darkens the lower portion of the image — photo stays fully visible above
    const barH = Math.round(H * BAR_HEIGHT_RATIO);
    const barY = H - barH;
    ctx.fillStyle = `rgba(0, 0, 0, ${BAR_OPACITY})`;
    ctx.fillRect(0, barY, W, barH);

    // ── 4. Brand-color border around the whole image ──────────────────────────
    ctx.strokeStyle = BRAND_COLOR;
    ctx.lineWidth = BORDER_WIDTH * 2; // strokeRect centers on the edge
    ctx.strokeRect(0, 0, W, H);

    // ── 5. Headline text centered inside the bar ──────────────────────────────
    const horizontalPad = W * 0.06;
    const maxTextWidth = W - horizontalPad * 2;

    // Dynamic font size based on image width, clamped between 16–34px
    const rawFontSize = Math.round(W * 0.032);
    const fontSize = Math.max(16, Math.min(34, rawFontSize));
    const lineHeight = fontSize * 1.3;

    ctx.font = `bold ${fontSize}px "Arial", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const lines = wrapText(ctx, headline.toUpperCase(), maxTextWidth);
    const totalTextHeight = lines.length * lineHeight;

    // Vertically center the text block within the bar
    const textBlockStartY = barY + (barH - totalTextHeight) / 2 + lineHeight / 2;

    lines.forEach((line, i) => {
        const y = textBlockStartY + i * lineHeight;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(line, W / 2, y);
    });

    // No shadow reset needed — we didn't set one

    // ── 6. Logo watermark (upper-right) ───────────────────────────────────────
    try {
        const logo = await loadImage(LOGO_PATH);
        const logoX = W - LOGO_SIZE - LOGO_PADDING - BORDER_WIDTH;
        const logoY = LOGO_PADDING + BORDER_WIDTH;

        // Slight circular clip so the logo looks clean
        ctx.save();
        ctx.beginPath();
        ctx.arc(logoX + LOGO_SIZE / 2, logoY + LOGO_SIZE / 2, LOGO_SIZE / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(logo, logoX, logoY, LOGO_SIZE, LOGO_SIZE);
        ctx.restore();
    } catch {
        // Logo file missing — skip silently (don't block posting)
        console.warn("[imageProcessor] Logo not found at", LOGO_PATH, "— skipping watermark");
    }

    // ── 7. Return as base64 PNG ───────────────────────────────────────────────
    const base64 = canvas.toBuffer("image/png").toString("base64");
    return { base64, mimeType: "image/png" };
}