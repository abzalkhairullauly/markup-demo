import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
} from "@angular/core";
import { EditorService } from "../editor/editor.service";

const TOOL_NAMES: Record<string, string> = {
    pan: "Pan",
    brush: "Brush",
    eraser: "Eraser",
    polygon: "Polygon",
    polyline: "Polyline",
    scissors: "Scissors",
    threshold: "Threshold",
    ruler: "Ruler",
};

@Component({
    selector: "app-status-bar",
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: "flex items-center gap-4 border-t border-line bg-surface-1 px-3 py-1 text-xs text-ink-muted tabular-nums",
    },
    template: `
        <span class="font-mono" data-testid="zoom">{{ zoom() }}</span>
        @if (editor.image(); as image) {
            <span class="truncate max-sm:hidden">
                {{ image.name }} · {{ image.width }}×{{ image.height }}
            </span>
        }
        <span class="font-mono max-sm:hidden" aria-live="off">
            @if (editor.pointer(); as p) {
                {{ p.x }}, {{ p.y }}
            } @else {
                –
            }
        </span>
        <span class="flex-1"></span>
        <span>{{ tool() }}</span>
        @if (editor.activeClass(); as cls) {
            <span class="flex items-center gap-1.5">
                <span
                    class="size-2.5 rounded-full"
                    [style.background-color]="cls.color"
                ></span>
                {{ cls.name }}
            </span>
        }
    `,
})
export class StatusBar {
    protected readonly editor = inject(EditorService);
    protected readonly zoom = computed(
        () => `${Math.round(this.editor.zoom() * 100)}%`,
    );
    protected readonly tool = computed(() => {
        const tool = this.editor.activeTool();
        return tool ? TOOL_NAMES[tool] : "No tool";
    });
}
