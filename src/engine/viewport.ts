import { clamp, type Point, type Size } from "./geometry";

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 32;

/** Zoom steps used by the +/- keys and buttons. */
const ZOOM_STEPS = [
    0.05, 0.0625, 0.083, 0.125, 0.167, 0.25, 0.333, 0.5, 0.667, 1, 1.5, 2, 3, 4,
    6, 8, 12, 16, 24, 32,
];

/**
 * Maps image pixels to screen (CSS) pixels:
 *
 *   screen = image * scale + offset
 *
 * The viewport knows nothing about canvases; it is just the transform plus
 * the size of the frame it is shown in.
 */
export class Viewport {
    private _scale = 1;
    private _offsetX = 0;
    private _offsetY = 0;
    private frame: Size = { width: 0, height: 0 };
    private listeners = new Set<() => void>();

    get scale(): number {
        return this._scale;
    }

    get offsetX(): number {
        return this._offsetX;
    }

    get offsetY(): number {
        return this._offsetY;
    }

    get frameSize(): Size {
        return this.frame;
    }

    onChange(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    setFrameSize(size: Size): void {
        this.frame = { ...size };
        this.emit();
    }

    screenToImage(p: Point): Point {
        return {
            x: (p.x - this._offsetX) / this._scale,
            y: (p.y - this._offsetY) / this._scale,
        };
    }

    imageToScreen(p: Point): Point {
        return {
            x: p.x * this._scale + this._offsetX,
            y: p.y * this._scale + this._offsetY,
        };
    }

    /** Sets the zoom level, keeping the screen point `anchor` fixed. */
    zoomTo(scale: number, anchor: Point = this.frameCenter()): void {
        const next = clamp(scale, MIN_ZOOM, MAX_ZOOM);
        if (next === this._scale) {
            return;
        }
        const imagePoint = this.screenToImage(anchor);
        this._scale = next;
        this._offsetX = anchor.x - imagePoint.x * next;
        this._offsetY = anchor.y - imagePoint.y * next;
        this.emit();
    }

    zoomBy(factor: number, anchor?: Point): void {
        this.zoomTo(this._scale * factor, anchor);
    }

    zoomIn(anchor?: Point): void {
        const next = ZOOM_STEPS.find((s) => s > this._scale * 1.001);
        this.zoomTo(next ?? MAX_ZOOM, anchor);
    }

    zoomOut(anchor?: Point): void {
        const next = ZOOM_STEPS.findLast((s) => s < this._scale * 0.999);
        this.zoomTo(next ?? MIN_ZOOM, anchor);
    }

    panBy(dx: number, dy: number): void {
        if (dx === 0 && dy === 0) {
            return;
        }
        this._offsetX += dx;
        this._offsetY += dy;
        this.emit();
    }

    /** Fits the whole image into the frame and centres it. */
    fit(image: Size, padding = 24): void {
        if (image.width === 0 || image.height === 0) {
            return;
        }
        const availableW = Math.max(1, this.frame.width - padding * 2);
        const availableH = Math.max(1, this.frame.height - padding * 2);
        const scale = clamp(
            Math.min(availableW / image.width, availableH / image.height),
            MIN_ZOOM,
            MAX_ZOOM,
        );
        this.center(image, scale);
    }

    /** Shows the image at the given scale, centred in the frame. */
    center(image: Size, scale = this._scale): void {
        this._scale = clamp(scale, MIN_ZOOM, MAX_ZOOM);
        this._offsetX = (this.frame.width - image.width * this._scale) / 2;
        this._offsetY = (this.frame.height - image.height * this._scale) / 2;
        this.emit();
    }

    private frameCenter(): Point {
        return { x: this.frame.width / 2, y: this.frame.height / 2 };
    }

    private emit(): void {
        for (const listener of this.listeners) {
            listener();
        }
    }
}
