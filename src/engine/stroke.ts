import { distance, type Point } from "./geometry";

/**
 * Turns the sparse points delivered by pointer events into evenly spaced
 * brush stamps. A fast flick can move the pointer 100+ px between events;
 * without interpolation the stroke would turn into a row of dots.
 *
 * The distance left over after the last stamp is carried into the next
 * segment, so spacing stays even across event boundaries.
 */
export class StrokeSampler {
    private last: Point | null = null;
    private carry = 0;

    constructor(readonly spacing: number) {
        if (!(spacing > 0)) {
            throw new RangeError("spacing must be positive");
        }
    }

    /** Starts a stroke. The first point always gets a stamp. */
    start(p: Point): Point[] {
        this.last = { ...p };
        this.carry = 0;
        return [{ ...p }];
    }

    /** Returns the stamps needed to reach `p` from the previous point. */
    add(p: Point): Point[] {
        if (!this.last) {
            return this.start(p);
        }
        const from = this.last;
        const length = distance(from, p);
        const stamps: Point[] = [];
        // Position of the next stamp along this segment.
        let t = this.spacing - this.carry;
        while (t <= length) {
            const k = t / length;
            stamps.push({
                x: from.x + (p.x - from.x) * k,
                y: from.y + (p.y - from.y) * k,
            });
            t += this.spacing;
        }
        this.carry = length - (t - this.spacing);
        this.last = { ...p };
        return stamps;
    }
}
