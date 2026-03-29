import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ImportWizardReviewComponent } from './import-wizard-review.component';

describe('ImportWizardReviewComponent', () => {
  let component: ImportWizardReviewComponent;
  let fixture: ComponentFixture<ImportWizardReviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportWizardReviewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ImportWizardReviewComponent);
    component = fixture.componentInstance;

    // Set required inputs
    fixture.componentRef.setInput('validatedRows', []);
    fixture.componentRef.setInput('importState', 'idle');
    fixture.componentRef.setInput('importResult', null);
    fixture.componentRef.setInput('importError', null);
    fixture.componentRef.setInput('validCount', 0);
    fixture.componentRef.setInput('errorCount', 0);
    fixture.componentRef.setInput('skippedCount', 0);
    fixture.componentRef.setInput('importProgressPercent', 0);
    fixture.componentRef.setInput('importProgressInfo', null);

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
