import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  inject,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { InventoryImage } from '../../../core/models/image.model';
import { ImageService } from '../../../core/services/image.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-image-upload-slot',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatTooltipModule,
  ],
  templateUrl: './image-upload-slot.component.html',
  styleUrl: './image-upload-slot.component.scss',
})
export class ImageUploadSlotComponent implements OnChanges, OnDestroy {
  @Input() image: InventoryImage | null = null;
  @Input() previewFile: File | null = null;
  @Input() isPrimary = false;
  @Input() label = 'Image';
  @Input() uploading = false;

  @Output() fileSelected = new EventEmitter<File>();
  @Output() deleteClicked = new EventEmitter<void>();
  @Output() primaryClicked = new EventEmitter<void>();

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  private readonly imageService = inject(ImageService);
  private readonly notify = inject(NotificationService);

  displayUrl: string | null = null;
  private objectUrl: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['previewFile'] || changes['image']) {
      this.updateDisplayUrl();
    }
  }

  ngOnDestroy(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
    }
  }

  private updateDisplayUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }

    if (this.previewFile) {
      this.objectUrl = URL.createObjectURL(this.previewFile);
      this.displayUrl = this.objectUrl;
    } else if (this.image) {
      this.displayUrl = this.imageService.getPublicUrl(this.image.storage_path);
    } else {
      this.displayUrl = null;
    }
  }

  triggerFileInput(): void {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      // Client-side validation
      if (!file.type.startsWith('image/')) {
        this.notify.error('Only image files are allowed.');
        input.value = '';
        return;
      }

      // 10 MB limit before compression
      if (file.size > 10 * 1024 * 1024) {
        this.notify.error('Image is too large. Maximum size is 10MB.');
        input.value = '';
        return;
      }

      this.fileSelected.emit(file);
    }
    input.value = ''; // Reset to allow selecting same file again if removed
  }

  onDelete(event: Event): void {
    event.stopPropagation();
    this.deleteClicked.emit();
  }

  onPrimaryToggle(event: Event): void {
    event.stopPropagation();
    if (!this.isPrimary) {
      this.primaryClicked.emit();
    }
  }
}
