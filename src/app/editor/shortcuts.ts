export interface Shortcut {
    keys: string[][];
    description: string;
}

export interface ShortcutGroup {
    title: string;
    shortcuts: Shortcut[];
}

export const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.userAgent);

const mod = isMac ? "⌘" : "Ctrl";

/** Single source for the shortcuts dialog. Handling lives in `App`. */
export const SHORTCUT_GROUPS: ShortcutGroup[] = [
    {
        title: "Tools",
        shortcuts: [
            { keys: [["H"]], description: "Pan" },
            { keys: [["B"]], description: "Brush" },
            { keys: [["E"]], description: "Eraser" },
            { keys: [["P"]], description: "Polygon" },
            { keys: [["O"]], description: "Polyline (open polygon)" },
            { keys: [["S"]], description: "Scissors: keep inside a lasso" },
            { keys: [["T"]], description: "Threshold by brightness" },
            { keys: [["L"]], description: "Ruler" },
            { keys: [["["], ["]"]], description: "Brush size down / up" },
            {
                keys: [["Shift", "E"]],
                description: "Eraser, scissors: active / all classes",
            },
            {
                keys: [["Esc"]],
                description: "Cancel shape, then deselect tool",
            },
        ],
    },
    {
        title: "Polygon, polyline, threshold",
        shortcuts: [
            { keys: [["Click"]], description: "Add a point" },
            {
                keys: [["Double-click"], ["Enter"]],
                description: "Finish the shape",
            },
            { keys: [["Backspace"]], description: "Remove last point" },
            {
                keys: [["Click"]],
                description: "Threshold: pick brightness",
            },
            { keys: [["Enter"]], description: "Threshold: apply" },
            { keys: [["Shift", "Drag"]], description: "Ruler: snap to 45°" },
        ],
    },
    {
        title: "View",
        shortcuts: [
            {
                keys: [[mod, "Wheel"]],
                description: "Zoom at cursor (or pinch)",
            },
            { keys: [["+"], ["-"]], description: "Zoom in / out" },
            { keys: [["0"]], description: "Fit to screen" },
            { keys: [["1"]], description: "Actual size (100%)" },
            {
                keys: [["Space", "Drag"], ["Middle drag"]],
                description: "Pan",
            },
            { keys: [["Wheel"]], description: "Scroll the image" },
            { keys: [["Shift", "Wheel"]], description: "Mask opacity" },
        ],
    },
    {
        title: "Edit",
        shortcuts: [
            { keys: [[mod, "Z"]], description: "Undo" },
            {
                keys: [
                    [mod, "Shift", "Z"],
                    ["Ctrl", "Y"],
                ],
                description: "Redo",
            },
            { keys: [[mod, "O"]], description: "Open image" },
            { keys: [["?"]], description: "Show this dialog" },
        ],
    },
];
