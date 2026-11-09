import type { Rect, Size } from "./geometry";
import {
    context2d,
    createSurface,
    type Surface,
    type Surface2D,
} from "./surface";

export interface LabelClass {
    id: string;
    name: string;
    color: string;
    visible: boolean;
}

/**
 * The pixels of one label class.
 *
 * Masks are stored colour-agnostic (white with alpha), so renaming or
 * recolouring a class never touches pixel data and undo stays valid. The
 * class colour is applied only when compositing for display and export.
 *
 * Each layer keeps a second canvas, `committed`, with the state as of the
 * last finished edit. When an edit ends, the changed rectangle is copied out
 * of both canvases to build an undo step. Copies are canvas-to-canvas
 * `drawImage` calls, so nothing is read back from the GPU.
 */
export class MaskLayer implements LabelClass {
    readonly surface: Surface;
    readonly ctx: Surface2D;
    private readonly committed: Surface;
    private readonly committedCtx: Surface2D;

    constructor(
        readonly id: string,
        public name: string,
        public color: string,
        public visible: boolean,
        readonly size: Size,
    ) {
        this.surface = createSurface(size);
        this.ctx = context2d(this.surface);
        this.committed = createSurface(size);
        this.committedCtx = context2d(this.committed);
    }

    get bytes(): number {
        return this.size.width * this.size.height * 4;
    }

    /** Copies a rectangle of the current or committed pixels. */
    copyRegion(rect: Rect, from: "current" | "committed"): Surface {
        const copy = createSurface(rect);
        const source = from === "current" ? this.surface : this.committed;
        context2d(copy).drawImage(
            source,
            rect.x,
            rect.y,
            rect.width,
            rect.height,
            0,
            0,
            rect.width,
            rect.height,
        );
        return copy;
    }

    /** Replaces a rectangle with `pixels` (or clears it) and commits it. */
    putRegion(rect: Rect, pixels: Surface | null): void {
        this.ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
        if (pixels) {
            this.ctx.drawImage(pixels, rect.x, rect.y);
        }
        this.commit(rect);
    }

    /** Marks a rectangle of the current pixels as the new committed state. */
    commit(rect: Rect = this.fullRect()): void {
        this.committedCtx.clearRect(rect.x, rect.y, rect.width, rect.height);
        this.committedCtx.drawImage(
            this.surface,
            rect.x,
            rect.y,
            rect.width,
            rect.height,
            rect.x,
            rect.y,
            rect.width,
            rect.height,
        );
    }

    /** Throws away uncommitted pixels inside `rect`. */
    revert(rect: Rect = this.fullRect()): void {
        this.ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
        this.ctx.drawImage(
            this.committed,
            rect.x,
            rect.y,
            rect.width,
            rect.height,
            rect.x,
            rect.y,
            rect.width,
            rect.height,
        );
    }

    fullRect(): Rect {
        return { x: 0, y: 0, ...this.size };
    }
}
