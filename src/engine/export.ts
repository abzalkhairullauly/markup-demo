import type { AnnotationDocument } from "./document";
import type { MaskLayer } from "./mask-layer";
import { context2d, createSurface, surfaceToBlob } from "./surface";

export interface AnnotationJson {
    image: { w: number; h: number };
    classes: { name: string; color: string }[];
    /** Class name → base64-encoded PNG mask (white on transparent). */
    masks: Record<string, string>;
}

/** The mask of one class as a white-on-transparent PNG. */
export function exportClassMask(layer: MaskLayer): Promise<Blob> {
    return surfaceToBlob(layer.surface);
}

/** All classes in their colours on a transparent background. */
export function exportColorMask(doc: AnnotationDocument): Promise<Blob> {
    const out = createSurface(doc.size);
    const g = context2d(out);
    const tint = createSurface(doc.size);
    const t = context2d(tint);
    for (const layer of doc.layers) {
        t.globalCompositeOperation = "source-over";
        t.clearRect(0, 0, doc.size.width, doc.size.height);
        t.drawImage(layer.surface, 0, 0);
        t.globalCompositeOperation = "source-in";
        t.fillStyle = layer.color;
        t.fillRect(0, 0, doc.size.width, doc.size.height);
        g.drawImage(tint, 0, 0);
    }
    return surfaceToBlob(out);
}

export async function exportJson(
    doc: AnnotationDocument,
): Promise<AnnotationJson> {
    const names = uniqueNames(doc.layers.map((layer) => layer.name));
    const masks: Record<string, string> = {};
    await Promise.all(
        doc.layers.map(async (layer, i) => {
            const blob = await exportClassMask(layer);
            masks[names[i] ?? layer.id] = await blobToBase64(blob);
        }),
    );
    return {
        image: { w: doc.size.width, h: doc.size.height },
        classes: doc.layers.map((layer, i) => ({
            name: names[i] ?? layer.name,
            color: layer.color,
        })),
        masks,
    };
}

/** Makes names usable as object keys: "Road", "Road" → "Road", "Road (2)". */
export function uniqueNames(names: readonly string[]): string[] {
    const seen = new Map<string, number>();
    return names.map((raw) => {
        const name = raw.trim() || "Untitled";
        const count = (seen.get(name) ?? 0) + 1;
        seen.set(name, count);
        return count === 1 ? name : `${name} (${count})`;
    });
}

async function blobToBase64(blob: Blob): Promise<string> {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
}
