/* eslint-disable @typescript-eslint/no-explicit-any */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImageUploadSlotComponent } from './image-upload-slot.component';
import { ImageService } from '../../../core/services/image.service';
import { NotificationService } from '../../../core/services/notification.service';
import { vi } from 'vitest';

describe('ImageUploadSlotComponent', () => {
  let component: ImageUploadSlotComponent;
  let fixture: ComponentFixture<ImageUploadSlotComponent>;
  let mockImageService: any;
  let mockNotify: any;

  beforeEach(async () => {
    mockImageService = {
      getPublicUrl: vi.fn().mockReturnValue('http://test.com/image.webp'),
    };

    mockNotify = {
      error: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ImageUploadSlotComponent],
      providers: [
        { provide: ImageService, useValue: mockImageService },
        { provide: NotificationService, useValue: mockNotify },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ImageUploadSlotComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display empty state when no image', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.empty-state')).toBeTruthy();
    expect(el.querySelector('.preview-image')).toBeFalsy();
  });

  it('should emit fileSelected when valid file is chosen', () => {
    const file = new File([''], 'test.png', { type: 'image/png' });
    let emitted: File | undefined;

    component.fileSelected.subscribe(f => (emitted = f));

    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      value: [file],
    });

    component.onFileSelected({ target: input } as unknown as Event);
    expect(emitted).toBe(file);
  });

  it('should warn and not emit if file is not an image', () => {
    const file = new File([''], 'test.txt', { type: 'text/plain' });
    let emitted = false;

    component.fileSelected.subscribe(() => (emitted = true));

    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      value: [file],
    });

    component.onFileSelected({ target: input } as unknown as Event);
    expect(emitted).toBe(false);
    expect(mockNotify.error).toHaveBeenCalledWith('Only image files are allowed.');
  });
});
