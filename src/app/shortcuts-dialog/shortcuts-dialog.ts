import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    viewChild,
} from "@angular/core";
import { SHORTCUT_GROUPS } from "../editor/shortcuts";
import { Icon } from "../ui/icon";

@Component({
    selector: "app-shortcuts-dialog",
    imports: [Icon],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        // Fallback for browsers without <dialog closedby="any">.
        "(click)": "closeOnBackdrop($event)",
    },
    template: `
        <dialog
            #dialog
            class="dialog"
            aria-labelledby="shortcuts-title"
            closedby="any"
        >
            <div
                class="flex items-center justify-between border-b border-line px-5 py-3"
            >
                <h2 id="shortcuts-title" class="font-semibold">
                    Keyboard shortcuts
                </h2>
                <button
                    type="button"
                    class="btn-icon"
                    aria-label="Close"
                    (click)="close()"
                >
                    <app-icon name="close" />
                </button>
            </div>
            <div class="grid gap-6 p-5 sm:grid-cols-2">
                @for (group of groups; track group.title) {
                    <section>
                        <h3 class="panel-heading mb-2">{{ group.title }}</h3>
                        <dl class="flex flex-col gap-1.5 text-sm">
                            @for (
                                shortcut of group.shortcuts;
                                track shortcut.description
                            ) {
                                <div
                                    class="flex items-baseline justify-between gap-4"
                                >
                                    <dt class="text-ink-muted">
                                        {{ shortcut.description }}
                                    </dt>
                                    <dd
                                        class="flex shrink-0 flex-wrap justify-end gap-1"
                                    >
                                        @for (
                                            combo of shortcut.keys;
                                            track $index
                                        ) {
                                            @if (!$first) {
                                                <span class="text-ink-muted"
                                                    >/</span
                                                >
                                            }
                                            @for (key of combo; track $index) {
                                                <kbd class="kbd">{{ key }}</kbd>
                                            }
                                        }
                                    </dd>
                                </div>
                            }
                        </dl>
                    </section>
                }
            </div>
        </dialog>
    `,
})
export class ShortcutsDialog {
    protected readonly groups = SHORTCUT_GROUPS;
    private readonly dialog =
        viewChild.required<ElementRef<HTMLDialogElement>>("dialog");

    get isOpen(): boolean {
        return this.dialog().nativeElement.open;
    }

    open(): void {
        this.dialog().nativeElement.showModal();
    }

    close(): void {
        this.dialog().nativeElement.close();
    }

    toggle(): void {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    protected closeOnBackdrop(event: MouseEvent): void {
        if (event.target === this.dialog().nativeElement) {
            this.close();
        }
    }
}
