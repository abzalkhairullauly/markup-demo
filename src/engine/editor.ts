import { PixelEditCommand, RemoveClassCommand } from "./commands";
import { AnnotationDocument, type ClassInit } from "./document";
import { clamp, type Point } from "./geometry";
import { History, type Command } from "./history";
import type { LabelClass } from "./mask-layer";
import { Renderer, type StageCanvases } from "./renderer";
import { context2d, createSurface } from "./surface";
import { luminance } from "./threshold";
import { PanTool } from "./tools/pan.tool";
import type {
    EditorSettings,
    RenderLayer,
    Tool,
    ToolContext,
    ToolKey,
    ToolPointer,
    ThresholdRange,
} from "./tools/tool";
import { Viewport } from "./viewport";

export const MIN_BRUSH_SIZE = 1;
export const MAX_BRUSH_SIZE = 200;

export interface EditorState {
    image: { name: string; width: number; height: number } | null;
    zoom: number;
    tool: string | null;
    toolBusy: boolean;
    classes: LabelClass[];
    activeClassId: string | null;
    brushSize: number;
    eraseAllClasses: boolean;
    threshold: ThresholdRange;
    maskOpacity: number;
    canUndo: boolean;
    /** Increments on every edit, undo and redo; used to detect unsaved work. */
    revision: number;
    canRedo: boolean;
    /** Image pixel under the pointer, if the pointer is over the image. */
    pointer: Point | null;
}

/**
 * Public face of the engine. Wires pointer input, the viewport, history and
 * the active tool together, and reports state changes to one listener set.
 * It only touches the three canvases it is given.
 */
export class Editor {
    readonly viewport = new Viewport();
    readonly history = new History({ limit: 50 });

    private readonly renderer: Renderer;
    private readonly tools = new Map<string, Tool>();
    private readonly panTool = new PanTool();
    private readonly listeners = new Set<(state: EditorState) => void>();
    private readonly cleanup: (() => void)[] = [];

    private _doc: AnnotationDocument | null = null;
    private activeTool: Tool | null = null;
    /** Tool handling the current drag; may differ from activeTool. */
    private gestureTool: Tool | null = null;
    private gesturePointer: number | null = null;
    private activeClassId: string | null = null;
    private hover: Point | null = null;
    private spacePressed = false;
    private hasUserViewport = false;
    private maskOpacity = 0.55;
    private settings: EditorSettings = {
        brushSize: 24,
        eraseAllClasses: false,
        threshold: { min: 0, max: 60 },
    };
    private revision = 0;
    private luma: { doc: AnnotationDocument; data: Uint8Array } | null = null;
    private emitQueued = false;

    constructor(private readonly canvases: StageCanvases) {
        this.renderer = new Renderer(canvases, this.viewport, {
            doc: () => this._doc,
            maskOpacity: () => this.maskOpacity,
            drawOverlay: (g) => this.drawOverlay(g),
        });

        this.cleanup.push(
            this.viewport.onChange(() => {
                this.renderer.invalidate("image", "masks", "overlay");
                this.queueEmit();
            }),
            this.history.onChange(() => {
                this.revision++;
                this.queueEmit();
            }),
        );
        this.bindInput();
        this.observeSize();
        this.registerTool(this.panTool);
    }

    get doc(): AnnotationDocument | null {
        return this._doc;
    }

    // ---- State -----------------------------------------------------------

    subscribe(listener: (state: EditorState) => void): () => void {
        this.listeners.add(listener);
        listener(this.snapshot());
        return () => this.listeners.delete(listener);
    }

    snapshot(): EditorState {
        const doc = this._doc;
        return {
            image: doc && { name: doc.name, ...doc.size },
            zoom: this.viewport.scale,
            tool: this.activeTool?.id ?? null,
            toolBusy: this.activeTool?.isBusy?.() ?? false,
            classes: doc?.classes() ?? [],
            activeClassId: this.activeClassId,
            brushSize: this.settings.brushSize,
            eraseAllClasses: this.settings.eraseAllClasses,
            threshold: this.settings.threshold,
            maskOpacity: this.maskOpacity,
            canUndo: this.history.canUndo,
            canRedo: this.history.canRedo,
            revision: this.revision,
            pointer: this.pointerOverImage(),
        };
    }

    // ---- Document --------------------------------------------------------

    loadImage(image: ImageBitmap, name: string, classes: ClassInit[]): void {
        this.cancelTool();
        this._doc?.dispose();
        const doc = new AnnotationDocument(image, name);
        for (const init of classes) {
            doc.addClass(init);
        }
        doc.onChange(() => {
            this.renderer.invalidate("masks", "overlay");
            this.queueEmit();
        });
        this._doc = doc;
        this.activeClassId = doc.layers[0]?.id ?? null;
        this.history.clear();
        this.hasUserViewport = false;
        this.viewport.fit(doc.size);
        this.renderer.invalidate("image", "masks", "overlay");
        this.queueEmit();
    }

    addClass(init: ClassInit): string | null {
        const layer = this._doc?.addClass(init);
        if (layer) {
            this.setActiveClass(layer.id);
        }
        return layer?.id ?? null;
    }

    updateClass(id: string, patch: Partial<Omit<LabelClass, "id">>): void {
        this._doc?.updateClass(id, patch);
    }

    removeClass(id: string): void {
        const doc = this._doc;
        const removed = doc?.detach(id);
        if (!doc || !removed) {
            return;
        }
        if (this.activeClassId === id) {
            const next =
                doc.layers[Math.min(removed.index, doc.layers.length - 1)];
            this.activeClassId = next?.id ?? null;
        }
        this.history.push(
            new RemoveClassCommand(doc, removed.layer, removed.index, () => {
                if (!doc.layer(this.activeClassId)) {
                    this.activeClassId = doc.layers[0]?.id ?? null;
                }
                this.queueEmit();
            }),
        );
    }

    setActiveClass(id: string): void {
        if (!this._doc?.layer(id)) {
            return;
        }
        this.activeClassId = id;
        this.renderer.invalidate("overlay");
        this.queueEmit();
    }

    /** Clears every mask. Undoable. */
    clearAll(): void {
        const doc = this._doc;
        if (!doc) {
            return;
        }
        this.cancelTool();
        for (const layer of doc.layers) {
            layer.ctx.clearRect(0, 0, doc.size.width, doc.size.height);
        }
        const command = PixelEditCommand.capture(
            "Clear all",
            doc.layers.map((layer) => ({ layer, rect: layer.fullRect() })),
            () => this.renderer.invalidate("masks"),
            { cleared: true },
        );
        if (command) {
            this.history.push(command);
        }
        this.renderer.invalidate("masks");
    }

    // ---- Tools -----------------------------------------------------------

    registerTool(tool: Tool): void {
        this.tools.set(tool.id, tool);
    }

    setTool(id: string | null): void {
        const next = id === null ? null : (this.tools.get(id) ?? null);
        if (next === this.activeTool) {
            return;
        }
        this.cancelTool();
        this.activeTool = next;
        this.updateCursor();
        this.renderer.invalidate("overlay");
        this.queueEmit();
    }

    /** Cancels in-progress work of the active tool. True if there was any. */
    cancelTool(): boolean {
        if (!this._doc) {
            return false;
        }
        const ctx = this.toolContext(this._doc);
        const cancelled =
            (this.gestureTool?.cancel?.(ctx) ?? false) ||
            (this.activeTool?.cancel?.(ctx) ?? false);
        this.gestureTool = null;
        this.gesturePointer = null;
        this.queueEmit();
        return cancelled;
    }

    /**
     * Forwards a key to the active tool. Enter finishes pending work. True
     * if the tool used the key.
     */
    handleKey(key: ToolKey): boolean {
        if (!this._doc || !this.activeTool) {
            return false;
        }
        if (key.key === "Enter") {
            return this.commitTool();
        }
        const handled =
            this.activeTool.onKey?.(key, this.toolContext(this._doc)) ?? false;
        if (handled) {
            this.queueEmit();
        }
        return handled;
    }

    /** Finishes the active tool's pending work, as Enter or "Apply" does. */
    commitTool(): boolean {
        if (!this._doc || !this.activeTool?.commit) {
            return false;
        }
        const done = this.activeTool.commit(this.toolContext(this._doc));
        this.queueEmit();
        return done;
    }

    /** While true, dragging pans regardless of the active tool. */
    setSpacePressed(pressed: boolean): void {
        this.spacePressed = pressed;
        this.updateCursor();
    }

    // ---- Settings --------------------------------------------------------

    setBrushSize(size: number): void {
        this.settings = {
            ...this.settings,
            brushSize: clamp(Math.round(size), MIN_BRUSH_SIZE, MAX_BRUSH_SIZE),
        };
        this.updateCursor();
        this.renderer.invalidate("overlay");
        this.queueEmit();
    }

    setEraseAllClasses(value: boolean): void {
        this.settings = { ...this.settings, eraseAllClasses: value };
        this.queueEmit();
    }

    setThresholdRange(range: ThresholdRange): void {
        const min = clamp(Math.round(range.min), 0, 255);
        const max = clamp(Math.round(range.max), min, 255);
        this.updateSettings({ threshold: { min, max } });
    }

    setMaskOpacity(value: number): void {
        this.maskOpacity = clamp(value, 0, 1);
        this.renderer.invalidate("masks");
        this.queueEmit();
    }

    // ---- Viewport --------------------------------------------------------

    fit(): void {
        if (this._doc) {
            this.hasUserViewport = false;
            this.viewport.fit(this._doc.size);
        }
    }

    actualSize(): void {
        if (this._doc) {
            this.hasUserViewport = true;
            this.viewport.center(this._doc.size, 1);
        }
    }

    zoomIn(): void {
        this.hasUserViewport = true;
        this.viewport.zoomIn();
    }

    zoomOut(): void {
        this.hasUserViewport = true;
        this.viewport.zoomOut();
    }

    // ---- History ---------------------------------------------------------

    undo(): void {
        this.cancelTool();
        this.history.undo();
    }

    redo(): void {
        this.cancelTool();
        this.history.redo();
    }

    destroy(): void {
        this.cleanup.forEach((fn) => fn());
        this.renderer.destroy();
        this._doc?.dispose();
        this._doc = null;
        this.listeners.clear();
    }

    // ---- Internals -------------------------------------------------------

    private toolContext(doc: AnnotationDocument): ToolContext {
        return {
            viewport: this.viewport,
            doc,
            settings: this.settings,
            activeLayer: doc.layer(this.activeClassId),
            hover: this.hover,
            pushHistory: (command: Command) => this.history.push(command),
            invalidate: (...layers: RenderLayer[]) =>
                this.renderer.invalidate(...layers),
            updateSettings: (patch) => this.updateSettings(patch),
            imageLuma: () => this.imageLuma(doc),
        };
    }

    private updateSettings(patch: Partial<EditorSettings>): void {
        this.settings = { ...this.settings, ...patch };
        this.updateCursor();
        this.renderer.invalidate("overlay");
        this.queueEmit();
    }

    /** Reads the image pixels back once per document and caches the luma. */
    private imageLuma(doc: AnnotationDocument): Uint8Array {
        if (this.luma?.doc !== doc) {
            const { width, height } = doc.size;
            const surface = createSurface(doc.size);
            const g = context2d(surface, { willReadFrequently: true });
            g.drawImage(doc.image, 0, 0);
            const rgba = g.getImageData(0, 0, width, height).data;
            this.luma = { doc, data: luminance(rgba) };
        }
        return this.luma.data;
    }

    private drawOverlay(g: CanvasRenderingContext2D): void {
        const tool = this.gestureTool ?? this.activeTool;
        if (this._doc && tool?.renderOverlay && !this.isPanGesture()) {
            tool.renderOverlay(g, this.toolContext(this._doc));
        }
    }

    private isPanGesture(): boolean {
        return this.gestureTool === this.panTool || this.spacePressed;
    }

    private updateCursor(): void {
        let cursor = "default";
        if (this.gestureTool === this.panTool) {
            cursor = "grabbing";
        } else if (this.spacePressed || !this.activeTool) {
            cursor = "grab";
        } else if (this._doc) {
            cursor = this.activeTool.cursor(this.toolContext(this._doc));
        }
        this.canvases.overlay.style.cursor = cursor;
    }

    private pointerOverImage(): Point | null {
        const doc = this._doc;
        if (!doc || !this.hover) {
            return null;
        }
        const p = this.viewport.screenToImage(this.hover);
        if (
            p.x < 0 ||
            p.y < 0 ||
            p.x >= doc.size.width ||
            p.y >= doc.size.height
        ) {
            return null;
        }
        return { x: Math.floor(p.x), y: Math.floor(p.y) };
    }

    private queueEmit(): void {
        if (this.emitQueued) {
            return;
        }
        this.emitQueued = true;
        queueMicrotask(() => {
            this.emitQueued = false;
            const state = this.snapshot();
            for (const listener of this.listeners) {
                listener(state);
            }
        });
    }

    private toToolPointer(e: PointerEvent | MouseEvent): ToolPointer {
        const rect = this.canvases.overlay.getBoundingClientRect();
        const toScreen = (ev: MouseEvent): Point => ({
            x: ev.clientX - rect.left,
            y: ev.clientY - rect.top,
        });
        const screen = toScreen(e);
        const events =
            "getCoalescedEvents" in e &&
            typeof e.getCoalescedEvents === "function"
                ? e.getCoalescedEvents()
                : [];
        const samples = (events.length > 0 ? events : [e]).map((ev) =>
            this.viewport.screenToImage(toScreen(ev)),
        );
        return {
            screen,
            image: this.viewport.screenToImage(screen),
            samples,
            button: e.button,
            pointerType: "pointerType" in e ? e.pointerType : "mouse",
            shiftKey: e.shiftKey,
            altKey: e.altKey,
        };
    }

    private bindInput(): void {
        const el = this.canvases.overlay;
        const on = <K extends keyof HTMLElementEventMap>(
            type: K,
            handler: (e: HTMLElementEventMap[K]) => void,
            options?: AddEventListenerOptions,
        ) => {
            el.addEventListener(type, handler, options);
            this.cleanup.push(() => el.removeEventListener(type, handler));
        };

        on("pointerdown", (e) => {
            const doc = this._doc;
            if (!doc || this.gesturePointer !== null) {
                return;
            }
            const wantsPan =
                e.button === 1 ||
                (e.button === 0 && (this.spacePressed || !this.activeTool));
            const tool = wantsPan ? this.panTool : this.activeTool;
            if (!tool) {
                return;
            }
            e.preventDefault();
            el.setPointerCapture(e.pointerId);
            this.gestureTool = tool;
            this.gesturePointer = e.pointerId;
            const pointer = this.toToolPointer(e);
            // The pan tool listens to any button; others decide themselves.
            tool.onPointerDown?.(
                wantsPan ? { ...pointer, button: 0 } : pointer,
                this.toolContext(doc),
            );
            if (wantsPan) {
                this.hasUserViewport = true;
            }
            this.updateCursor();
            this.queueEmit();
        });

        on("pointermove", (e) => {
            this.hover = this.toToolPointer(e).screen;
            const doc = this._doc;
            if (
                doc &&
                this.gestureTool &&
                e.pointerId === this.gesturePointer
            ) {
                this.gestureTool.onPointerMove?.(
                    this.toToolPointer(e),
                    this.toolContext(doc),
                );
            }
            this.renderer.invalidate("overlay");
            this.queueEmit();
        });

        const endGesture = (e: PointerEvent, cancelled: boolean) => {
            const doc = this._doc;
            const tool = this.gestureTool;
            if (!doc || !tool || e.pointerId !== this.gesturePointer) {
                return;
            }
            const ctx = this.toolContext(doc);
            if (cancelled) {
                tool.cancel?.(ctx);
            } else {
                tool.onPointerUp?.(this.toToolPointer(e), ctx);
            }
            this.gestureTool = null;
            this.gesturePointer = null;
            if (el.hasPointerCapture(e.pointerId)) {
                el.releasePointerCapture(e.pointerId);
            }
            this.updateCursor();
            this.renderer.invalidate("overlay");
            this.queueEmit();
        };
        on("pointerup", (e) => endGesture(e, false));
        on("pointercancel", (e) => endGesture(e, true));

        on("pointerleave", () => {
            if (this.gestureTool) {
                return;
            }
            this.hover = null;
            this.renderer.invalidate("overlay");
            this.queueEmit();
        });

        on("dblclick", (e) => {
            const doc = this._doc;
            if (doc && this.activeTool?.onDoubleClick && !this.spacePressed) {
                this.activeTool.onDoubleClick(
                    this.toToolPointer(e),
                    this.toolContext(doc),
                );
                this.queueEmit();
            }
        });

        // Ctrl/Cmd + wheel (and trackpad pinch, which reports as ctrl+wheel)
        // zooms around the cursor; Shift + wheel changes mask opacity; a
        // plain wheel or two-finger scroll pans.
        on(
            "wheel",
            (e) => {
                if (!this._doc) {
                    return;
                }
                e.preventDefault();
                this.hasUserViewport = true;
                const lineHeight =
                    e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1;
                const dx = e.deltaX * lineHeight;
                const dy = e.deltaY * lineHeight;
                // A mouse wheel notch is ~100px; a pinch step is a few px.
                const zoomDelta = clamp(dy, -50, 50);
                if (e.ctrlKey || e.metaKey) {
                    const rect = el.getBoundingClientRect();
                    const anchor = {
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                    };
                    this.viewport.zoomBy(Math.exp(-zoomDelta * 0.01), anchor);
                } else if (e.shiftKey) {
                    // Shift + wheel changes mask opacity. Browsers turn a
                    // shifted wheel into horizontal scroll, so read both axes.
                    const delta = clamp(dy || dx, -50, 50);
                    this.setMaskOpacity(this.maskOpacity - delta * 0.002);
                } else {
                    this.viewport.panBy(-dx, -dy);
                }
            },
            { passive: false },
        );

        on("contextmenu", (e) => e.preventDefault());
    }

    private observeSize(): void {
        const el = this.canvases.overlay;
        const apply = (
            cssW: number,
            cssH: number,
            devW: number,
            devH: number,
        ) => {
            const dpr = cssW > 0 ? devW / cssW : window.devicePixelRatio || 1;
            this.renderer.resize(devW, devH, dpr);
            this.viewport.setFrameSize({ width: cssW, height: cssH });
            if (this._doc && !this.hasUserViewport) {
                this.viewport.fit(this._doc.size);
            }
        };
        const observer = new ResizeObserver(([entry]) => {
            if (!entry) {
                return;
            }
            const { width, height } = entry.contentRect;
            const device = entry.devicePixelContentBoxSize?.[0];
            const dpr = window.devicePixelRatio || 1;
            apply(
                width,
                height,
                device?.inlineSize ?? Math.round(width * dpr),
                device?.blockSize ?? Math.round(height * dpr),
            );
        });
        try {
            observer.observe(el, { box: "device-pixel-content-box" });
        } catch {
            // Safari does not support device-pixel-content-box.
            observer.observe(el);
        }
        this.cleanup.push(() => observer.disconnect());
    }
}
