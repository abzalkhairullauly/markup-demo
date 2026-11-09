import type { Size } from "./geometry";
import { MaskLayer, type LabelClass } from "./mask-layer";

export interface ClassInit {
    name: string;
    color: string;
    visible?: boolean;
}

let nextId = 0;
const newId = () => `class-${++nextId}`;

/**
 * The image being annotated and its label classes, one mask layer each.
 * Pure data: no rendering, no history.
 */
export class AnnotationDocument {
    private _layers: MaskLayer[] = [];
    private listeners = new Set<() => void>();

    constructor(
        readonly image: ImageBitmap,
        readonly name: string,
    ) {}

    get size(): Size {
        return { width: this.image.width, height: this.image.height };
    }

    get layers(): readonly MaskLayer[] {
        return this._layers;
    }

    onChange(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    layer(id: string | null): MaskLayer | undefined {
        return this._layers.find((layer) => layer.id === id);
    }

    addClass(init: ClassInit): MaskLayer {
        const layer = new MaskLayer(
            newId(),
            init.name,
            init.color,
            init.visible ?? true,
            this.size,
        );
        this._layers.push(layer);
        this.emit();
        return layer;
    }

    /** Detaches a layer and returns its old index, so it can be restored. */
    detach(id: string): { layer: MaskLayer; index: number } | null {
        const index = this._layers.findIndex((layer) => layer.id === id);
        const layer = this._layers[index];
        if (!layer) {
            return null;
        }
        this._layers.splice(index, 1);
        this.emit();
        return { layer, index };
    }

    attach(layer: MaskLayer, index: number): void {
        this._layers.splice(index, 0, layer);
        this.emit();
    }

    updateClass(id: string, patch: Partial<Omit<LabelClass, "id">>): void {
        const layer = this.layer(id);
        if (!layer) {
            return;
        }
        Object.assign(layer, patch);
        this.emit();
    }

    classes(): LabelClass[] {
        return this._layers.map(({ id, name, color, visible }) => ({
            id,
            name,
            color,
            visible,
        }));
    }

    dispose(): void {
        this.image.close();
        this.listeners.clear();
    }

    private emit(): void {
        for (const listener of this.listeners) {
            listener();
        }
    }
}
