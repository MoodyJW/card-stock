import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FilterBarComponent } from './filter-bar.component';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('FilterBarComponent', () => {
  let component: FilterBarComponent;
  let fixture: ComponentFixture<FilterBarComponent>;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [FilterBarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FilterBarComponent);
    component = fixture.componentInstance;
    component.setNames = ['Base Set', 'Jungle'];
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit filters when form changes after debounce', () => {
    vi.spyOn(component.filtersChanged, 'emit');

    component.filterForm.patchValue({ search: 'Charizard' });

    // Should not emit immediately due to debounce
    expect(component.filtersChanged.emit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);

    expect(component.filtersChanged.emit).toHaveBeenCalledWith({
      search: 'Charizard',
      status: null,
      condition: null,
      set_name: null,
    });
  });

  it('should emit filters when status dropdown changes (after debounce)', () => {
    vi.spyOn(component.filtersChanged, 'emit');

    component.filterForm.patchValue({ status: 'sold' });
    vi.advanceTimersByTime(300);

    expect(component.filtersChanged.emit).toHaveBeenCalledWith({
      search: undefined,
      status: 'sold',
      condition: null,
      set_name: null,
    });
  });

  it('should clear all filters', () => {
    component.filterForm.patchValue({
      search: 'Pikachu',
      status: 'available',
      condition: 'mint',
      set_name: 'Base Set',
    });
    vi.advanceTimersByTime(300);

    vi.spyOn(component.filtersChanged, 'emit');

    component.clearFilters();
    vi.advanceTimersByTime(300);

    expect(component.filterForm.value).toEqual({
      search: '',
      status: null,
      condition: null,
      set_name: null,
    });

    expect(component.filtersChanged.emit).toHaveBeenCalledWith({
      search: undefined,
      status: null,
      condition: null,
      set_name: null,
    });
  });

  it('should compute active filter count correctly', () => {
    expect(component.activeFilterCount).toBe(0);

    component.filterForm.patchValue({ search: 'Mewtwo' });
    expect(component.activeFilterCount).toBe(1);

    component.filterForm.patchValue({ status: 'sold' });
    expect(component.activeFilterCount).toBe(2);

    component.filterForm.patchValue({ search: '' });
    expect(component.activeFilterCount).toBe(1);
  });
});
