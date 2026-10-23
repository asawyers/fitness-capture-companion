import type { Detail, Kind } from './contracts.ts';

export function detailFields(detail: Detail): string[] {
  return detail.type === 'food' ? ['name', 'amount'] : detail.type === 'strength' ? ['exercise', 'sets', 'reps', 'weight'] : ['activity', 'duration', 'distance'];
}
export function detailLabel(detail: Detail): string {
  return detail.type === 'food' ? detail.name : detail.type === 'strength' ? detail.exercise : detail.activity;
}
export function missingFields(detail: Detail): string[] {
  return detailFields(detail).filter((field) => !(detail as unknown as Record<string, string>)[field].trim());
}
export function formatEntry(entry: { kind: Kind; note: string; details: Detail[] }): string {
  const rows = entry.details.map((detail) => {
    if (detail.type === 'food') return `${detail.name}: ${detail.amount || 'amount not recorded'}`;
    if (detail.type === 'cardio') return [detail.activity, detail.duration, detail.distance].filter(Boolean).join(' · ');
    return [detail.exercise, detail.sets && `${detail.sets} sets`, detail.reps && `${detail.reps} reps`, detail.weight].filter(Boolean).join(' · ');
  }).filter(Boolean);
  return [entry.kind === 'meal' ? 'Meal' : 'Workout', entry.note, ...(rows.length ? ['', ...rows] : [])].join('\n');
}
