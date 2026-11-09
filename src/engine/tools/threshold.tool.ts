import { PixelEditCommand } from "../commands";
import { context2d, createSurface, type Surface } from "../surface";
import { hexToRgb, rangeAround, thresholdPixels } from "../threshold";
import type { Tool, ToolContext, ToolPointer } from "./tool";

/** Brightness range picked around a clicked pixel. */
export const PICK_TOLERANCE = 24;

/**
 * Selects pixels by brightness. The range comes from the panel sliders or
 * from clicking a pixel (its brightness ±24). Matching pixels are previewed
 * in the active class colour; Enter or "Apply" adds them to the class.
 */
export class ThresholdTool implements Tool {
    readonly id = "threshold";
    private preview: {
        doc: object;
        key: string;
        surface: Surface;
        count: number;
    } | null = null;

    cursor(): string {
        return "copy";
    }

    onPointerDown(e: ToolPointer, ctx: ToolContext): void {
        if (e.button !== 0) {
            return;
        }
        const { width, height } = ctx.doc.size;
        const x = Math.floor(e.image.x);
        const y = Math.floor(e.image.y);
        if (x < 0 || y < 0 || x >= width || y >= height) {
            return;
        }
        const value = ctx.imageLuma()[y * width + x] ?? 0;
        ctx.updateSettings({ threshold: rangeAround(value, PICK_TOLERANCE) });
    }

    commit(ctx: ToolContext): boolean {
        const layer = ctx.activeLayer;
        if (!layer) {
            return false;
        }
        const { min, max } = ctx.settings.threshold;
        const size = ctx.doc.size;
        const result = thresholdPixels(ctx.imageLuma(), size, min, max);
        if (!result.bounds) {
            return false;
        }
        const matched = createSurface(size);
        context2d(matched).putImageData(
            new ImageData(result.pixels, size.width, size.height),
            0,
            0,
        );
        layer.ctx.drawImage(matched, 0, 0);
        const command = PixelEditCommand.capture(
            "Threshold",
            [{ layer, rect: result.bounds }],
            () => ctx.invalidate("masks"),
        );
        if (command) {
            ctx.pushHistory(command);
        }
        ctx.invalidate("masks", "overlay");
        return true;
    }

    cancel(): boolean {
        return false;
    }

    renderOverlay(g: CanvasRenderingContext2D, ctx: ToolContext): void {
        const layer = ctx.activeLayer;
        if (!layer) {
            return;
        }
        const preview = this.previewFor(ctx, layer.color);
        if (preview.count === 0) {
            return;
        }
        const { scale, offsetX, offsetY } = ctx.viewport;
        g.save();
        g.transform(scale, 0, 0, scale, offsetX, offsetY);
        g.imageSmoothingEnabled = scale < 1;
        g.globalAlpha = 0.7;
        g.drawImage(preview.surface, 0, 0);
        g.restore();
    }

    /** The preview is rebuilt only when the range, colour or image changes. */
    private previewFor(ctx: ToolContext, color: string) {
        const { min, max } = ctx.settings.threshold;
        const size = ctx.doc.size;
        const key = `${min}:${max}:${color}`;
        if (this.preview?.doc === ctx.doc && this.preview.key === key) {
            return this.preview;
        }
        const [r, g, b] = hexToRgb(color);
        const result = thresholdPixels(ctx.imageLuma(), size, min, max, [
            r,
            g,
            b,
            255,
        ]);
        const surface =
            this.preview?.surface.width === size.width &&
            this.preview.surface.height === size.height
                ? this.preview.surface
                : createSurface(size);
        context2d(surface).putImageData(
            new ImageData(result.pixels, size.width, size.height),
            0,
            0,
        );
        this.preview = { doc: ctx.doc, key, surface, count: result.count };
        return this.preview;
    }
}
