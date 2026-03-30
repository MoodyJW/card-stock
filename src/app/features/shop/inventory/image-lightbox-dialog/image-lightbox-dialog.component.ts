import { Component, HostListener, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface LightboxDialogData {
  images: { url: string; isPrimary: boolean }[];
  startIndex: number;
}

@Component({
  selector: 'app-image-lightbox-dialog',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './image-lightbox-dialog.component.html',
  styleUrl: './image-lightbox-dialog.component.scss',
})
export class ImageLightboxDialogComponent {
  readonly data = inject<LightboxDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ImageLightboxDialogComponent>);

  currentIndex = this.data.startIndex;

  get currentImage(): { url: string; isPrimary: boolean } {
    return this.data.images[this.currentIndex];
  }

  get hasMultiple(): boolean {
    return this.data.images.length > 1;
  }

  get imageCounter(): string {
    return `${this.currentIndex + 1} / ${this.data.images.length}`;
  }

  close(): void {
    this.dialogRef.close();
  }

  prev(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
    } else {
      this.currentIndex = this.data.images.length - 1;
    }
  }

  next(): void {
    if (this.currentIndex < this.data.images.length - 1) {
      this.currentIndex++;
    } else {
      this.currentIndex = 0;
    }
  }

  @HostListener('document:keydown.ArrowLeft')
  onArrowLeft(): void {
    if (this.hasMultiple) this.prev();
  }

  @HostListener('document:keydown.ArrowRight')
  onArrowRight(): void {
    if (this.hasMultiple) this.next();
  }
}
