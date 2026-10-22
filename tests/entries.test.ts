import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extract, clarify, exportText, validateDetails } from '../lib/entries.ts';

test('meal extraction preserves only stated foods and amounts', () => {
  assert.deepEqual(extract('meal', '2 eggs, 1/2 cup rice; chicken'), [
    { type: 'food', name: 'eggs', amount: '2' },
    { type: 'food', name: 'rice', amount: '1/2 cup' },
    { type: 'food', name: 'chicken', amount: '' },
  ]);
});
test('ambiguous compound foods and free text stay intact without guessed servings', () => {
  assert.deepEqual(extract('meal', 'mac and cheese'), [{ type: 'food', name: 'mac and cheese', amount: '' }]);
  assert.deepEqual(extract('meal', 'a bowl of oatmeal'), [{ type: 'food', name: 'oatmeal', amount: 'a bowl' }]);
});
test('strength and cardio extract explicit sets, reps, weight, duration and distance', () => {
  assert.deepEqual(extract('workout', 'Squat 3x5 at 60 kg; Run 20 min 3 km; Push-ups'), [
    { type: 'strength', exercise: 'Squat', sets: '3', reps: '5', weight: '60 kg' },
    { type: 'cardio', activity: 'Run', duration: '20 min', distance: '3 km' },
    { type: 'strength', exercise: 'Push-ups', sets: '', reps: '', weight: '' },
  ]);
});
test('workout prose supports explicit sets and reps without guessing load', () => {
  assert.deepEqual(extract('workout', 'Bench press 3 sets of 8 reps'), [
    { type: 'strength', exercise: 'Bench press', sets: '3', reps: '8', weight: '' },
  ]);
});
test('clarification changes one field, leaves other items intact and rejects wrong fields', () => {
  const source = extract('meal', 'eggs, rice');
  const result = clarify(source, 1, 'amount', '1 cup');
  assert.equal((result[1] as any).amount, '1 cup');
  assert.equal((source[1] as any).amount, '');
  assert.equal((result[0] as any).amount, '');
  assert.throws(() => clarify(source, 0, 'weight', '10 kg'));
  assert.throws(() => clarify(source, 4, 'amount', '1 cup'));
});
test('rejects invented detail shapes and excessive input', () => {
  assert.throws(() => validateDetails([{type: 'food', name: '', amount: '1'}], 'meal'));
  assert.throws(() => validateDetails([{type: 'food', name: 'rice', amount: '1', calories: 10}], 'meal'));
  assert.throws(() => validateDetails(extract('workout', 'Run 10 min'), 'meal'));
});
test('export includes explicit details and unknowns but never estimates', () => {
  const text = exportText({kind:'meal', note:'eggs, rice', details:extract('meal', 'eggs, rice'), createdAt:'2026-10-22T12:00:00.000Z'});
  assert.match(text, /eggs: amount not recorded/);
  assert.match(text, /Original capture|Note/);
  assert.doesNotMatch(text, /calories|protein|estimated/);
});
