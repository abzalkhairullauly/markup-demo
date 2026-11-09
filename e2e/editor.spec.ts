import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function openEditor(page: Page) {
    await page.goto("/");
    await expect(page.getByText("sample.jpg · 2400×1600")).toBeVisible();
    return page.getByTestId("stage");
}

/** Counts non-transparent pixels in a base64 PNG, decoded by the browser. */
function countPaintedPixels(page: Page, base64: string): Promise<number> {
    return page.evaluate(async (data) => {
        const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
        const bitmap = await createImageBitmap(
            new Blob([bytes], { type: "image/png" }),
        );
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no 2d context");
        ctx.drawImage(bitmap, 0, 0);
        const pixels = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
        let painted = 0;
        for (let i = 3; i < pixels.length; i += 4) {
            if (pixels[i]! > 0) painted++;
        }
        return painted;
    }, base64);
}

async function exportJson(page: Page) {
    await page.getByRole("button", { name: "Export" }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: /JSON/ }).click();
    const download = await downloadPromise;
    return JSON.parse(await readFile(await download.path(), "utf8"));
}

async function stageBox(page: Page) {
    const box = await page.getByTestId("stage").boundingBox();
    if (!box) throw new Error("stage not visible");
    return box;
}

test("brush stroke survives undo/redo and ends up in the JSON export", async ({
    page,
}) => {
    const stage = await openEditor(page);
    const box = await stage.boundingBox();
    if (!box) throw new Error("stage not visible");

    const undo = page.getByRole("button", { name: "Undo" });
    const redo = page.getByRole("button", { name: "Redo" });
    await expect(undo).toBeDisabled();

    await page.keyboard.press("b");
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.3, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, y + 40, { steps: 12 });
    await page.mouse.up();

    await expect(undo).toBeEnabled();
    await undo.click();
    await expect(undo).toBeDisabled();
    await expect(redo).toBeEnabled();
    await page.keyboard.press("ControlOrMeta+Shift+Z");
    await expect(redo).toBeDisabled();

    await page.getByRole("button", { name: "Export" }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: /JSON/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("sample.json");

    const json = JSON.parse(await readFile(await download.path(), "utf8"));
    expect(json.image).toEqual({ w: 2400, h: 1600 });
    expect(json.classes.map((c: { name: string }) => c.name)).toEqual([
        "Building",
        "Road",
        "Vegetation",
    ]);
    expect(await countPaintedPixels(page, json.masks.Building)).toBeGreaterThan(
        1000,
    );
    expect(await countPaintedPixels(page, json.masks.Road)).toBe(0);
});

test("polygon closes with Enter and can be undone", async ({ page }) => {
    const stage = await openEditor(page);
    const box = await stage.boundingBox();
    if (!box) throw new Error("stage not visible");

    await page.keyboard.press("p");
    await expect(page.getByRole("button", { name: "Polygon" })).toHaveAttribute(
        "aria-pressed",
        "true",
    );
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.click(cx - 80, cy - 60);
    await page.mouse.click(cx + 80, cy - 60);
    await page.mouse.click(cx, cy + 70);
    await page.keyboard.press("Enter");

    const undo = page.getByRole("button", { name: "Undo" });
    await expect(undo).toBeEnabled();
    await page.keyboard.press("ControlOrMeta+Z");
    await expect(undo).toBeDisabled();
});

test("shortcuts dialog opens with ? and closes with Escape", async ({
    page,
}) => {
    await openEditor(page);
    await page.keyboard.press("Shift+Slash");
    const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
});

test("polyline paints a line with Enter", async ({ page }) => {
    await openEditor(page);
    const box = await stageBox(page);
    await page.keyboard.press("o");
    await page.mouse.click(box.x + 200, box.y + 200);
    await page.mouse.click(box.x + 400, box.y + 260);
    await page.mouse.click(box.x + 500, box.y + 180);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
    const json = await exportJson(page);
    expect(await countPaintedPixels(page, json.masks.Building)).toBeGreaterThan(
        500,
    );
});

test("scissors keep only the mask inside the lasso", async ({ page }) => {
    await openEditor(page);
    const box = await stageBox(page);
    const y = box.y + box.height / 2;

    await page.keyboard.press("b");
    await page.mouse.move(box.x + 150, y);
    await page.mouse.down();
    await page.mouse.move(box.x + 650, y, { steps: 20 });
    await page.mouse.up();
    const before = await countPaintedPixels(
        page,
        (await exportJson(page)).masks.Building,
    );

    // Lasso around the left half of the stroke only.
    await page.keyboard.press("s");
    await page.mouse.move(box.x + 120, y - 60);
    await page.mouse.down();
    await page.mouse.move(box.x + 400, y - 60, { steps: 8 });
    await page.mouse.move(box.x + 400, y + 60, { steps: 8 });
    await page.mouse.move(box.x + 120, y + 60, { steps: 8 });
    await page.mouse.up();

    const after = await countPaintedPixels(
        page,
        (await exportJson(page)).masks.Building,
    );
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(before * 0.7);
});

test("threshold adds pixels in the brightness range", async ({ page }) => {
    await openEditor(page);
    await page.keyboard.press("t");
    const apply = page.getByRole("button", { name: "Add to Building" });
    await expect(apply).toBeVisible();
    await apply.click();
    await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
    const json = await exportJson(page);
    expect(await countPaintedPixels(page, json.masks.Building)).toBeGreaterThan(
        1000,
    );
});
