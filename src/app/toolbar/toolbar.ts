import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    inject,
    output,
    signal,
    viewChild,
} from "@angular/core";
import { AzButtonDirective } from "@az-way/ui";
import { EditorService, type ToolId } from "../editor/editor.service";
import { isMac } from "../editor/shortcuts";
import { Icon, type IconName } from "../ui/icon";

interface ToolButton {
    id: ToolId;
    label: string;
    key: string;
    icon: IconName;
    /** Shown on phones too. */
    essential: boolean;
}

@Component({
    selector: "app-toolbar",
    imports: [AzButtonDirective, Icon],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: "./toolbar.html",
    host: {
        class: "flex items-center gap-1 border-b border-line bg-surface-1 px-2 py-1.5 sm:gap-2 sm:px-3",
        "(document:pointerdown)": "closeMenuOnOutsideClick($event)",
    },
})
export class Toolbar {
    protected readonly editor = inject(EditorService);
    private readonly exportMenu =
        viewChild<ElementRef<HTMLElement>>("exportMenu");

    readonly openImage = output();
    readonly showShortcuts = output();
    readonly toggleClasses = output();

    protected readonly exportOpen = signal(false);
    protected readonly mod = isMac ? "⌘" : "Ctrl+";
    protected readonly tools: ToolButton[] = [
        { id: "pan", label: "Pan", key: "H", icon: "pan", essential: true },
        {
            id: "brush",
            label: "Brush",
            key: "B",
            icon: "brush",
            essential: true,
        },
        {
            id: "eraser",
            label: "Eraser",
            key: "E",
            icon: "eraser",
            essential: true,
        },
        {
            id: "polygon",
            label: "Polygon",
            key: "P",
            icon: "polygon",
            essential: false,
        },
        {
            id: "polyline",
            label: "Polyline",
            key: "O",
            icon: "polyline",
            essential: false,
        },
        {
            id: "scissors",
            label: "Scissors",
            key: "S",
            icon: "scissors",
            essential: false,
        },
        {
            id: "threshold",
            label: "Threshold",
            key: "T",
            icon: "threshold",
            essential: false,
        },
        {
            id: "ruler",
            label: "Ruler",
            key: "L",
            icon: "ruler",
            essential: false,
        },
    ];

    protected zoomLabel(): string {
        return `${Math.round(this.editor.zoom() * 100)}%`;
    }

    protected toggleExport(): void {
        this.exportOpen.update((open) => !open);
    }

    protected async export(kind: "masks" | "color" | "json"): Promise<void> {
        this.exportOpen.set(false);
        switch (kind) {
            case "masks":
                return this.editor.exportClassMasks();
            case "color":
                return this.editor.exportColorMask();
            case "json":
                return this.editor.exportJson();
        }
    }

    protected closeMenuOnOutsideClick(event: PointerEvent): void {
        const menu = this.exportMenu()?.nativeElement;
        if (this.exportOpen() && !menu?.contains(event.target as Node)) {
            this.exportOpen.set(false);
        }
    }
}
