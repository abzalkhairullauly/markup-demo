import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { MAX_BRUSH_SIZE, MIN_BRUSH_SIZE, type LabelClass } from "../../engine";
import { AzButtonDirective, AzCheckboxComponent } from "@az-way/ui";
import { EditorService } from "../editor/editor.service";
import { Icon } from "../ui/icon";

@Component({
    selector: "app-classes-panel",
    imports: [AzButtonDirective, AzCheckboxComponent, Icon],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: "./classes-panel.html",
    host: {
        class: "flex flex-col gap-5 overflow-y-auto bg-surface-1 p-4",
    },
})
export class ClassesPanel {
    protected readonly editor = inject(EditorService);
    protected readonly minBrush = MIN_BRUSH_SIZE;
    protected readonly maxBrush = MAX_BRUSH_SIZE;

    protected opacityPercent(): number {
        return Math.round(this.editor.maskOpacity() * 100);
    }

    protected onBrushInput(event: Event): void {
        this.editor.setBrushSize(
            Number((event.target as HTMLInputElement).value),
        );
    }

    protected onOpacityInput(event: Event): void {
        this.editor.setMaskOpacity(
            Number((event.target as HTMLInputElement).value) / 100,
        );
    }

    protected onRename(cls: LabelClass, event: Event): void {
        const input = event.target as HTMLInputElement;
        const name = input.value.trim();
        if (name && name !== cls.name) {
            this.editor.renameClass(cls.id, name);
        } else {
            input.value = cls.name;
        }
    }

    protected onRecolor(cls: LabelClass, event: Event): void {
        this.editor.recolorClass(
            cls.id,
            (event.target as HTMLInputElement).value,
        );
    }

    protected blurTarget(event: Event): void {
        (event.target as HTMLInputElement).blur();
    }

    protected onThresholdInput(edge: "min" | "max", event: Event): void {
        const value = Number((event.target as HTMLInputElement).value);
        const range = { ...this.editor.threshold(), [edge]: value };
        // Dragging one handle past the other moves both.
        if (edge === "min" && range.min > range.max) range.max = range.min;
        if (edge === "max" && range.max < range.min) range.min = range.max;
        this.editor.setThreshold(range);
    }

    protected clearAll(): void {
        if (confirm("Clear all masks? You can undo this.")) {
            this.editor.clearAll();
        }
    }

    protected remove(cls: LabelClass): void {
        if (
            confirm(
                `Delete class "${cls.name}" and its mask? You can undo this.`,
            )
        ) {
            this.editor.removeClass(cls.id);
        }
    }
}
