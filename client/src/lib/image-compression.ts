import imageCompression from "browser-image-compression";
import type { Options } from "browser-image-compression";

const COMPRESSIBLE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/bmp",
  "image/avif",
]);

const MIN_COMPRESS_SIZE_BYTES = 300 * 1024;

const DEFAULT_IMAGE_COMPRESSION_OPTIONS: Options = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  initialQuality: 0.8,
  useWebWorker: false,
};

function shouldCompressImage(file: File) {
  return COMPRESSIBLE_IMAGE_TYPES.has(file.type) && file.size >= MIN_COMPRESS_SIZE_BYTES;
}

export async function compressImageFile(file: File, options?: Options) {
  if (!shouldCompressImage(file)) {
    return file;
  }

  try {
    const compressedFile = await imageCompression(file, {
      ...DEFAULT_IMAGE_COMPRESSION_OPTIONS,
      ...options,
    });
    return new File([compressedFile], file.name, {
      type: compressedFile.type || file.type,
      lastModified: file.lastModified,
    });
  } catch (error) {
    console.error("Image compression failed, falling back to original file.", error);
    return file;
  }
}

export async function compressFormDataImages(formData: FormData) {
  const compressedFormData = new FormData();

  for (const [key, value] of Array.from(formData.entries())) {
    if (value instanceof File) {
      const file = await compressImageFile(value);
      compressedFormData.append(key, file, file.name);
      continue;
    }

    compressedFormData.append(key, value);
  }

  return compressedFormData;
}

export const AI_IMAGE_COMPRESSION_OPTIONS: Options = {
  maxSizeMB: 0.28,
  maxWidthOrHeight: 1280,
  initialQuality: 0.72,
  useWebWorker: false,
};
