export interface Point {
    x: number;
    y: number;
}

export interface Size {
    width: number;
    height: number;
}

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export function distance(a: Point, b: Point): number {
    return Math.hypot(b.x - a.x, b.y - a.y);
}

export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

/** Bounding box of a set of points, grown by `padding` on every side. */
export function boundsOf(points: readonly Point[], padding = 0): Rect | null {
    if (points.length === 0) {
        return null;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }
    return {
        x: minX - padding,
        y: minY - padding,
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2,
    };
}

/**
 * Snaps a rect outwards to whole pixels and clips it to `size`.
 * Returns null when nothing is left after clipping.
 */
export function pixelRect(rect: Rect, size: Size): Rect | null {
    const x0 = clamp(Math.floor(rect.x), 0, size.width);
    const y0 = clamp(Math.floor(rect.y), 0, size.height);
    const x1 = clamp(Math.ceil(rect.x + rect.width), 0, size.width);
    const y1 = clamp(Math.ceil(rect.y + rect.height), 0, size.height);
    if (x1 <= x0 || y1 <= y0) {
        return null;
    }
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}
