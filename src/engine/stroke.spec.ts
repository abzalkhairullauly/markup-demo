import { distance, type Point } from "./geometry";
import { StrokeSampler } from "./stroke";

function strokeThrough(points: Point[], spacing: number): Point[] {
    const sampler = new StrokeSampler(spacing);
    const [first, ...rest] = points;
    if (!first) {
        return [];
    }
    const stamps = sampler.start(first);
    for (const p of rest) {
        stamps.push(...sampler.add(p));
    }
    return stamps;
}

describe("StrokeSampler", () => {
    it("fills large gaps between pointer events", () => {
        // A fast flick: two events 300px apart.
        const stamps = strokeThrough(
            [
                { x: 0, y: 0 },
                { x: 300, y: 0 },
            ],
            5,
        );
        expect(stamps.length).toBe(61);
        for (let i = 1; i < stamps.length; i++) {
            const prev = stamps[i - 1];
            const cur = stamps[i];
            if (!prev || !cur) {
                throw new Error("missing stamp");
            }
            expect(distance(prev, cur)).toBeCloseTo(5, 9);
        }
    });

    it("keeps spacing even across many short segments", () => {
        // A curve delivered as tiny steps, each shorter than the spacing.
        const points: Point[] = [];
        for (let i = 0; i <= 200; i++) {
            const t = (i / 200) * Math.PI;
            points.push({ x: Math.cos(t) * 100, y: Math.sin(t) * 100 });
        }
        const spacing = 4;
        const stamps = strokeThrough(points, spacing);
        for (let i = 1; i < stamps.length; i++) {
            const prev = stamps[i - 1];
            const cur = stamps[i];
            if (!prev || !cur) {
                throw new Error("missing stamp");
            }
            // Chords on a curve are slightly shorter than the arc length.
            expect(distance(prev, cur)).toBeLessThanOrEqual(spacing + 1e-9);
        }
        // The stroke reaches the end of the path.
        const last = stamps.at(-1);
        const end = points.at(-1);
        if (!last || !end) {
            throw new Error("empty stroke");
        }
        expect(distance(last, end)).toBeLessThan(spacing);
    });

    it("produces continuous coverage for a round brush", () => {
        const radius = 3;
        const stamps = strokeThrough(
            [
                { x: 10, y: 10 },
                { x: 90, y: 10 },
                { x: 90, y: 60 },
            ],
            radius * 0.3,
        );
        // Every pixel centre on the path must be inside some stamp.
        const path: Point[] = [];
        for (let x = 10; x <= 90; x++) path.push({ x, y: 10 });
        for (let y = 10; y <= 60; y++) path.push({ x: 90, y });
        const uncovered = path.filter(
            (p) => !stamps.some((s) => distance(s, p) <= radius),
        );
        expect(uncovered).toEqual([]);
    });

    it("always stamps the starting point", () => {
        const sampler = new StrokeSampler(10);
        expect(sampler.start({ x: 4, y: 2 })).toEqual([{ x: 4, y: 2 }]);
        expect(sampler.add({ x: 5, y: 2 })).toEqual([]);
    });

    it("rejects non-positive spacing", () => {
        expect(() => new StrokeSampler(0)).toThrow(RangeError);
    });
});
