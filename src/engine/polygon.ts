import { boundsOf, distance, type Point, type Rect } from "./geometry";

export const MIN_POLYGON_POINTS = 3;

/** An in-progress polygon or polyline, in image coordinates. */
export class PolygonDraft {
    private _points: Point[] = [];

    /** `minPoints` is 3 for a closed shape, 2 for an open polyline. */
    constructor(readonly minPoints = MIN_POLYGON_POINTS) {}

    get points(): readonly Point[] {
        return this._points;
    }

    get isEmpty(): boolean {
        return this._points.length === 0;
    }

    get canClose(): boolean {
        return this._points.length >= this.minPoints;
    }

    add(p: Point): void {
        this._points.push({ ...p });
    }

    removeLast(): boolean {
        return this._points.pop() !== undefined;
    }

    /** True if `p` is within `tolerance` of the first point. */
    isNearStart(p: Point, tolerance: number): boolean {
        const first = this._points[0];
        return first !== undefined && distance(first, p) <= tolerance;
    }

    /**
     * Drops trailing points that sit on top of the previous one, which is
     * what a double-click leaves behind.
     */
    dropTrailingDuplicates(tolerance: number): void {
        while (this._points.length >= 2) {
            const last = this._points.at(-1);
            const prev = this._points.at(-2);
            if (!last || !prev || distance(last, prev) > tolerance) {
                break;
            }
            this._points.pop();
        }
    }

    /** Finishes the polygon. Returns its points, or null if too short. */
    close(): Point[] | null {
        if (!this.canClose) {
            return null;
        }
        const points = this._points;
        this._points = [];
        return points;
    }

    clear(): void {
        this._points = [];
    }
}

/** Adds a closed polygon to the current path of a 2D context. */
export function tracePolygon(
    ctx: Pick<CanvasPath, "moveTo" | "lineTo" | "closePath">,
    points: readonly Point[],
): void {
    points.forEach((p, i) =>
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
    );
    ctx.closePath();
}

/** Adds an open polyline to the current path of a 2D context. */
export function tracePolyline(
    ctx: Pick<CanvasPath, "moveTo" | "lineTo">,
    points: readonly Point[],
): void {
    points.forEach((p, i) =>
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
    );
}

/** Area covered by a polygon fill, including a pixel of anti-aliasing. */
export function polygonBounds(points: readonly Point[]): Rect | null {
    return boundsOf(points, 1);
}
