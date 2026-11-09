export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 8000;

export class ImageLoadError extends Error {
    override readonly name = "ImageLoadError";
}

/**
 * Validates and decodes an image file. Decoding goes through
 * `createImageBitmap`, so no object URL or <img> element is involved.
 */
export async function decodeImage(file: Blob): Promise<ImageBitmap> {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        throw new ImageLoadError(
            "Unsupported file type. Use a PNG, JPEG or WebP image.",
        );
    }
    if (file.size > MAX_IMAGE_BYTES) {
        throw new ImageLoadError(
            `The file is ${formatMegabytes(file.size)}. The limit is 50 MB.`,
        );
    }

    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(file);
    } catch {
        throw new ImageLoadError(
            "The image could not be decoded. The file may be damaged.",
        );
    }

    if (
        bitmap.width > MAX_IMAGE_DIMENSION ||
        bitmap.height > MAX_IMAGE_DIMENSION
    ) {
        const { width, height } = bitmap;
        bitmap.close();
        throw new ImageLoadError(
            `The image is ${width}×${height} px. ` +
                `The limit is ${MAX_IMAGE_DIMENSION}×${MAX_IMAGE_DIMENSION} px.`,
        );
    }
    return bitmap;
}

function formatMegabytes(bytes: number): string {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
