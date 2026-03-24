import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatBadgeModule } from '@angular/material/badge';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  Condition,
  InventoryFilters,
  InventoryStatus,
} from '../../../../core/models/inventory.model';

@Component({
  selector: 'app-inventory-filter-bar',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatExpansionModule,
    MatBadgeModule,
  ],
  templateUrl: './filter-bar.component.html',
  styleUrl: './filter-bar.component.scss',
})
export class FilterBarComponent {
  private fb = inject(FormBuilder);
  private breakpointObserver = inject(BreakpointObserver);

  @Input() setNames: string[] = [];
  @Output() filtersChanged = new EventEmitter<InventoryFilters>();

  // Use a FormGroup for all filter controls
  filterForm = this.fb.group({
    search: [''],
    status: [null as InventoryStatus | null],
    condition: [null as Condition | null],
    set_name: [null as string | null],
  });

  // Signal for mobile detection
  readonly isMobile = toSignal(this.breakpointObserver.observe('(max-width: 767px)'), {
    initialValue: { matches: false, breakpoints: {} },
  });

  conditions: { value: Condition; label: string }[] = [
    { value: 'mint', label: 'Mint' },
    { value: 'near_mint', label: 'Near Mint' },
    { value: 'lightly_played', label: 'Lightly Played' },
    { value: 'moderately_played', label: 'Moderately Played' },
    { value: 'heavily_played', label: 'Heavily Played' },
    { value: 'damaged', label: 'Damaged' },
  ];

  statuses: { value: InventoryStatus; label: string }[] = [
    { value: 'available', label: 'Available' },
    { value: 'reserved', label: 'Reserved' },
    { value: 'sold', label: 'Sold' },
  ];

  constructor() {
    // PRAGMATIC SIMPLIFICATION:
    // We debounce the entire filterForm.valueChanges rather than splitting search and dropdowns.
    // Splitting child controls directly causes FormGroup sync issues where child valueChanges emit
    // before the parent form's .value object updates, leading to stale filter emissions.
    // A 300ms debounce on dropdowns is imperceptible and guarantees an accurate state.
    this.filterForm.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(
          (a: typeof this.filterForm.value, b: typeof this.filterForm.value) =>
            JSON.stringify(a) === JSON.stringify(b),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(values => {
        this.emitFilters(values);
      });
  }

  clearFilters(): void {
    this.filterForm.reset({
      search: '',
      status: null,
      condition: null,
      set_name: null,
    });
  }

  get activeFilterCount(): number {
    const value = this.filterForm.value;
    let count = 0;
    if (value.search?.trim()) count++;
    if (value.status) count++;
    if (value.condition) count++;
    if (value.set_name) count++;
    return count;
  }

  private emitFilters(
    values: Partial<{
      search: string | null;
      status: InventoryStatus | null;
      condition: Condition | null;
      set_name: string | null;
    }>,
  ): void {
    const filters: InventoryFilters = {
      search: values.search?.trim() || undefined,
      status: values.status || null,
      condition: values.condition || null,
      set_name: values.set_name || null,
    };
    this.filtersChanged.emit(filters);
  }
}
