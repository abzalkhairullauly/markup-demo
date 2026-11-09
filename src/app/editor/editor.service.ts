import {
    computed,
    DestroyRef,
    inject,
    Injectable,
    signal,
} from "@angular/core";
import {
    BrushTool,
    decodeImage,
    Editor,
    EraserTool,
    exportClassMask,
    exportColorMask,
    exportJson,
    ImageLoadError,
    PolygonTool,
    PolylineTool,
    RulerTool,
    ScissorsTool,
    ThresholdTool,
    type ClassInit,
    type EditorState,
    type StageCanvases,
    type ThresholdRange,
    type ToolKey,
} from "../../engine";
import { saveBlob } from "./download";

export type ToolId =
    | "pan"
    | "brush"
    | "eraser"
    | "polygon"
    | "polyline"
    | "scissors"
    | "ruler"
    | "threshold";

const DEFAULT_CLASSES: ClassInit[] = [
    { name: "Building", color: "#f97316" },
    { name: "Road", color: "#38bdf8" },
    { name: "Vegetation", color: "#4ade80" },
];

const CLASS_COLORS = [
    "#f97316",
    "#38bdf8",
    "#4ade80",
    "#e879f9",
    "#facc15",
    "#f87171",
    "#a78bfa",
    "#2dd4bf",
];

const SAMPLE_IMAGE = "sample.jpg";

const EMPTY_STATE: EditorState = {
    image: null,
    zoom: 1,
    tool: null,
    toolBusy: false,
    classes: [],
    activeClassId: null,
    brushSize: 24,
    eraseAllClasses: false,
    threshold: { min: 0, max: 60 },
    maskOpacity: 0.55,
    canUndo: false,
    canRedo: false,
    revision: 0,
    pointer: null,
};

/**
 * Angular-facing wrapper around the engine. The engine owns all state; this
 * service mirrors it into signals and turns UI intents into engine calls.
 */
@Injectable()
export class EditorService {
    private editor: Editor | null = null;
    private readonly state = signal<EditorState>(EMPTY_STATE);

    readonly image = computed(() => this.state().image);
    readonly zoom = computed(() => this.state().zoom);
    readonly activeTool = computed(() => this.state().tool as ToolId | null);
    readonly toolBusy = computed(() => this.state().toolBusy);
    readonly classes = computed(() => this.state().classes);
    readonly activeClassId = computed(() => this.state().activeClassId);
    readonly activeClass = computed(() =>
        this.classes().find((c) => c.id === this.activeClassId()),
    );
    readonly brushSize = computed(() => this.state().brushSize);
    readonly eraseAllClasses = computed(() => this.state().eraseAllClasses);
    readonly maskOpacity = computed(() => this.state().maskOpacity);
    readonly canUndo = computed(() => this.state().canUndo);
    readonly canRedo = computed(() => this.state().canRedo);
    readonly threshold = computed(() => this.state().threshold);
    readonly pointer = computed(() => this.state().pointer);
    /** Edits made since the image was opened or last exported. */
    readonly hasUnsavedChanges = computed(
        () => this.state().revision !== this.savedRevision(),
    );
    private readonly savedRevision = signal(0);
    readonly hasImage = computed(() => this.image() !== null);

    readonly loading = signal(false);
    readonly error = signal<string | null>(null);

    constructor() {
        inject(DestroyRef).onDestroy(() => this.detach());
    }

    attach(canvases: StageCanvases): void {
        this.detach();
        const editor = new Editor(canvases);
        editor.registerTool(new BrushTool());
        editor.registerTool(new EraserTool());
        editor.registerTool(new PolygonTool());
        editor.registerTool(new PolylineTool());
        editor.registerTool(new ScissorsTool());
        editor.registerTool(new RulerTool());
        editor.registerTool(new ThresholdTool());
        editor.subscribe((state) => this.state.set(state));
        editor.setTool("brush");
        this.editor = editor;
        void this.loadSample();
    }

    detach(): void {
        this.editor?.destroy();
        this.editor = null;
        this.state.set(EMPTY_STATE);
    }

    // ---- Image -----------------------------------------------------------

    async openFile(file: Blob, name = "image"): Promise<void> {
        const editor = this.editor;
        if (!editor) {
            return;
        }
        this.loading.set(true);
        this.error.set(null);
        try {
            const bitmap = await decodeImage(file);
            const classes = this.classes().length
                ? this.classes().map(({ name, color }) => ({ name, color }))
                : DEFAULT_CLASSES;
            editor.loadImage(bitmap, name, classes);
            this.markSaved();
        } catch (err) {
            this.error.set(
                err instanceof ImageLoadError
                    ? err.message
                    : "Something went wrong while opening the image.",
            );
        } finally {
            this.loading.set(false);
        }
    }

    async loadSample(): Promise<void> {
        this.loading.set(true);
        try {
            const response = await fetch(
                new URL(SAMPLE_IMAGE, document.baseURI),
            );
            if (!response.ok) {
                throw new Error(String(response.status));
            }
            await this.openFile(await response.blob(), SAMPLE_IMAGE);
        } catch {
            this.error.set("The sample image could not be loaded.");
            this.loading.set(false);
        }
    }

    dismissError(): void {
        this.error.set(null);
    }

    // ---- Tools -----------------------------------------------------------

    selectTool(tool: ToolId | null): void {
        this.editor?.setTool(tool);
    }

    /** Escape: cancel the current shape first, then drop the tool. */
    escape(): void {
        if (this.editor && !this.editor.cancelTool()) {
            this.editor.setTool(null);
        }
    }

    handleToolKey(key: ToolKey): boolean {
        return this.editor?.handleKey(key) ?? false;
    }

    setSpacePressed(pressed: boolean): void {
        this.editor?.setSpacePressed(pressed);
    }

    setBrushSize(size: number): void {
        this.editor?.setBrushSize(size);
    }

    stepBrushSize(direction: 1 | -1): void {
        const size = this.brushSize();
        const step = size < 10 ? 1 : size < 50 ? 5 : 10;
        this.setBrushSize(size + step * direction);
    }

    setThreshold(range: ThresholdRange): void {
        this.editor?.setThresholdRange(range);
    }

    /** Finishes the active tool's pending work (the "Apply" button). */
    applyTool(): void {
        this.editor?.commitTool();
    }

    setEraseAllClasses(value: boolean): void {
        this.editor?.setEraseAllClasses(value);
    }

    // ---- Classes ---------------------------------------------------------

    selectClass(id: string): void {
        this.editor?.setActiveClass(id);
        if (!this.activeTool() || this.activeTool() === "pan") {
            this.selectTool("brush");
        }
    }

    addClass(): void {
        const used = new Set(this.classes().map((c) => c.color));
        const color =
            CLASS_COLORS.find((c) => !used.has(c)) ??
            CLASS_COLORS[this.classes().length % CLASS_COLORS.length] ??
            "#ffffff";
        this.editor?.addClass({
            name: `Class ${this.classes().length + 1}`,
            color,
        });
    }

    renameClass(id: string, name: string): void {
        this.editor?.updateClass(id, { name });
    }

    recolorClass(id: string, color: string): void {
        this.editor?.updateClass(id, { color });
    }

    toggleClassVisibility(id: string): void {
        const cls = this.classes().find((c) => c.id === id);
        if (cls) {
            this.editor?.updateClass(id, { visible: !cls.visible });
        }
    }

    removeClass(id: string): void {
        this.editor?.removeClass(id);
    }

    setMaskOpacity(value: number): void {
        this.editor?.setMaskOpacity(value);
    }

    // ---- Edit ------------------------------------------------------------

    undo(): void {
        this.editor?.undo();
    }

    redo(): void {
        this.editor?.redo();
    }

    clearAll(): void {
        this.editor?.clearAll();
    }

    // ---- View ------------------------------------------------------------

    zoomIn(): void {
        this.editor?.zoomIn();
    }

    zoomOut(): void {
        this.editor?.zoomOut();
    }

    fit(): void {
        this.editor?.fit();
    }

    actualSize(): void {
        this.editor?.actualSize();
    }

    // ---- Export ----------------------------------------------------------

    async exportClassMasks(): Promise<void> {
        const doc = this.editor?.doc;
        if (!doc) {
            return;
        }
        for (const layer of doc.layers) {
            saveBlob(
                await exportClassMask(layer),
                `${this.baseName()}-${slug(layer.name)}.png`,
            );
        }
        this.markSaved();
    }

    async exportColorMask(): Promise<void> {
        const doc = this.editor?.doc;
        if (doc) {
            saveBlob(await exportColorMask(doc), `${this.baseName()}-mask.png`);
            this.markSaved();
        }
    }

    async exportJson(): Promise<void> {
        const doc = this.editor?.doc;
        if (!doc) {
            return;
        }
        const json = JSON.stringify(await exportJson(doc));
        saveBlob(
            new Blob([json], { type: "application/json" }),
            `${this.baseName()}.json`,
        );
        this.markSaved();
    }

    private markSaved(): void {
        this.savedRevision.set(this.editor?.snapshot().revision ?? 0);
    }

    private baseName(): string {
        const name = this.image()?.name ?? "markup";
        return slug(name.replace(/\.[a-z0-9]+$/i, "")) || "markup";
    }
}

function slug(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
