import { PixelEditCommand } from "../commands";
import { boundsOf, pixelRect } from "../geometry";
import { PolygonDraft, tracePolyline } from "../polygon";
import { drawVertex, strokeWithHalo } from "./overlay";
import type { Tool, ToolContext, ToolKey, ToolPointer } from "./tool";

/** Screen distance under which two clicks count as the same point. */
const DUPLICATE_PX = 4;

/**
 * Open polygon: click to add points, double-click or Enter to finish. The
 * line is painted into the active class with the brush size as its width,
 * which suits thin structures such as roads, wires or cracks.
 */
export class PolylineTool implements Tool {
    readonly id = "polyline";
    private readonly draft = new PolygonDraft(2);

    cursor(): string {
        return "crosshair";
    }

    isBusy(): boolean {
        return !this.draft.isEmpty;
    }

    onPointerDown(e: ToolPointer, ctx: ToolContext): void {
        if (e.button !== 0 || !ctx.activeLayer) {
            return;
        }
        this.draft.add(e.image);
        ctx.invalidate("overlay");
    }

    onDoubleClick(_e: ToolPointer, ctx: ToolContext): void {
        this.draft.dropTrailingDuplicates(DUPLICATE_PX / ctx.viewport.scale);
        this.commit(ctx);
    }

    onKey(e: ToolKey, ctx: ToolContext): boolean {
        if (e.key !== "Backspace" || this.draft.isEmpty) {
            return false;
        }
        this.draft.removeLast();
        ctx.invalidate("overlay");
        return true;
    }

    commit(ctx: ToolContext): boolean {
        const layer = ctx.activeLayer;
        const points = this.draft.close();
        ctx.invalidate("overlay");
        if (!layer || !points) {
            return false;
        }
        const width = ctx.settings.brushSize;
        const bounds = boundsOf(points, width / 2 + 1);
        const rect = bounds && pixelRect(bounds, ctx.doc.size);
        if (!rect) {
            return false;
        }
        const g = layer.ctx;
        g.save();
        g.strokeStyle = "#ffffff";
        g.lineWidth = width;
        g.lineCap = "round";
        g.lineJoin = "round";
        g.beginPath();
        tracePolyline(g, points);
        g.stroke();
        g.restore();

        const command = PixelEditCommand.capture(
            "Polyline",
            [{ layer, rect }],
            () => ctx.invalidate("masks"),
        );
        if (command) {
            ctx.pushHistory(command);
        }
        ctx.invalidate("masks");
        return true;
    }

    cancel(ctx: ToolContext): boolean {
        if (this.draft.isEmpty) {
            return false;
        }
        this.draft.clear();
        ctx.invalidate("overlay");
        return true;
    }

    renderOverlay(g: CanvasRenderingContext2D, ctx: ToolContext): void {
        const points = this.draft.points.map((p) =>
            ctx.viewport.imageToScreen(p),
        );
        if (points.length === 0) {
            return;
        }
        const color = ctx.activeLayer?.color ?? "#ffffff";
        const path = ctx.hover ? [...points, ctx.hover] : points;

        // The future line at its real width, then a crisp centre line.
        g.beginPath();
        tracePolyline(g, path);
        g.lineCap = "round";
        g.lineJoin = "round";
        g.globalAlpha = 0.35;
        g.lineWidth = Math.max(1, ctx.settings.brushSize * ctx.viewport.scale);
        g.strokeStyle = color;
        g.stroke();
        g.globalAlpha = 1;
        strokeWithHalo(g, color);

        points.forEach((p) => drawVertex(g, p));
    }
}
