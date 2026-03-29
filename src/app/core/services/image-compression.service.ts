import { Injectable } from '@angular/core';
import { CompressionOptions } from '../models/image.model';

@Injectable({
  providedIn: 'root',
})
export class ImageCompressionService {
  async compressImage(file: File, options: CompressionOptions = {}): Promise<Blob> {
    const { maxWidth = 1200, maxHeight = 1200, quality = 0.8, format = 'webp' } = options;

    const bitmap = await createImageBitmap(file);
    const { width, height } = this.calculateTargetSize(
      bitmap.width,
      bitmap.height,
      maxWidth,
      maxHeight,
    );

    let canvas: HTMLCanvasElement | OffscreenCanvas;
    let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;

    if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(width, height);
      ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    } else {
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    }

    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Draw and downscale
    ctx.drawImage(bitmap, 0, 0, width, height);

    const mimeType = format === 'webp' ? 'image/webp' : 'image/jpeg';

    if (canvas instanceof OffscreenCanvas) {
      return canvas.convertToBlob({ type: mimeType, quality });
    } else {
      return new Promise((resolve, reject) => {
        (canvas as HTMLCanvasElement).toBlob(
          blob => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas toBlob failed'));
            }
          },
          mimeType,
          quality,
        );
      });
    }
  }

  async getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    // Close bitmap to free memory immediately
    bitmap.close();
    return dimensions;
  }

  calculateTargetSize(
    width: number,
    height: number,
    maxWidth: number,
    maxHeight: number,
  ): { width: number; height: number } {
    if (width <= maxWidth && height <= maxHeight) {
      return { width, height }; // No upscaling
    }

    const ratio = Math.min(maxWidth / width, maxHeight / height);
    return {
      width: Math.round(width * ratio),
      height: Math.round(height * ratio),
    };
  }
}
