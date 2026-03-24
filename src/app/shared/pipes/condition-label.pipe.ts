import { Pipe, PipeTransform } from '@angular/core';

const CONDITION_LABELS: Record<string, string> = {
  mint: 'Mint',
  near_mint: 'Near Mint',
  lightly_played: 'Lightly Played',
  moderately_played: 'Moderately Played',
  heavily_played: 'Heavily Played',
  damaged: 'Damaged',
};

@Pipe({
  name: 'conditionLabel',
  standalone: true,
})
export class ConditionLabelPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    return CONDITION_LABELS[value] ?? value;
  }
}
