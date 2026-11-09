import type { Size } from "./geometry";

export type Surface = OffscreenCanvas | HTMLCanvasElement;
export type Surface2D =
    OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

const hasOffscreenCanvas = typeof OffscreenCanvas !== "undefined";

/**
 * Creates a canvas that is never attached to the document. Uses
 * `OffscreenCanvas` where it exists and falls back to a detached element.
 */
export function createSurface(size: Size): Surface {
    const width = Math.max(1, Math.round(size.width));
    const height = Math.max(1, Math.round(size.height));
    if (hasOffscreenCanvas) {
        return new OffscreenCanvas(width, height);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

export function context2d(
    surface: Surface,
    options?: CanvasRenderingContext2DSettings,
): Surface2D {
    const ctx = surface.getContext("2d", options) as Surface2D | null;
    if (!ctx) {
        throw new Error("2D canvas context is not available.");
    }
    return ctx;
}

export async function surfaceToBlob(surface: Surface): Promise<Blob> {
    if ("convertToBlob" in surface) {
        return surface.convertToBlob({ type: "image/png" });
    }
    return new Promise((resolve, reject) => {
        surface.toBlob(
            (blob) =>
                blob ? resolve(blob) : reject(new Error("Export failed.")),
            "image/png",
        );
    });
}
