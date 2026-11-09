import { hexToRgb, luminance, rangeAround, thresholdPixels } from "./threshold";
import { snapAngle } from "./tools/ruler.tool";
import { PolygonDraft } from "./polygon";

describe("luminance", () => {
    it("maps black, white and primaries to Rec. 709 brightness", () => {
        const rgba = new Uint8ClampedArray([
            0, 0, 0, 255, 255, 255, 255, 255, 255, 0, 0, 255, 0, 255, 0, 255,
        ]);
        expect([...luminance(rgba)]).toEqual([0, 255, 53, 182]);
    });
});

describe("thresholdPixels", () => {
    // 4×2 image with brightness values:
    //   10  20 200 210
    //   15 250  30 220
    const luma = new Uint8Array([10, 20, 200, 210, 15, 250, 30, 220]);
    const size = { width: 4, height: 2 };

    it("selects pixels inside the inclusive range", () => {
        const { pixels, count } = thresholdPixels(luma, size, 200, 220);
        expect(count).toBe(3);
        const alpha = [...pixels].filter((_, i) => i % 4 === 3);
        expect(alpha).toEqual([0, 0, 255, 255, 0, 0, 0, 255]);
    });

    it("returns the bounding box of the matches", () => {
        expect(thresholdPixels(luma, size, 200, 220).bounds).toEqual({
            x: 2,
            y: 0,
            width: 2,
            height: 2,
        });
        expect(thresholdPixels(luma, size, 240, 255).bounds).toEqual({
            x: 1,
            y: 1,
            width: 1,
            height: 1,
        });
    });

    it("returns no bounds when nothing matches", () => {
        const result = thresholdPixels(luma, size, 100, 150);
        expect(result.count).toBe(0);
        expect(result.bounds).toBeNull();
    });

    it("writes the requested colour", () => {
        const { pixels } = thresholdPixels(luma, size, 0, 10, [1, 2, 3, 4]);
        expect([...pixels.slice(0, 4)]).toEqual([1, 2, 3, 4]);
    });
});

describe("rangeAround", () => {
    it("clips to 0–255", () => {
        expect(rangeAround(10, 24)).toEqual({ min: 0, max: 34 });
        expect(rangeAround(250, 24)).toEqual({ min: 226, max: 255 });
    });
});

describe("hexToRgb", () => {
    it("parses #rrggbb and falls back to white", () => {
        expect(hexToRgb("#f97316")).toEqual([249, 115, 22]);
        expect(hexToRgb("red")).toEqual([255, 255, 255]);
    });
});

describe("snapAngle", () => {
    it("snaps to the nearest 45° and keeps the length", () => {
        const p = snapAngle({ x: 0, y: 0 }, { x: 10, y: 1 });
        expect(p.x).toBeCloseTo(Math.hypot(10, 1), 9);
        expect(p.y).toBeCloseTo(0, 9);
        const d = snapAngle({ x: 0, y: 0 }, { x: 10, y: 9 });
        expect(d.x).toBeCloseTo(d.y, 9);
    });
});

describe("PolygonDraft as a polyline", () => {
    it("can finish with two points", () => {
        const draft = new PolygonDraft(2);
        draft.add({ x: 0, y: 0 });
        expect(draft.canClose).toBe(false);
        draft.add({ x: 5, y: 5 });
        expect(draft.close()).toHaveLength(2);
    });
});
