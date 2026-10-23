import { describe, expect, it } from 'vitest';
import { AnalysisResultSchema, DetailSchema } from '../../supabase/functions/_shared/domain/contracts';
import { formatEntry, missingFields } from '../../supabase/functions/_shared/domain/entries';

describe('fitness domain', () => {
  it('keeps unknown food quantities empty', () => {
    expect(DetailSchema.parse({ type: 'food', name: 'rice', amount: '' })).toEqual({ type: 'food', name: 'rice', amount: '' });
    expect(missingFields({ type: 'food', name: 'rice', amount: '' })).toEqual(['amount']);
  });
  it('rejects invented nutrition fields and malformed questions', () => {
    expect(DetailSchema.safeParse({ type: 'food', name: 'rice', amount: '', calories: 100 }).success).toBe(false);
    expect(AnalysisResultSchema.safeParse({ details: [], question: { itemIndex: -1, field: 'amount', text: '?' }, reply: '?' }).success).toBe(false);
  });
  it('formats only entered values and preserves the source note', () => {
    expect(formatEntry({ kind: 'meal', note: 'Rice at lunch', details: [{ type: 'food', name: 'rice', amount: '' }] })).toBe('Meal\nRice at lunch\n\nrice: amount not recorded');
    expect(formatEntry({ kind: 'workout', note: 'Gym', details: [{type:'strength',exercise:'squat',sets:'3',reps:'5',weight:'60 kg'}, {type:'cardio',activity:'run',duration:'20 min',distance:''}] })).toBe('Workout\nGym\n\nsquat · 3 sets · 5 reps · 60 kg\nrun · 20 min');
  });
});

it('groups every missing meal or workout field without inventing values', async () => {
  const { clarificationGroups } = await import('../../supabase/functions/_shared/domain/entries');
  expect(clarificationGroups([
    { type: 'food', name: 'yogurt', amount: '' },
    { type: 'food', name: 'sausage', amount: '' },
    { type: 'food', name: 'cookie', amount: 'one' },
  ]).map(group => group.text)).toEqual([
    'What amount did you record for yogurt?',
    'What amount did you record for sausage?',
  ]);
  const workout = clarificationGroups([
    { type: 'strength', exercise: 'Squat', sets: '', reps: '', weight: '' },
    { type: 'cardio', activity: 'Run', duration: '', distance: '' },
  ]);
  expect(workout.map(group => group.fields)).toEqual([['sets', 'reps', 'weight'], ['duration', 'distance']]);
  expect(workout[0].text).toBe('What number of sets, reps per set and weight did you record for Squat?');
  expect(clarificationGroups([{ type: 'food', name: '', amount: '' }])).toEqual([]);
});
