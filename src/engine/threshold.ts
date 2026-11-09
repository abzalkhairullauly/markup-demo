import type { Rect, Size } from "./geometry";

/**
 * Perceived brightness (Rec. 709 luma) of every pixel of an RGBA buffer,
 * 0–255. Integer weights 54/183/19 sum to 256, so `>> 8` divides exactly.
 */
export function luminance(rgba: Uint8ClampedArray): Uint8Array {
    const luma = new Uint8Array(rgba.length / 4);
    for (let i = 0, p = 0; p < luma.length; i += 4, p++) {
        luma[p] =
            ((rgba[i] ?? 0) * 54 +
                (rgba[i + 1] ?? 0) * 183 +
                (rgba[i + 2] ?? 0) * 19) >>
            8;
    }
    return luma;
}

export interface ThresholdResult {
    /** RGBA pixels: `color` where the pixel is in range, transparent elsewhere. */
    pixels: Uint8ClampedArray<ArrayBuffer>;
    /** Bounding box of the matched pixels, or null if nothing matched. */
    bounds: Rect | null;
    count: number;
}

/**
 * Selects every pixel whose brightness is within [min, max]. The bounding
 * box keeps the undo step as small as the actual change.
 */
export function thresholdPixels(
    luma: Uint8Array,
    size: Size,
    min: number,
    max: number,
    color: readonly [number, number, number, number] = [255, 255, 255, 255],
): ThresholdResult {
    const { width, height } = size;
    const pixels = new Uint8ClampedArray(width * height * 4);
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let count = 0;
    const [r, g, b, a] = color;
    for (let y = 0, p = 0; y < height; y++) {
        for (let x = 0; x < width; x++, p++) {
            const v = luma[p] ?? 0;
            if (v < min || v > max) {
                continue;
            }
            const i = p * 4;
            pixels[i] = r;
            pixels[i + 1] = g;
            pixels[i + 2] = b;
            pixels[i + 3] = a;
            count++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    }
    const bounds =
        count > 0
            ? {
                  x: minX,
                  y: minY,
                  width: maxX - minX + 1,
                  height: maxY - minY + 1,
              }
            : null;
    return { pixels, bounds, count };
}

/** A range of `±tolerance` around a sampled brightness, clipped to 0–255. */
export function rangeAround(
    value: number,
    tolerance: number,
): { min: number; max: number } {
    return {
        min: Math.max(0, Math.round(value - tolerance)),
        max: Math.min(255, Math.round(value + tolerance)),
    };
}

/** Parses "#rrggbb" into RGB components. */
export function hexToRgb(hex: string): [number, number, number] {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
    if (!m) {
        return [255, 255, 255];
    }
    return [
        parseInt(m[1] ?? "ff", 16),
        parseInt(m[2] ?? "ff", 16),
        parseInt(m[3] ?? "ff", 16),
    ];
}
