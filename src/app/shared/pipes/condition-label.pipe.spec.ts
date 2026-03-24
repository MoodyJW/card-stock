import { describe, it, expect } from 'vitest';
import { ConditionLabelPipe } from './condition-label.pipe';

describe('ConditionLabelPipe', () => {
  const pipe = new ConditionLabelPipe();

  it('should create', () => {
    expect(pipe).toBeTruthy();
  });

  it('should transform near_mint to Near Mint', () => {
    expect(pipe.transform('near_mint')).toBe('Near Mint');
  });

  it('should transform lightly_played to Lightly Played', () => {
    expect(pipe.transform('lightly_played')).toBe('Lightly Played');
  });

  it('should transform moderately_played to Moderately Played', () => {
    expect(pipe.transform('moderately_played')).toBe('Moderately Played');
  });

  it('should transform heavily_played to Heavily Played', () => {
    expect(pipe.transform('heavily_played')).toBe('Heavily Played');
  });

  it('should transform damaged to Damaged', () => {
    expect(pipe.transform('damaged')).toBe('Damaged');
  });

  it('should transform mint to Mint', () => {
    expect(pipe.transform('mint')).toBe('Mint');
  });

  it('should return empty string for null/undefined', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });

  it('should return original value for unknown conditions', () => {
    expect(pipe.transform('unknown_value')).toBe('unknown_value');
  });
});
