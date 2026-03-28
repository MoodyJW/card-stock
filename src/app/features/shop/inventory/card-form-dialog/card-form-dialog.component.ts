import { Component, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map, startWith } from 'rxjs';
import { InventoryService } from '../../../../core/services/inventory.service';
import { NotificationService } from '../../../../core/services/notification.service';
import {
  Condition,
  CreateInventoryItem,
  GradingCompany,
  InventoryItem,
} from '../../../../core/models/inventory.model';

export interface CardFormDialogData {
  mode: 'add' | 'edit';
  card?: InventoryItem;
}

@Component({
  selector: 'app-card-form-dialog',
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './card-form-dialog.component.html',
  styleUrl: './card-form-dialog.component.scss',
})
export class CardFormDialogComponent {
  readonly data = inject<CardFormDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CardFormDialogComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly inventoryService = inject(InventoryService);
  private readonly notify = inject(NotificationService);

  readonly loading = signal(false);

  readonly form = this.fb.nonNullable.group({
    card_name: ['', [Validators.required]],
    set_name: [''],
    set_code: [''],
    card_number: [''],
    rarity: [''],
    language: ['English'],
    is_foil: [false],
    condition: ['near_mint' as string, [Validators.required]],
    grading_company: ['' as string],
    grade: [{ value: null as number | null, disabled: true }],
    purchase_price: [null as number | null],
    selling_price: [null as number | null],
    notes: ['', [Validators.maxLength(500)]],
  });

  readonly languages = [
    'English',
    'Japanese',
    'Korean',
    'Chinese',
    'French',
    'German',
    'Italian',
    'Spanish',
    'Portuguese',
  ];

  readonly conditions: { value: Condition; label: string }[] = [
    { value: 'mint', label: 'Mint' },
    { value: 'near_mint', label: 'Near Mint' },
    { value: 'lightly_played', label: 'Lightly Played' },
    { value: 'moderately_played', label: 'Moderately Played' },
    { value: 'heavily_played', label: 'Heavily Played' },
    { value: 'damaged', label: 'Damaged' },
  ];

  readonly gradingCompanies: { value: GradingCompany; label: string }[] = [
    { value: 'psa', label: 'PSA' },
    { value: 'cgc', label: 'CGC' },
    { value: 'bgs', label: 'BGS' },
    { value: 'sgc', label: 'SGC' },
    { value: 'ace', label: 'ACE' },
  ];

  readonly filteredSetNames$ = this.form.controls.set_name.valueChanges.pipe(
    startWith(''),
    map(value => this.filterSetNames(value)),
  );

  constructor() {
    // Conditional grading logic
    this.form.controls.grading_company.valueChanges.pipe(takeUntilDestroyed()).subscribe(value => {
      if (value) {
        this.form.controls.grade.enable();
      } else {
        this.form.controls.grade.disable();
        this.form.controls.grade.reset(null);
      }
    });

    // Edit mode: pre-populate form
    if (this.data.mode === 'edit' && this.data.card) {
      const card = this.data.card;
      this.form.patchValue({
        card_name: card.card_name,
        set_name: card.set_name ?? '',
        set_code: card.set_code ?? '',
        card_number: card.card_number ?? '',
        rarity: card.rarity ?? '',
        language: card.language ?? 'English',
        is_foil: card.is_foil,
        condition: card.condition,
        grading_company: (card.grading_company as string) ?? '',
        purchase_price: card.purchase_price ?? null,
        selling_price: card.selling_price ?? null,
        notes: card.notes ?? '',
      });
      // Grade is set after grading_company triggers enable via valueChanges
      if (card.grading_company && card.grade != null) {
        this.form.controls.grade.setValue(card.grade);
      }
    }
  }

  get title(): string {
    return this.data.mode === 'edit' ? 'Edit Card' : 'Add Card';
  }

  get submitLabel(): string {
    return this.data.mode === 'edit' ? 'Save Changes' : 'Add Card';
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);

    const rawValue = this.form.getRawValue();
    const cleaned = Object.fromEntries(
      Object.entries(rawValue).map(([k, v]) => [k, v === '' ? null : v]),
    ) as unknown as CreateInventoryItem;

    if (this.data.mode === 'add') {
      const { data, error } = await this.inventoryService.addCard(cleaned);
      if (error) {
        this.notify.error(
          typeof error === 'object' && error !== null && 'message' in error
            ? (error as { message: string }).message
            : 'Failed to add card',
        );
        this.loading.set(false);
        return;
      }
      this.notify.success('Card added successfully');
      this.dialogRef.close(data);
    } else {
      const cardId = this.data.card!.id;
      const { data, error } = await this.inventoryService.updateCard(cardId, cleaned);
      if (error) {
        this.notify.error(
          typeof error === 'object' && error !== null && 'message' in error
            ? (error as { message: string }).message
            : 'Failed to update card',
        );
        this.loading.set(false);
        return;
      }
      this.notify.success('Card updated successfully');
      this.dialogRef.close(data);
    }
  }

  private filterSetNames(value: string): string[] {
    const filterVal = (value || '').toLowerCase();
    return this.inventoryService
      .distinctSetNames()
      .filter(name => name.toLowerCase().includes(filterVal));
  }
}
