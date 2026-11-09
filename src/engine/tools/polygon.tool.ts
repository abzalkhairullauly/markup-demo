import { PixelEditCommand } from "../commands";
import { distance, pixelRect, type Point } from "../geometry";
import { PolygonDraft, polygonBounds, tracePolygon } from "../polygon";
import type { Tool, ToolContext, ToolKey, ToolPointer } from "./tool";

/** Screen distance at which a click snaps to the first vertex. */
const SNAP_PX = 8;
/** Screen distance under which two clicks count as the same point. */
const DUPLICATE_PX = 4;

/**
 * Click to add vertices. Double-click, Enter or a click on the first vertex
 * closes and fills the shape; Backspace removes the last vertex; Escape
 * drops the shape.
 */
export class PolygonTool implements Tool {
    readonly id = "polygon";
    private readonly draft = new PolygonDraft();

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
        const tolerance = SNAP_PX / ctx.viewport.scale;
        if (this.draft.canClose && this.draft.isNearStart(e.image, tolerance)) {
            this.finish(ctx);
            return;
        }
        this.draft.add(e.image);
        ctx.invalidate("overlay");
    }

    onDoubleClick(_e: ToolPointer, ctx: ToolContext): void {
        this.draft.dropTrailingDuplicates(DUPLICATE_PX / ctx.viewport.scale);
        this.finish(ctx);
    }

    onKey(e: ToolKey, ctx: ToolContext): boolean {
        if (this.draft.isEmpty) {
            return false;
        }
        switch (e.key) {
            case "Backspace":
                this.draft.removeLast();
                ctx.invalidate("overlay");
                return true;
            default:
                return false;
        }
    }

    commit(ctx: ToolContext): boolean {
        if (!this.draft.canClose) {
            return false;
        }
        this.finish(ctx);
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
        const first = points[0];
        if (!first) {
            return;
        }
        const hover = ctx.hover;
        const snapping =
            hover !== null &&
            this.draft.canClose &&
            distance(hover, first) <= SNAP_PX;

        g.beginPath();
        points.forEach((p, i) =>
            i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y),
        );
        if (hover) {
            const end = snapping ? first : hover;
            g.lineTo(end.x, end.y);
        }
        g.lineJoin = "round";
        g.lineWidth = 3;
        g.strokeStyle = "rgba(0, 0, 0, 0.6)";
        g.stroke();
        g.lineWidth = 1.5;
        g.strokeStyle = ctx.activeLayer?.color ?? "#ffffff";
        g.stroke();

        points.forEach((p, i) => {
            const isFirst = i === 0;
            g.beginPath();
            g.arc(p.x, p.y, isFirst && snapping ? 6 : 3.5, 0, Math.PI * 2);
            g.fillStyle = isFirst ? "#ffffff" : "#111827";
            g.fill();
            g.lineWidth = 1.5;
            g.strokeStyle = isFirst ? "#111827" : "#ffffff";
            g.stroke();
        });
    }

    private finish(ctx: ToolContext): void {
        const layer = ctx.activeLayer;
        const points: Point[] | null = this.draft.close();
        ctx.invalidate("overlay");
        if (!layer || !points) {
            return;
        }
        const bounds = polygonBounds(points);
        const rect = bounds && pixelRect(bounds, ctx.doc.size);
        if (!rect) {
            return;
        }
        const g = layer.ctx;
        g.save();
        g.fillStyle = "#ffffff";
        g.beginPath();
        tracePolygon(g, points);
        g.fill();
        g.restore();

        const command = PixelEditCommand.capture(
            "Polygon",
            [{ layer, rect }],
            () => ctx.invalidate("masks"),
        );
        if (command) {
            ctx.pushHistory(command);
        }
        ctx.invalidate("masks");
    }
}
