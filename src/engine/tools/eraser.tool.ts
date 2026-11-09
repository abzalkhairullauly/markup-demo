import type { MaskLayer } from "../mask-layer";
import { PaintStrokeTool } from "./paint-stroke";
import type { ToolContext } from "./tool";

/** Erases the active class, or every class when "erase all" is on. */
export class EraserTool extends PaintStrokeTool {
    readonly id = "eraser";
    protected readonly mode = "erase";
    protected readonly label = "Erase";

    protected targets(ctx: ToolContext): MaskLayer[] {
        if (ctx.settings.eraseAllClasses) {
            return [...ctx.doc.layers];
        }
        return ctx.activeLayer ? [ctx.activeLayer] : [];
    }
}
