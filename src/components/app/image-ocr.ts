export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 2048;

type ImageFileLike = {
  type: string;
  size: number;
};

export type OcrResult =
  | { kind: 'success'; text: string }
  | { kind: 'empty' }
  | { kind: 'unavailable' }
  | { kind: 'failed'; message: string };

export function validateImageFile(file: ImageFileLike) {
  if (!file.type.startsWith('image/')) {
    return '이미지 파일만 선택할 수 있습니다.';
  }

  if (file.size === 0) {
    return '비어 있는 이미지는 인식할 수 없습니다.';
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return '10MB 이하의 이미지를 선택해 주세요.';
  }

  return null;
}

export function calculateResizedDimensions(width: number, height: number) {
  const largestEdge = Math.max(width, height);

  if (largestEdge <= MAX_IMAGE_EDGE) {
    return { width, height };
  }

  const ratio = MAX_IMAGE_EDGE / largestEdge;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

async function resizeImageForOcr(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const loadedImage = new Image();
      loadedImage.onload = () => resolve(loadedImage);
      loadedImage.onerror = () => reject(new Error('이미지를 열 수 없습니다.'));
      loadedImage.src = objectUrl;
    });
    const dimensions = calculateResizedDimensions(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('이미지 처리를 시작할 수 없습니다.');
    }

    context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canRunBrowserOcr() {
  return typeof window !== 'undefined'
    && typeof Worker !== 'undefined'
    && typeof WebAssembly !== 'undefined'
    && typeof URL?.createObjectURL === 'function';
}

export async function recognizeImageText(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<OcrResult> {
  const validationMessage = validateImageFile(file);

  if (validationMessage) {
    return { kind: 'failed', message: validationMessage };
  }

  if (!canRunBrowserOcr()) {
    return { kind: 'unavailable' };
  }

  try {
    const image = await resizeImageForOcr(file);
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker(['kor', 'eng'], 1, {
      logger: ({ progress }) => onProgress?.(Math.round(progress * 100)),
    });

    try {
      const result = await worker.recognize(image);
      const text = result.data.text.trim();
      return text ? { kind: 'success', text } : { kind: 'empty' };
    } finally {
      await worker.terminate();
    }
  } catch {
    return { kind: 'failed', message: '이미지 글자 인식에 실패했습니다. 문자 내용을 직접 붙여넣어 주세요.' };
  }
}
