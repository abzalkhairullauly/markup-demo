import type { MaskLayer } from "../mask-layer";
import { PaintStrokeTool } from "./paint-stroke";
import type { ToolContext } from "./tool";

export class BrushTool extends PaintStrokeTool {
    readonly id = "brush";
    protected readonly mode = "paint";
    protected readonly label = "Brush stroke";

    protected targets(ctx: ToolContext): MaskLayer[] {
        return ctx.activeLayer ? [ctx.activeLayer] : [];
    }
}
