import { MAX_ZOOM, MIN_ZOOM, Viewport } from "./viewport";

describe("Viewport", () => {
    let viewport: Viewport;

    beforeEach(() => {
        viewport = new Viewport();
        viewport.setFrameSize({ width: 800, height: 600 });
    });

    it("round-trips screen ↔ image coordinates", () => {
        viewport.zoomTo(2.5, { x: 100, y: 50 });
        viewport.panBy(-37, 12);
        for (const p of [
            { x: 0, y: 0 },
            { x: 123.4, y: 567.8 },
            { x: -50, y: 2000 },
        ]) {
            const back = viewport.imageToScreen(viewport.screenToImage(p));
            expect(back.x).toBeCloseTo(p.x, 9);
            expect(back.y).toBeCloseTo(p.y, 9);
        }
    });

    it("keeps the anchor point fixed while zooming", () => {
        const anchor = { x: 300, y: 200 };
        const before = viewport.screenToImage(anchor);
        viewport.zoomBy(3, anchor);
        const after = viewport.screenToImage(anchor);
        expect(after.x).toBeCloseTo(before.x, 9);
        expect(after.y).toBeCloseTo(before.y, 9);
    });

    it("clamps zoom to the allowed range", () => {
        viewport.zoomTo(1000);
        expect(viewport.scale).toBe(MAX_ZOOM);
        viewport.zoomTo(0.0001);
        expect(viewport.scale).toBe(MIN_ZOOM);
        viewport.zoomOut();
        expect(viewport.scale).toBe(MIN_ZOOM);
    });

    it("steps through zoom levels", () => {
        viewport.zoomTo(1);
        viewport.zoomIn();
        expect(viewport.scale).toBe(1.5);
        viewport.zoomOut();
        viewport.zoomOut();
        expect(viewport.scale).toBe(0.667);
    });

    it("fits and centres an image in the frame", () => {
        viewport.fit({ width: 4000, height: 3000 }, 0);
        expect(viewport.scale).toBeCloseTo(0.2, 9);
        const center = viewport.imageToScreen({ x: 2000, y: 1500 });
        expect(center.x).toBeCloseTo(400, 9);
        expect(center.y).toBeCloseTo(300, 9);
    });

    it("notifies listeners on change", () => {
        const listener = vi.fn();
        viewport.onChange(listener);
        viewport.panBy(10, 0);
        viewport.panBy(0, 0);
        expect(listener).toHaveBeenCalledTimes(1);
    });
});
