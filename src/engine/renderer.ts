import type { AnnotationDocument } from "./document";
import {
    context2d,
    createSurface,
    type Surface,
    type Surface2D,
} from "./surface";
import type { RenderLayer } from "./tools/tool";
import type { Viewport } from "./viewport";

export interface StageCanvases {
    image: HTMLCanvasElement;
    masks: HTMLCanvasElement;
    overlay: HTMLCanvasElement;
}

export interface RenderSource {
    doc(): AnnotationDocument | null;
    maskOpacity(): number;
    drawOverlay(g: CanvasRenderingContext2D): void;
}

/**
 * Owns the three stacked stage canvases and the only animation frame loop.
 *
 * Nothing draws directly: callers mark layers dirty with `invalidate()` and
 * the next frame redraws just those layers. Many invalidations within one
 * frame collapse into a single redraw.
 *
 *   image    redrawn on viewport change
 *   masks    redrawn on viewport change or pixel edits
 *   overlay  redrawn on every pointer move (cursor, shape previews)
 */
export class Renderer {
    private readonly image: CanvasRenderingContext2D;
    private readonly masks: CanvasRenderingContext2D;
    private readonly overlay: CanvasRenderingContext2D;
    /** Screen-sized scratch canvas used to tint one mask at a time. */
    private tint: Surface;
    private tintCtx: Surface2D;

    private readonly dirty = new Set<RenderLayer>();
    private frame = 0;
    private dpr = 1;
    private destroyed = false;

    constructor(
        private readonly canvases: StageCanvases,
        private readonly viewport: Viewport,
        private readonly source: RenderSource,
    ) {
        this.image = stageContext(canvases.image);
        this.masks = stageContext(canvases.masks);
        this.overlay = stageContext(canvases.overlay);
        this.tint = createSurface({ width: 1, height: 1 });
        this.tintCtx = context2d(this.tint);
    }

    /** Resizes the backing stores. `width`/`height` are device pixels. */
    resize(width: number, height: number, dpr: number): void {
        this.dpr = dpr;
        for (const canvas of Object.values(this.canvases)) {
            canvas.width = width;
            canvas.height = height;
        }
        this.tint = createSurface({ width, height });
        this.tintCtx = context2d(this.tint);
        this.invalidate("image", "masks", "overlay");
    }

    invalidate(...layers: RenderLayer[]): void {
        if (this.destroyed) {
            return;
        }
        for (const layer of layers) {
            this.dirty.add(layer);
        }
        if (!this.frame && this.dirty.size > 0) {
            this.frame = requestAnimationFrame(this.render);
        }
    }

    destroy(): void {
        this.destroyed = true;
        cancelAnimationFrame(this.frame);
    }

    private readonly render = (): void => {
        this.frame = 0;
        if (this.dirty.has("image")) {
            this.drawImage();
        }
        if (this.dirty.has("masks")) {
            this.drawMasks();
        }
        if (this.dirty.has("overlay")) {
            this.drawOverlay();
        }
        this.dirty.clear();
    };

    private applyViewport(g: Surface2D): void {
        const { scale, offsetX, offsetY } = this.viewport;
        const k = this.dpr * scale;
        g.setTransform(k, 0, 0, k, offsetX * this.dpr, offsetY * this.dpr);
        // Smooth when zoomed out, show crisp pixels when zoomed in.
        g.imageSmoothingEnabled = scale < 2;
        g.imageSmoothingQuality = "high";
    }

    private drawImage(): void {
        const g = this.image;
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, g.canvas.width, g.canvas.height);
        const doc = this.source.doc();
        if (!doc) {
            return;
        }
        this.applyViewport(g);
        g.drawImage(doc.image, 0, 0);
    }

    private drawMasks(): void {
        const g = this.masks;
        const { width, height } = g.canvas;
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, width, height);
        const doc = this.source.doc();
        if (!doc) {
            return;
        }
        const t = this.tintCtx;
        g.globalAlpha = this.source.maskOpacity();
        for (const layer of doc.layers) {
            if (!layer.visible) {
                continue;
            }
            // Masks are white + alpha; colour them on the scratch canvas,
            // then composite the result onto the visible mask canvas.
            t.globalCompositeOperation = "source-over";
            t.setTransform(1, 0, 0, 1, 0, 0);
            t.clearRect(0, 0, width, height);
            this.applyViewport(t);
            t.imageSmoothingEnabled = this.viewport.scale < 1;
            t.drawImage(layer.surface, 0, 0);
            t.setTransform(1, 0, 0, 1, 0, 0);
            t.globalCompositeOperation = "source-in";
            t.fillStyle = layer.color;
            t.fillRect(0, 0, width, height);
            g.drawImage(this.tint, 0, 0);
        }
        g.globalAlpha = 1;
    }

    private drawOverlay(): void {
        const g = this.overlay;
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, g.canvas.width, g.canvas.height);
        g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.source.drawOverlay(g);
    }
}

function stageContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("2D canvas context is not available.");
    }
    return ctx;
}
