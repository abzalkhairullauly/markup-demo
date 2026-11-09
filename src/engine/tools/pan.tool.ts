import type { Point } from "../geometry";
import type { Tool, ToolContext, ToolPointer } from "./tool";

export class PanTool implements Tool {
    readonly id = "pan";
    private last: Point | null = null;

    cursor(): string {
        return this.last ? "grabbing" : "grab";
    }

    isBusy(): boolean {
        return this.last !== null;
    }

    onPointerDown(e: ToolPointer): void {
        this.last = e.screen;
    }

    onPointerMove(e: ToolPointer, ctx: ToolContext): void {
        if (!this.last) {
            return;
        }
        ctx.viewport.panBy(e.screen.x - this.last.x, e.screen.y - this.last.y);
        this.last = e.screen;
    }

    onPointerUp(): void {
        this.last = null;
    }

    cancel(): boolean {
        const wasPanning = this.last !== null;
        this.last = null;
        return wasPanning;
    }
}
