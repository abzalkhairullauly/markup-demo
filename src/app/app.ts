import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    inject,
    signal,
    viewChild,
} from "@angular/core";
import { AzAlertComponent } from "@az-way/ui";
import { ACCEPTED_IMAGE_TYPES } from "../engine";
import { CanvasStage } from "./canvas-stage/canvas-stage";
import { ClassesPanel } from "./classes-panel/classes-panel";
import { EditorService, type ToolId } from "./editor/editor.service";
import { ShortcutsDialog } from "./shortcuts-dialog/shortcuts-dialog";
import { StatusBar } from "./status-bar/status-bar";
import { Toolbar } from "./toolbar/toolbar";
import { Icon } from "./ui/icon";

const TOOL_KEYS: Record<string, ToolId> = {
    h: "pan",
    b: "brush",
    e: "eraser",
    p: "polygon",
    o: "polyline",
    s: "scissors",
    t: "threshold",
    l: "ruler",
};

@Component({
    selector: "app-root",
    imports: [
        AzAlertComponent,
        CanvasStage,
        ClassesPanel,
        Icon,
        ShortcutsDialog,
        StatusBar,
        Toolbar,
    ],
    providers: [EditorService],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: "./app.html",
    host: {
        class: "flex h-dvh flex-col overflow-hidden",
        "(document:keydown)": "onKeyDown($event)",
        "(document:keyup)": "onKeyUp($event)",
        "(document:paste)": "onPaste($event)",
        "(window:blur)": "editor.setSpacePressed(false)",
        "(window:beforeunload)": "onBeforeUnload($event)",
    },
})
export class App {
    protected readonly editor = inject(EditorService);
    protected readonly accept = ACCEPTED_IMAGE_TYPES.join(",");
    protected readonly classesOpen = signal(false);

    private readonly fileInput =
        viewChild.required<ElementRef<HTMLInputElement>>("fileInput");
    private readonly shortcuts = viewChild.required(ShortcutsDialog);

    protected openFilePicker(): void {
        this.fileInput().nativeElement.click();
    }

    protected onFileChosen(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (file) {
            void this.editor.openFile(file, file.name);
        }
        input.value = "";
    }

    protected showShortcuts(): void {
        this.shortcuts().open();
    }

    protected onPaste(event: ClipboardEvent): void {
        if (isTextField(event.target)) {
            return;
        }
        const item = [...(event.clipboardData?.items ?? [])].find(
            (i) => i.kind === "file" && i.type.startsWith("image/"),
        );
        const file = item?.getAsFile();
        if (file) {
            event.preventDefault();
            void this.editor.openFile(file, file.name || "pasted-image.png");
        }
    }

    protected onKeyDown(event: KeyboardEvent): void {
        if (this.shortcuts().isOpen || isTextField(event.target)) {
            return;
        }
        const key = event.key;
        const mod = event.ctrlKey || event.metaKey;

        if (mod) {
            this.onModifierKey(event);
            return;
        }
        if (event.altKey) {
            return;
        }

        // Space and Enter belong to focused buttons; only take them when
        // focus is not on an interactive element.
        const onControl = isInteractive(event.target);
        if (key === " " && !onControl) {
            event.preventDefault();
            if (!event.repeat) {
                this.editor.setSpacePressed(true);
            }
            return;
        }
        if (
            (key === "Enter" || key === "Backspace") &&
            !onControl &&
            this.editor.handleToolKey(event)
        ) {
            event.preventDefault();
            return;
        }

        const tool = TOOL_KEYS[key.toLowerCase()];
        if (key === "E") {
            this.editor.setEraseAllClasses(!this.editor.eraseAllClasses());
        } else if (tool) {
            this.editor.selectTool(tool);
        } else if (key === "Escape") {
            this.editor.escape();
        } else if (key === "[") {
            this.editor.stepBrushSize(-1);
        } else if (key === "]") {
            this.editor.stepBrushSize(1);
        } else if (key === "+" || key === "=") {
            this.editor.zoomIn();
        } else if (key === "-" || key === "_") {
            this.editor.zoomOut();
        } else if (key === "0") {
            this.editor.fit();
        } else if (key === "1") {
            this.editor.actualSize();
        } else if (key === "?") {
            this.showShortcuts();
        } else {
            return;
        }
        event.preventDefault();
    }

    /** Asks before closing the tab when there are edits not yet exported. */
    protected onBeforeUnload(event: BeforeUnloadEvent): void {
        if (this.editor.hasUnsavedChanges()) {
            event.preventDefault();
        }
    }

    protected onKeyUp(event: KeyboardEvent): void {
        if (event.key === " ") {
            this.editor.setSpacePressed(false);
        }
    }

    private onModifierKey(event: KeyboardEvent): void {
        const key = event.key.toLowerCase();
        if (key === "z" && event.shiftKey) {
            this.editor.redo();
        } else if (key === "z") {
            this.editor.undo();
        } else if (key === "y") {
            this.editor.redo();
        } else if (key === "o") {
            this.openFilePicker();
        } else {
            return;
        }
        event.preventDefault();
    }
}

function isTextField(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
        return false;
    }
    if (target.isContentEditable || target instanceof HTMLTextAreaElement) {
        return true;
    }
    return (
        target instanceof HTMLInputElement &&
        !["checkbox", "radio", "range", "color", "button"].includes(target.type)
    );
}

function isInteractive(target: EventTarget | null): boolean {
    return (
        target instanceof HTMLElement &&
        target.closest("button, a, input, select, textarea, summary") !== null
    );
}
