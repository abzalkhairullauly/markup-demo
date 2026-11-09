import { pixelRect } from "./geometry";
import { PolygonDraft, polygonBounds, tracePolygon } from "./polygon";

describe("PolygonDraft", () => {
    it("needs at least three points to close", () => {
        const draft = new PolygonDraft();
        draft.add({ x: 0, y: 0 });
        draft.add({ x: 10, y: 0 });
        expect(draft.canClose).toBe(false);
        expect(draft.close()).toBeNull();
        draft.add({ x: 10, y: 10 });
        expect(draft.close()).toEqual([
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
        ]);
        expect(draft.isEmpty).toBe(true);
    });

    it("removes the last point", () => {
        const draft = new PolygonDraft();
        draft.add({ x: 0, y: 0 });
        draft.add({ x: 5, y: 5 });
        expect(draft.removeLast()).toBe(true);
        expect(draft.points).toEqual([{ x: 0, y: 0 }]);
        draft.removeLast();
        expect(draft.removeLast()).toBe(false);
    });

    it("detects a click near the first point", () => {
        const draft = new PolygonDraft();
        draft.add({ x: 100, y: 100 });
        expect(draft.isNearStart({ x: 103, y: 104 }, 5)).toBe(true);
        expect(draft.isNearStart({ x: 110, y: 100 }, 5)).toBe(false);
    });

    it("drops the duplicate points a double-click leaves", () => {
        const draft = new PolygonDraft();
        draft.add({ x: 0, y: 0 });
        draft.add({ x: 50, y: 0 });
        draft.add({ x: 50, y: 50 });
        draft.add({ x: 50.5, y: 50.2 });
        draft.add({ x: 50.4, y: 50.1 });
        draft.dropTrailingDuplicates(2);
        expect(draft.points).toHaveLength(3);
    });
});

describe("polygon fill", () => {
    it("traces a closed path through every vertex", () => {
        const calls: string[] = [];
        tracePolygon(
            {
                moveTo: (x, y) => calls.push(`M${x},${y}`),
                lineTo: (x, y) => calls.push(`L${x},${y}`),
                closePath: () => calls.push("Z"),
            },
            [
                { x: 1, y: 2 },
                { x: 30, y: 2 },
                { x: 15, y: 20 },
            ],
        );
        expect(calls).toEqual(["M1,2", "L30,2", "L15,20", "Z"]);
    });

    it("limits the undo region to the polygon bounds inside the image", () => {
        const bounds = polygonBounds([
            { x: -20, y: 10.5 },
            { x: 40.2, y: 12 },
            { x: 30, y: 60.7 },
        ]);
        expect(bounds).not.toBeNull();
        const rect = bounds && pixelRect(bounds, { width: 100, height: 50 });
        expect(rect).toEqual({ x: 0, y: 9, width: 42, height: 41 });
    });
});
