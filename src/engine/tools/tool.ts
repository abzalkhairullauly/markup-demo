import type { AnnotationDocument } from "../document";
import type { Point } from "../geometry";
import type { Command } from "../history";
import type { MaskLayer } from "../mask-layer";
import type { Viewport } from "../viewport";

export type RenderLayer = "image" | "masks" | "overlay";

export interface ThresholdRange {
    /** Inclusive brightness range, 0–255. */
    min: number;
    max: number;
}

export interface EditorSettings {
    brushSize: number;
    /** Eraser and scissors act on every class instead of the active one. */
    eraseAllClasses: boolean;
    threshold: ThresholdRange;
}

/** A pointer event, already converted to image coordinates. */
export interface ToolPointer {
    image: Point;
    screen: Point;
    /**
     * Every position since the previous event (from `getCoalescedEvents()`
     * when supported), in image coordinates. Ends with `image`.
     */
    samples: readonly Point[];
    button: number;
    pointerType: string;
    shiftKey: boolean;
    altKey: boolean;
}

export interface ToolKey {
    key: string;
    shiftKey: boolean;
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
}

/** What a tool may use. Tools never see the DOM or the renderer. */
export interface ToolContext {
    readonly viewport: Viewport;
    readonly doc: AnnotationDocument;
    readonly settings: Readonly<EditorSettings>;
    readonly activeLayer: MaskLayer | undefined;
    /** Last known pointer position over the stage, in screen pixels. */
    readonly hover: Point | null;
    pushHistory(command: Command): void;
    invalidate(...layers: RenderLayer[]): void;
    updateSettings(patch: Partial<EditorSettings>): void;
    /** Brightness of every image pixel (row-major), computed once per image. */
    imageLuma(): Uint8Array;
}

/**
 * A tool is a self-contained state machine driven by the editor. Adding a
 * tool means writing one class and registering it; nothing else changes.
 */
export interface Tool {
    readonly id: string;

    /** CSS cursor for the stage while this tool is active. */
    cursor(ctx: ToolContext): string;

    onPointerDown?(e: ToolPointer, ctx: ToolContext): void;
    onPointerMove?(e: ToolPointer, ctx: ToolContext): void;
    onPointerUp?(e: ToolPointer, ctx: ToolContext): void;
    onDoubleClick?(e: ToolPointer, ctx: ToolContext): void;

    /** Returns true if the key was handled. */
    onKey?(e: ToolKey, ctx: ToolContext): boolean;

    /** Finishes pending work (Enter, "Apply"). Returns true if it did. */
    commit?(ctx: ToolContext): boolean;

    /** Drops any in-progress work. Returns true if there was some. */
    cancel?(ctx: ToolContext): boolean;

    /** True while the tool holds unfinished work (a stroke, a shape). */
    isBusy?(): boolean;

    /**
     * Draws previews on the overlay canvas. The context is already scaled
     * for devicePixelRatio, so draw in screen (CSS) pixels.
     */
    renderOverlay?(g: CanvasRenderingContext2D, ctx: ToolContext): void;
}
