import { distance, type Point } from "../geometry";
import { drawLabel, drawVertex, strokeWithHalo } from "./overlay";
import type { Tool, ToolContext, ToolPointer } from "./tool";

/** Snaps `p` so the segment from `origin` is a multiple of 45°. */
export function snapAngle(origin: Point, p: Point): Point {
    const dx = p.x - origin.x;
    const dy = p.y - origin.y;
    const length = Math.hypot(dx, dy);
    const step = Math.PI / 4;
    const angle = Math.round(Math.atan2(dy, dx) / step) * step;
    return {
        x: origin.x + Math.cos(angle) * length,
        y: origin.y + Math.sin(angle) * length,
    };
}

/**
 * Drag to measure a distance in image pixels. Shift snaps to 45°. The last
 * measurement stays on screen until the next one, Escape or a tool change.
 * It never changes the masks.
 */
export class RulerTool implements Tool {
    readonly id = "ruler";
    private from: Point | null = null;
    private to: Point | null = null;
    private dragging = false;

    cursor(): string {
        return "crosshair";
    }

    isBusy(): boolean {
        return this.dragging;
    }

    /** Length of the current measurement in image pixels. */
    get length(): number | null {
        return this.from && this.to ? distance(this.from, this.to) : null;
    }

    onPointerDown(e: ToolPointer, ctx: ToolContext): void {
        if (e.button !== 0) {
            return;
        }
        this.from = e.image;
        this.to = e.image;
        this.dragging = true;
        ctx.invalidate("overlay");
    }

    onPointerMove(e: ToolPointer, ctx: ToolContext): void {
        if (!this.dragging || !this.from) {
            return;
        }
        this.to = e.shiftKey ? snapAngle(this.from, e.image) : e.image;
        ctx.invalidate("overlay");
    }

    onPointerUp(): void {
        this.dragging = false;
    }

    cancel(ctx: ToolContext): boolean {
        if (!this.from) {
            return false;
        }
        this.from = null;
        this.to = null;
        this.dragging = false;
        ctx.invalidate("overlay");
        return true;
    }

    renderOverlay(g: CanvasRenderingContext2D, ctx: ToolContext): void {
        const length = this.length;
        if (!this.from || !this.to || length === null) {
            return;
        }
        const a = ctx.viewport.imageToScreen(this.from);
        const b = ctx.viewport.imageToScreen(this.to);
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
        strokeWithHalo(g, "#facc15", 2);
        drawVertex(g, a, 3.5, true);
        drawVertex(g, b, 3.5, true);
        drawLabel(g, `${length.toFixed(1)} px`, {
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2 - 16,
        });
    }
}
