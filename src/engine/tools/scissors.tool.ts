import { PixelEditCommand } from "../commands";
import { distance, type Point } from "../geometry";
import type { MaskLayer } from "../mask-layer";
import { tracePolygon } from "../polygon";
import { strokeWithHalo } from "./overlay";
import type { Tool, ToolContext, ToolPointer } from "./tool";

/** Minimum screen distance between recorded lasso points. */
const SAMPLE_PX = 2;

/**
 * Freehand lasso that keeps only the mask inside it. Drag around the area
 * to keep; on release everything outside is removed from the active class
 * (or from every class when "all classes" is on).
 */
export class ScissorsTool implements Tool {
    readonly id = "scissors";
    private lasso: Point[] | null = null;

    cursor(): string {
        return "crosshair";
    }

    isBusy(): boolean {
        return this.lasso !== null;
    }

    onPointerDown(e: ToolPointer, ctx: ToolContext): void {
        if (e.button !== 0 || this.targets(ctx).length === 0) {
            return;
        }
        this.lasso = [e.image];
        ctx.invalidate("overlay");
    }

    onPointerMove(e: ToolPointer, ctx: ToolContext): void {
        const lasso = this.lasso;
        if (!lasso) {
            return;
        }
        const minGap = SAMPLE_PX / ctx.viewport.scale;
        for (const p of e.samples) {
            const last = lasso.at(-1);
            if (!last || distance(last, p) >= minGap) {
                lasso.push(p);
            }
        }
        ctx.invalidate("overlay");
    }

    onPointerUp(_e: ToolPointer, ctx: ToolContext): void {
        this.commit(ctx);
    }

    commit(ctx: ToolContext): boolean {
        const lasso = this.lasso;
        this.lasso = null;
        ctx.invalidate("overlay");
        if (!lasso || lasso.length < 3) {
            return false;
        }
        const targets = this.targets(ctx);
        for (const layer of targets) {
            const g = layer.ctx;
            g.save();
            // destination-in keeps existing pixels only where the new shape
            // is drawn, which is exactly "keep inside, drop outside".
            g.globalCompositeOperation = "destination-in";
            g.fillStyle = "#ffffff";
            g.beginPath();
            tracePolygon(g, lasso);
            g.fill();
            g.restore();
        }
        // Anything outside the lasso may have changed, so the undo region is
        // the whole layer.
        const command = PixelEditCommand.capture(
            "Scissors",
            targets.map((layer) => ({ layer, rect: layer.fullRect() })),
            () => ctx.invalidate("masks"),
        );
        if (command) {
            ctx.pushHistory(command);
        }
        ctx.invalidate("masks");
        return true;
    }

    cancel(ctx: ToolContext): boolean {
        if (!this.lasso) {
            return false;
        }
        this.lasso = null;
        ctx.invalidate("overlay");
        return true;
    }

    renderOverlay(g: CanvasRenderingContext2D, ctx: ToolContext): void {
        if (!this.lasso) {
            return;
        }
        const points = this.lasso.map((p) => ctx.viewport.imageToScreen(p));
        g.beginPath();
        tracePolygon(g, points);
        g.fillStyle = "rgba(255, 255, 255, 0.08)";
        g.fill();
        g.setLineDash([6, 4]);
        strokeWithHalo(g, "#ffffff");
        g.setLineDash([]);
    }

    private targets(ctx: ToolContext): MaskLayer[] {
        if (ctx.settings.eraseAllClasses) {
            return [...ctx.doc.layers];
        }
        return ctx.activeLayer ? [ctx.activeLayer] : [];
    }
}
