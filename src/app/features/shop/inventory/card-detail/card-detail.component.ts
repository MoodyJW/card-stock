import { Component, inject, signal, OnInit } from '@angular/core';
import { CurrencyPipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { BreakpointObserver } from '@angular/cdk/layout';
import { InventoryService } from '../../../../core/services/inventory.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ImageService } from '../../../../core/services/image.service';
import { InventoryItem } from '../../../../core/models/inventory.model';
import { InventoryImage } from '../../../../core/models/image.model';
import { ConditionLabelPipe } from '../../../../shared/pipes/condition-label.pipe';
import { ImageUploadSlotComponent } from '../../../../shared/components/image-upload-slot/image-upload-slot.component';
import {
  CardFormDialogComponent,
  CardFormDialogData,
} from '../card-form-dialog/card-form-dialog.component';
import {
  MarkSoldDialogComponent,
  MarkSoldDialogData,
} from '../mark-sold-dialog/mark-sold-dialog.component';
import {
  ImageLightboxDialogComponent,
  LightboxDialogData,
} from '../image-lightbox-dialog/image-lightbox-dialog.component';

@Component({
  selector: 'app-card-detail',
  imports: [
    CurrencyPipe,
    TitleCasePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    ConditionLabelPipe,
    ImageUploadSlotComponent,
  ],
  templateUrl: './card-detail.component.html',
  styleUrl: './card-detail.component.scss',
})
export class CardDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly inventoryService = inject(InventoryService);
  private readonly notify = inject(NotificationService);
  private readonly imageService = inject(ImageService);
  private readonly dialog = inject(MatDialog);
  private readonly breakpointObserver = inject(BreakpointObserver);

  readonly card = signal<InventoryItem | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);

  // Image gallery state
  readonly images = signal<InventoryImage[]>([]);
  readonly uploadingImage = signal(false);

  private cardId: string | null = null;

  readonly MAX_IMAGES = 2;

  async ngOnInit(): Promise<void> {
    this.cardId = this.route.snapshot.paramMap.get('cardId');
    if (!this.cardId) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }
    await this.loadCard(this.cardId);
  }

  private async loadCard(cardId: string): Promise<void> {
    this.loading.set(true);
    const { data, error } = await this.inventoryService.getCardById(cardId);

    if (error || !data) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }

    this.card.set(data);
    this.loading.set(false);
    await this.loadImages(cardId);
  }

  private async loadImages(cardId: string): Promise<void> {
    const imgs = await this.imageService.getImages(cardId);
    this.images.set(imgs);
  }

  getImageUrl(image: InventoryImage): string {
    return this.imageService.getPublicUrl(image.storage_path);
  }

  openLightbox(index: number): void {
    const imgs = this.images();
    if (imgs.length === 0) return;

    const lightboxImages = imgs.map(img => ({
      url: this.getImageUrl(img),
      isPrimary: img.is_primary,
    }));

    this.dialog.open(ImageLightboxDialogComponent, {
      data: { images: lightboxImages, startIndex: index } satisfies LightboxDialogData,
      maxWidth: '100vw',
      width: '100vw',
      height: '100vh',
      panelClass: 'lightbox-dialog',
    });
  }

  async onGalleryUpload(file: File): Promise<void> {
    if (!this.cardId) return;

    this.uploadingImage.set(true);
    const isPrimary = this.images().length === 0;
    const result = await this.imageService.uploadImage(this.cardId, file, isPrimary);
    this.uploadingImage.set(false);

    if (result) {
      this.notify.success('Image uploaded');
      await this.loadImages(this.cardId);
    }
  }

  async onGalleryDelete(image: InventoryImage): Promise<void> {
    if (!this.cardId) return;
    if (!confirm('Remove this image?')) return;

    const success = await this.imageService.deleteImage(image);
    if (success) {
      this.notify.info('Image removed');
      await this.loadImages(this.cardId);
    }
  }

  async onGallerySetPrimary(image: InventoryImage): Promise<void> {
    if (!this.cardId || image.is_primary) return;

    const success = await this.imageService.setAsPrimary(image.id, this.cardId);
    if (success) {
      this.notify.success('Primary image updated');
      await this.loadImages(this.cardId);
    }
  }

  formatGrade(item: InventoryItem): string {
    if (!item.grading_company || item.grade == null) return '—';
    return `${item.grading_company.toUpperCase()} ${item.grade}`;
  }

  goBack(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }

  openEdit(): void {
    const card = this.card();
    if (!card) return;

    const dialogRef = this.dialog.open(CardFormDialogComponent, {
      data: { mode: 'edit', card } satisfies CardFormDialogData,
      ...this.getDialogConfig(),
    });

    dialogRef.afterClosed().subscribe(async (result: InventoryItem | undefined) => {
      if (result) {
        await this.loadCard(card.id);
      }
    });
  }

  openSell(): void {
    const card = this.card();
    if (!card) return;

    const dialogRef = this.dialog.open(MarkSoldDialogComponent, {
      data: { card } satisfies MarkSoldDialogData,
      ...this.getDialogConfig(),
    });

    dialogRef.afterClosed().subscribe(async (result: unknown) => {
      if (result) {
        await this.loadCard(card.id);
      }
    });
  }

  async deleteCard(): Promise<void> {
    const card = this.card();
    if (!card) return;

    const { error } = await this.inventoryService.softDeleteCard(card.id);
    if (error) {
      this.notify.error('Failed to delete card');
      return;
    }

    this.goBack();

    const snackRef = this.notify.showWithAction('Card deleted', 'Undo', 5000);
    snackRef.onAction().subscribe(async () => {
      const { error: restoreError } = await this.inventoryService.restoreDeletedCard(card.id);
      if (restoreError) {
        this.notify.error('Failed to restore card');
      } else {
        this.notify.info('Card restored');
      }
    });
  }

  private getDialogConfig(): Record<string, unknown> {
    const isMobile = this.breakpointObserver.isMatched('(max-width: 599px)');
    return isMobile
      ? { width: '96vw', height: '96vh', panelClass: 'fullscreen-dialog' }
      : { width: '600px', maxHeight: '90vh' };
  }
}
