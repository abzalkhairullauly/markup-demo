/** Saves a blob as a file. The object URL is revoked right after use. */
export function saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
