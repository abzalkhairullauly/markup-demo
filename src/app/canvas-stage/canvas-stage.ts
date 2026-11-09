import {
    afterNextRender,
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    inject,
    signal,
    viewChild,
} from "@angular/core";
import { EditorService } from "../editor/editor.service";

@Component({
    selector: "app-canvas-stage",
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: "stage-bg relative block min-h-0 min-w-0 flex-1 overflow-hidden",
        "(dragenter)": "onDragOver($event)",
        "(dragover)": "onDragOver($event)",
        "(dragleave)": "onDragLeave($event)",
        "(drop)": "onDrop($event)",
    },
    template: `
        <canvas #image class="stage-layer" aria-hidden="true"></canvas>
        <canvas #masks class="stage-layer" aria-hidden="true"></canvas>
        <canvas
            #overlay
            class="stage-layer touch-none select-none"
            role="img"
            [attr.aria-label]="label()"
            data-testid="stage"
        ></canvas>

        @if (editor.loading()) {
            <div
                class="pointer-events-none absolute inset-0 grid place-items-center"
            >
                <span
                    class="rounded-md bg-surface-2/90 px-3 py-1.5 text-sm text-ink-muted"
                >
                    Loading image…
                </span>
            </div>
        }

        @if (dragging()) {
            <div
                class="pointer-events-none absolute inset-3 grid place-items-center rounded-xl border-2 border-dashed border-accent bg-accent/10"
            >
                <span
                    class="rounded-md bg-surface-1 px-3 py-1.5 text-sm font-medium"
                >
                    Drop image to open
                </span>
            </div>
        }
    `,
})
export class CanvasStage {
    protected readonly editor = inject(EditorService);
    protected readonly dragging = signal(false);

    private readonly image =
        viewChild.required<ElementRef<HTMLCanvasElement>>("image");
    private readonly masks =
        viewChild.required<ElementRef<HTMLCanvasElement>>("masks");
    private readonly overlay =
        viewChild.required<ElementRef<HTMLCanvasElement>>("overlay");

    constructor() {
        afterNextRender(() => {
            this.editor.attach({
                image: this.image().nativeElement,
                masks: this.masks().nativeElement,
                overlay: this.overlay().nativeElement,
            });
        });
    }

    protected label(): string {
        const image = this.editor.image();
        return image
            ? `Annotation canvas: ${image.name}, ${image.width} by ${image.height} pixels`
            : "Annotation canvas: no image";
    }

    protected onDragOver(event: DragEvent): void {
        if (event.dataTransfer?.types.includes("Files")) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            this.dragging.set(true);
        }
    }

    protected onDragLeave(event: DragEvent): void {
        const host = event.currentTarget as HTMLElement;
        if (!host.contains(event.relatedTarget as Node | null)) {
            this.dragging.set(false);
        }
    }

    protected onDrop(event: DragEvent): void {
        event.preventDefault();
        this.dragging.set(false);
        const file = event.dataTransfer?.files[0];
        if (file) {
            void this.editor.openFile(file, file.name);
        }
    }
}
