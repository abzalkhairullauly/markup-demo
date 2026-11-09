// Renders the bundled sample image: a top-down illustration of a small town
// (buildings, roads, trees) that suits the default label classes.
//
//   node scripts/render-sample.mjs
//
// Output: public/sample.jpg. Uses Playwright's Chromium, so run
// `pnpm exec playwright install chromium` first.

import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

const W = 2400;
const H = 1600;
const OUT = fileURLToPath(new URL("../public/sample.jpg", import.meta.url));

// Deterministic PRNG so the image is reproducible.
let seed = 7;
const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
};
const between = (a, b) => a + rand() * (b - a);
const pick = (list) => list[Math.floor(rand() * list.length)];

const parts = [];
const add = (s) => parts.push(s);

// Ground: grass with soft patches.
add(`<rect width="${W}" height="${H}" fill="#7c9a5a"/>`);
for (let i = 0; i < 260; i++) {
    const shade = pick(["#86a463", "#718f50", "#8aa86a", "#6d8a4c"]);
    add(
        `<ellipse cx="${between(0, W)}" cy="${between(0, H)}" rx="${between(40, 160)}" ry="${between(30, 120)}" fill="${shade}" opacity="0.55"/>`,
    );
}

// River along the bottom-left.
add(
    `<path d="M-50 1180 C 300 1100 520 1320 860 1260 S 1300 1480 1500 1700 L -50 1700 Z" fill="#4f7ea8"/>`,
);
add(
    `<path d="M-50 1180 C 300 1100 520 1320 860 1260 S 1300 1480 1500 1700" fill="none" stroke="#c9b98f" stroke-width="22" opacity="0.8"/>`,
);

// Road grid.
const vRoads = [380, 1020, 1660, 2160];
const hRoads = [300, 820];
const road = "#5a5d63";
for (const x of vRoads) {
    add(`<rect x="${x - 34}" y="0" width="68" height="${H}" fill="${road}"/>`);
    add(
        `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#e8e2c8" stroke-width="3" stroke-dasharray="28 22"/>`,
    );
}
for (const y of hRoads) {
    add(`<rect x="0" y="${y - 34}" width="${W}" height="68" fill="${road}"/>`);
    add(
        `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#e8e2c8" stroke-width="3" stroke-dasharray="28 22"/>`,
    );
}
// A curved lane crossing the river.
add(
    `<path d="M1020 820 C 1000 1050 760 1150 700 1700" fill="none" stroke="${road}" stroke-width="54"/>`,
);
add(
    `<path d="M1020 820 C 1000 1050 760 1150 700 1700" fill="none" stroke="#e8e2c8" stroke-width="3" stroke-dasharray="24 20"/>`,
);
// Sidewalk edges.
for (const x of vRoads) {
    add(
        `<rect x="${x - 40}" y="0" width="80" height="${H}" fill="none" stroke="#b9b4a6" stroke-width="5" opacity="0.7"/>`,
    );
}

// Buildings in the blocks between roads.
const roofs = [
    "#b5523b",
    "#9c4a3a",
    "#c7c2b8",
    "#8d8a85",
    "#a86d4e",
    "#d1cbbf",
    "#6f7480",
];
const blocksX = [
    [0, vRoads[0] - 40],
    [vRoads[0] + 40, vRoads[1] - 40],
    [vRoads[1] + 40, vRoads[2] - 40],
    [vRoads[2] + 40, vRoads[3] - 40],
    [vRoads[3] + 40, W],
];
const blocksY = [
    [0, hRoads[0] - 40],
    [hRoads[0] + 40, hRoads[1] - 40],
    [hRoads[1] + 40, 1080],
];
const trees = [];
for (const [x0, x1] of blocksX) {
    for (const [y0, y1] of blocksY) {
        if (rand() < 0.15) {
            // A park: just trees.
            for (let i = 0; i < 26; i++) {
                trees.push([
                    between(x0 + 30, x1 - 30),
                    between(y0 + 30, y1 - 30),
                ]);
            }
            continue;
        }
        let x = x0 + between(30, 60);
        while (x < x1 - 120) {
            const w = between(110, 220);
            if (x + w > x1 - 30) break;
            const topH = between(90, (y1 - y0) / 2 - 30);
            const botH = between(90, (y1 - y0) / 2 - 30);
            for (const [y, h] of [
                [y0 + between(25, 45), topH],
                [y1 - botH - between(25, 45), botH],
            ]) {
                const roof = pick(roofs);
                add(
                    `<rect x="${x + 10}" y="${y + 12}" width="${w}" height="${h}" fill="#000" opacity="0.28"/>`,
                );
                add(
                    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${roof}"/>`,
                );
                // Ridge line and a couple of roof details.
                if (w > h) {
                    add(
                        `<line x1="${x + 6}" y1="${y + h / 2}" x2="${x + w - 6}" y2="${y + h / 2}" stroke="#000" stroke-opacity="0.25" stroke-width="3"/>`,
                    );
                } else {
                    add(
                        `<line x1="${x + w / 2}" y1="${y + 6}" x2="${x + w / 2}" y2="${y + h - 6}" stroke="#000" stroke-opacity="0.25" stroke-width="3"/>`,
                    );
                }
                if (rand() < 0.5) {
                    add(
                        `<rect x="${x + w * 0.2}" y="${y + h * 0.2}" width="18" height="18" fill="#444" opacity="0.6"/>`,
                    );
                }
            }
            // Gardens between houses.
            if (rand() < 0.8) {
                trees.push([
                    x + w + between(12, 30),
                    between(y0 + 60, y1 - 60),
                ]);
            }
            x += w + between(30, 70);
        }
    }
}

// Tree rows along the river and roads.
for (let i = 0; i < 70; i++) {
    const t = i / 70;
    trees.push([
        t * 1400 + between(-20, 20),
        1120 + Math.sin(t * 6) * 60 + between(-30, 30),
    ]);
}
for (let i = 0; i < 120; i++) {
    trees.push([between(1500, 1700), between(1120, H - 20)]);
    trees.push([between(2210, W - 20), between(1120, H - 20)]);
}

for (const [cx, cy] of trees) {
    const r = between(16, 34);
    add(
        `<circle cx="${cx + 6}" cy="${cy + 8}" r="${r}" fill="#000" opacity="0.25"/>`,
    );
    add(
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${pick(["#3f6b2f", "#4b7a35", "#355d28", "#567f3a"])}"/>`,
    );
    add(
        `<circle cx="${cx - r * 0.3}" cy="${cy - r * 0.3}" r="${r * 0.45}" fill="#6c9a48" opacity="0.6"/>`,
    );
}

// Fields bottom right.
for (let i = 0; i < 5; i++) {
    const x = 1720 + i * 80;
    add(
        `<rect x="${x}" y="1180" width="68" height="380" fill="${pick(["#b8a764", "#a4b25e", "#c6b779"])}" opacity="0.9"/>`,
    );
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.12 0"/></filter>
${parts.join("\n")}
<rect width="${W}" height="${H}" filter="url(#grain)"/>
</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(`<style>html,body{margin:0}</style>${svg}`, {
    waitUntil: "load",
});
await page.screenshot({ path: OUT, type: "jpeg", quality: 86 });
await browser.close();
console.log(`Wrote ${OUT}`);
