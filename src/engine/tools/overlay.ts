import type { Point } from "../geometry";

/** A path with a dark halo, readable on light and dark images. */
export function strokeWithHalo(
    g: CanvasRenderingContext2D,
    color: string,
    width = 1.5,
): void {
    g.lineJoin = "round";
    g.lineCap = "round";
    g.lineWidth = width + 2;
    g.strokeStyle = "rgba(0, 0, 0, 0.6)";
    g.stroke();
    g.lineWidth = width;
    g.strokeStyle = color;
    g.stroke();
}

export function drawVertex(
    g: CanvasRenderingContext2D,
    p: Point,
    radius = 3.5,
    highlighted = false,
): void {
    g.beginPath();
    g.arc(p.x, p.y, radius, 0, Math.PI * 2);
    g.fillStyle = highlighted ? "#ffffff" : "#111827";
    g.fill();
    g.lineWidth = 1.5;
    g.strokeStyle = highlighted ? "#111827" : "#ffffff";
    g.stroke();
}

/** A text label on a dark pill, centred on `p`. */
export function drawLabel(
    g: CanvasRenderingContext2D,
    text: string,
    p: Point,
): void {
    g.font = "12px 'IBM Plex Mono', ui-monospace, monospace";
    const width = g.measureText(text).width + 12;
    const height = 20;
    g.beginPath();
    g.roundRect(p.x - width / 2, p.y - height / 2, width, height, 10);
    g.fillStyle = "rgba(17, 24, 39, 0.85)";
    g.fill();
    g.fillStyle = "#ffffff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, p.x, p.y + 0.5);
}
