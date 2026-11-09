import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
} from "@angular/core";

const ICONS = {
    pan: [
        "M12 3v18",
        "M3 12h18",
        "M9 6l3-3 3 3",
        "M9 18l3 3 3-3",
        "M6 9l-3 3 3 3",
        "M18 9l3 3-3 3",
    ],
    brush: [
        "M14.5 12.5 20 7a2.1 2.1 0 0 0-3-3l-5.5 5.5",
        "M11.5 9.5l3 3",
        "M10 11c-2.5 0-4.5 1.6-4.5 4.2 0 1.8-1 2.8-2.5 3.6 4.2.6 9.5-.4 9.5-5.3",
    ],
    eraser: ["M15 4l5 5-9.5 9.5H6L3 15.5z", "M9.5 9.5l5 5", "M12 20h8"],
    polygon: ["M5 9l6.5-5L19 9l-2 10H7z"],
    polyline: ["M4 18l5-9 5 5 6-10"],
    scissors: [
        "M6 6.5a2.5 2.5 0 1 0 0 .01",
        "M6 17.5a2.5 2.5 0 1 0 0 .01",
        "M8.2 8 20 18",
        "M8.2 16 20 6",
    ],
    ruler: [
        "M3 15.5 15.5 3l5.5 5.5L8.5 21z",
        "M7 11.5l2 2",
        "M10 8.5l2 2",
        "M13 5.5l2 2",
    ],
    threshold: [
        "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
        "M12 3v18",
        "M12 7h6",
        "M12 11h8.5",
        "M12 15h7.5",
    ],
    undo: ["M9 14 4 9l5-5", "M4 9h11a5 5 0 0 1 0 10h-3"],
    redo: ["M15 14l5-5-5-5", "M20 9H9a5 5 0 0 0 0 10h3"],
    "zoom-in": [
        "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z",
        "M20 20l-3.9-3.9",
        "M8 11h6",
        "M11 8v6",
    ],
    "zoom-out": [
        "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z",
        "M20 20l-3.9-3.9",
        "M8 11h6",
    ],
    fit: ["M4 9V4h5", "M20 9V4h-5", "M4 15v5h5", "M20 15v5h-5"],
    image: ["M4 5h16v14H4z", "M4 16l5-5 4 4 2.5-2.5L20 17", "M15.5 8.5h.01"],
    download: ["M12 4v11", "M7 10l5 5 5-5", "M5 20h14"],
    trash: ["M4 7h16", "M9 7V4h6v3", "M6 7l1 13h10l1-13"],
    eye: [
        "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z",
        "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
    ],
    "eye-off": [
        "M3 3l18 18",
        "M10.6 6.1Q11.3 6 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3 3.7",
        "M6.6 6.6C3.8 8.3 2 12 2 12s3.5 6 10 6c2 0 3.9-.6 5.4-1.6",
        "M9.9 9.9a3 3 0 0 0 4.2 4.2",
    ],
    plus: ["M12 5v14", "M5 12h14"],
    keyboard: [
        "M3 6h18v12H3z",
        "M7 10h.01",
        "M11 10h.01",
        "M15 10h.01",
        "M7 14h10",
    ],
    layers: ["M12 3 3 8l9 5 9-5z", "M3 13l9 5 9-5"],
    close: ["M6 6l12 12", "M18 6 6 18"],
    "chevron-down": ["M6 9l6 6 6-6"],
} satisfies Record<string, string[]>;

export type IconName = keyof typeof ICONS;

/** Small stroke icon set. Purely decorative: label the parent control. */
@Component({
    selector: "app-icon",
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: "inline-flex shrink-0",
        "aria-hidden": "true",
    },
    template: `
        <svg
            viewBox="0 0 24 24"
            [attr.width]="size()"
            [attr.height]="size()"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            @for (d of paths(); track $index) {
                <path [attr.d]="d" />
            }
        </svg>
    `,
})
export class Icon {
    readonly name = input.required<IconName>();
    readonly size = input(20);
    protected readonly paths = computed(() => ICONS[this.name()]);
}
