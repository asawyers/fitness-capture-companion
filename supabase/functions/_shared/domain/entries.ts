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
/** All optional gaps, grouped by the user's existing food or exercise. */
export function clarificationGroups(details: Detail[]): { itemIndex: number; fields: string[]; text: string }[] {
  const labels: Record<string, string> = { amount: 'amount', sets: 'number of sets', reps: 'reps per set', weight: 'weight', duration: 'duration', distance: 'distance' };
  return details.flatMap((detail, itemIndex) => {
    const label = detailLabel(detail).trim();
    const fields = missingFields(detail);
    if (!label || !fields.length) return [];
    const names = fields.map(field => labels[field] ?? field);
    const requested = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
    return [{ itemIndex, fields, text: `What ${requested} did you record for ${label}?` }];
  });
}
export function formatEntry(entry: { kind: Kind; note: string; details: Detail[] }): string {
  const rows = entry.details.map((detail) => {
    if (detail.type === 'food') return `${detail.name}: ${detail.amount || 'amount not recorded'}`;
    if (detail.type === 'cardio') return [detail.activity, detail.duration, detail.distance].filter(Boolean).join(' · ');
    return [detail.exercise, detail.sets && `${detail.sets} sets`, detail.reps && `${detail.reps} reps`, detail.weight].filter(Boolean).join(' · ');
  }).filter(Boolean);
  return [entry.kind === 'meal' ? 'Meal' : 'Workout', entry.note, ...(rows.length ? ['', ...rows] : [])].join('\n');
}
