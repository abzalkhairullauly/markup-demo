import { PixelEditCommand } from "../commands";
import { pixelRect, type Point, type Rect } from "../geometry";
import type { MaskLayer } from "../mask-layer";
import { StrokeSampler } from "../stroke";
import type { Tool, ToolContext, ToolPointer } from "./tool";

type Mode = "paint" | "erase";

/** Shared stroke handling for the brush and the eraser. */
export abstract class PaintStrokeTool implements Tool {
    abstract readonly id: string;
    protected abstract readonly mode: Mode;
    protected abstract readonly label: string;

    private stroke: {
        targets: MaskLayer[];
        sampler: StrokeSampler;
        radius: number;
        dirty: Rect | null;
    } | null = null;

    protected abstract targets(ctx: ToolContext): MaskLayer[];

    cursor(ctx: ToolContext): string {
        // The overlay draws the brush outline; hide the system cursor unless
        // the brush is too small to see.
        return this.radius(ctx) * ctx.viewport.scale < 3 ? "crosshair" : "none";
    }

    isBusy(): boolean {
        return this.stroke !== null;
    }

    onPointerDown(e: ToolPointer, ctx: ToolContext): void {
        if (e.button !== 0 || this.stroke) {
            return;
        }
        const targets = this.targets(ctx);
        if (targets.length === 0) {
            return;
        }
        const radius = this.radius(ctx);
        const sampler = new StrokeSampler(Math.max(0.5, radius * 0.3));
        this.stroke = { targets, sampler, radius, dirty: null };
        this.stamp(sampler.start(e.image), ctx);
    }

    onPointerMove(e: ToolPointer, ctx: ToolContext): void {
        if (!this.stroke) {
            return;
        }
        const stamps: Point[] = [];
        for (const sample of e.samples) {
            stamps.push(...this.stroke.sampler.add(sample));
        }
        this.stamp(stamps, ctx);
    }

    onPointerUp(_e: ToolPointer, ctx: ToolContext): void {
        const stroke = this.stroke;
        this.stroke = null;
        if (!stroke?.dirty) {
            return;
        }
        const rect = pixelRect(stroke.dirty, ctx.doc.size);
        const command = PixelEditCommand.capture(
            this.label,
            stroke.targets.map((layer) => ({ layer, rect })),
            () => ctx.invalidate("masks"),
        );
        if (command) {
            ctx.pushHistory(command);
        }
    }

    cancel(ctx: ToolContext): boolean {
        const stroke = this.stroke;
        if (!stroke) {
            return false;
        }
        this.stroke = null;
        const rect = stroke.dirty && pixelRect(stroke.dirty, ctx.doc.size);
        if (rect) {
            stroke.targets.forEach((layer) => layer.revert(rect));
            ctx.invalidate("masks");
        }
        return true;
    }

    renderOverlay(g: CanvasRenderingContext2D, ctx: ToolContext): void {
        if (!ctx.hover) {
            return;
        }
        const r = this.radius(ctx) * ctx.viewport.scale;
        if (r < 3) {
            return;
        }
        const { x, y } = ctx.hover;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.lineWidth = 3;
        g.strokeStyle = "rgba(0, 0, 0, 0.6)";
        g.stroke();
        g.lineWidth = 1.25;
        g.strokeStyle = this.mode === "erase" ? "#fca5a5" : "#ffffff";
        g.setLineDash(this.mode === "erase" ? [4, 3] : []);
        g.stroke();
        g.setLineDash([]);
    }

    private radius(ctx: ToolContext): number {
        return ctx.settings.brushSize / 2;
    }

    private stamp(points: readonly Point[], ctx: ToolContext): void {
        const stroke = this.stroke;
        if (!stroke || points.length === 0) {
            return;
        }
        const r = stroke.radius;
        for (const layer of stroke.targets) {
            const g = layer.ctx;
            g.save();
            g.globalCompositeOperation =
                this.mode === "erase" ? "destination-out" : "source-over";
            g.fillStyle = "#ffffff";
            g.beginPath();
            for (const p of points) {
                g.moveTo(p.x + r, p.y);
                g.arc(p.x, p.y, r, 0, Math.PI * 2);
            }
            g.fill();
            g.restore();
        }
        for (const p of points) {
            stroke.dirty = growRect(stroke.dirty, p, r + 1);
        }
        ctx.invalidate("masks");
    }
}

function growRect(rect: Rect | null, p: Point, r: number): Rect {
    if (!rect) {
        return { x: p.x - r, y: p.y - r, width: r * 2, height: r * 2 };
    }
    const x0 = Math.min(rect.x, p.x - r);
    const y0 = Math.min(rect.y, p.y - r);
    const x1 = Math.max(rect.x + rect.width, p.x + r);
    const y1 = Math.max(rect.y + rect.height, p.y + r);
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}
