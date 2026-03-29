import { TestBed } from '@angular/core/testing';
import { ImageCompressionService } from './image-compression.service';

describe('ImageCompressionService', () => {
  let service: ImageCompressionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ImageCompressionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('calculateTargetSize', () => {
    it('should not upscale images smaller than max dimensions', () => {
      const result = service.calculateTargetSize(800, 600, 1200, 1200);
      expect(result).toEqual({ width: 800, height: 600 });
    });

    it('should scale down maintaining aspect ratio (landscape)', () => {
      const result = service.calculateTargetSize(2400, 1200, 1200, 1200);
      expect(result).toEqual({ width: 1200, height: 600 });
    });

    it('should scale down maintaining aspect ratio (portrait)', () => {
      const result = service.calculateTargetSize(1200, 2400, 1200, 1200);
      expect(result).toEqual({ width: 600, height: 1200 });
    });

    it('should handle custom max dimensions', () => {
      const result = service.calculateTargetSize(1000, 1000, 500, 800);
      // Math.min(500/1000, 800/1000) = 0.5
      expect(result).toEqual({ width: 500, height: 500 });
    });
  });
});
