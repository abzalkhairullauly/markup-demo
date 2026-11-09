import type { AnnotationDocument } from "./document";
import type { Rect } from "./geometry";
import type { Command } from "./history";
import type { MaskLayer } from "./mask-layer";
import type { Surface } from "./surface";

interface Patch {
    layer: MaskLayer;
    rect: Rect;
    before: Surface;
    /** `null` means the region was cleared, so nothing needs storing. */
    after: Surface | null;
}

/**
 * Undo step for a pixel edit. Holds before/after copies of the changed
 * rectangle of each touched layer, never full snapshots.
 */
export class PixelEditCommand implements Command {
    readonly bytes: number;

    private constructor(
        readonly label: string,
        private readonly patches: readonly Patch[],
        private readonly onApply: () => void,
    ) {
        this.bytes = patches.reduce(
            (sum, p) =>
                sum + p.rect.width * p.rect.height * 4 * (p.after ? 2 : 1),
            0,
        );
    }

    /**
     * Call right after drawing into the layers. Captures the regions and
     * commits them. Returns null if no region was actually touched.
     */
    static capture(
        label: string,
        edits: readonly { layer: MaskLayer; rect: Rect | null }[],
        onApply: () => void,
        options: { cleared?: boolean } = {},
    ): PixelEditCommand | null {
        const patches: Patch[] = [];
        for (const { layer, rect } of edits) {
            if (!rect) {
                continue;
            }
            patches.push({
                layer,
                rect,
                before: layer.copyRegion(rect, "committed"),
                after: options.cleared
                    ? null
                    : layer.copyRegion(rect, "current"),
            });
            layer.commit(rect);
        }
        return patches.length > 0
            ? new PixelEditCommand(label, patches, onApply)
            : null;
    }

    undo(): void {
        for (const patch of this.patches) {
            patch.layer.putRegion(patch.rect, patch.before);
        }
        this.onApply();
    }

    redo(): void {
        for (const patch of this.patches) {
            patch.layer.putRegion(patch.rect, patch.after);
        }
        this.onApply();
    }
}

/** Removing a class keeps its layer alive so undo can put it back. */
export class RemoveClassCommand implements Command {
    readonly label = "Delete class";
    readonly bytes: number;

    constructor(
        private readonly doc: AnnotationDocument,
        private readonly layer: MaskLayer,
        private readonly index: number,
        private readonly onApply: () => void,
    ) {
        this.bytes = layer.bytes * 2;
    }

    undo(): void {
        this.doc.attach(this.layer, this.index);
        this.onApply();
    }

    redo(): void {
        this.doc.detach(this.layer.id);
        this.onApply();
    }
}
