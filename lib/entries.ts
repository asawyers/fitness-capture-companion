/** Conservative extraction: values are always copied from the note, never estimated. */
export type Kind = 'meal' | 'workout';
export type Food = {
    type: 'food';
    name: string;
    amount: string;
};
export type Strength = {
    type: 'strength';
    exercise: string;
    sets: string;
    reps: string;
    weight: string;
};
export type Cardio = {
    type: 'cardio';
    activity: string;
    duration: string;
    distance: string;
};
export type Detail = Food | Strength | Cardio;
export type Entry = {
    id: string;
    kind: Kind;
    originalNote: string;
    note: string;
    details: Detail[];
    logged: boolean;
    version: number;
    createdAt: string;
    updatedAt: string;
};
export const MAX_NOTE = 4000;
const quantity = String.raw `(?:\d+(?:\s+\d+\/\d+|\/\d+|\.\d+)?|[½¼¾]|an?|one|two|three)`;
const units = String.raw `(?:cups?|g|grams?|kg|kilograms?|oz|ounces?|lb|lbs|pounds?|ml|liters?|litres?|tbsp|tsp|tablespoons?|teaspoons?|slices?|pieces?|bowls?|plates?|handfuls?|scoops?|servings?|cans?|bottles?|packets?)`;
const leadingAmount = new RegExp(`^(${quantity}(?:\\s*${units}\\b)?)(?:\\s+of)?\\s+(.+)$`, 'i');
const trailingAmount = new RegExp(`^(.+?)\\s*[:–-]\\s*(${quantity}(?:\\s*${units}\\b)?)$`, 'i');
export function extract(kind: Kind, note: string): Detail[] {
    const parts = note.split(/[\n,;]+|\s+and\s+(?=\d)/i).map(s => s.trim()).filter(Boolean);
    return parts.slice(0, 50).map(part => {
        if (kind === 'meal') {
            const leading = part.match(leadingAmount);
            const trailing = part.match(trailingAmount);
            return { type: 'food', name: leading?.[2] ?? trailing?.[1] ?? part, amount: leading?.[1] ?? trailing?.[2] ?? '' };
        }
        const setsReps = part.match(/\b(\d+)\s*[x×]\s*(\d+(?:-\d+)?)\b/i)
            ?? part.match(/\b(\d+)\s+sets?\s+(?:of\s+)?(\d+(?:-\d+)?)\s*(?:reps?)?/i);
        const weight = part.match(/\b\d+(?:\.\d+)?\s*(?:kg|kgs|kilograms?|lb|lbs|pounds?)\b/i);
        const duration = part.match(/\b\d+(?:\.\d+)?\s*(?:minutes?|mins?|hours?|hrs?|seconds?|secs?)\b/i);
        const distance = part.match(/\b\d+(?:\.\d+)?\s*(?:km|kilometers?|kilometres?|miles?|mi|meters?|metres?|m)\b/i);
        const cardio = !setsReps && (duration || distance || /^(?:run|ran|running|walk|walked|walking|cycle|cycling|bike|biked|biking|swim|swam|swimming|row|rowing|hike|hiking|elliptical|treadmill)\b/i.test(part));
        const tokens = cardio ? [duration, distance] : [setsReps, weight];
        const firstIndex = Math.min(...tokens.filter(Boolean).map(m => m!.index!));
        const name = Number.isFinite(firstIndex)
            ? part.slice(0, firstIndex).replace(/\s+(?:for|at|with)\s*$/i, '').trim().replace(/[:–-]$/, '').trim()
            : part;
        // A number-first or unsupported sentence remains visible verbatim as the label.
        if (cardio)
            return { type: 'cardio', activity: name || part, duration: duration?.[0] ?? '', distance: distance?.[0] ?? '' };
        return { type: 'strength', exercise: name || part, sets: setsReps?.[1] ?? '', reps: setsReps?.[2] ?? '', weight: weight?.[0] ?? '' };
    });
}
export const detailFields = {
    food: ['name', 'amount'], strength: ['exercise', 'sets', 'reps', 'weight'], cardio: ['activity', 'duration', 'distance'],
} as const;
export function validateDetails(input: unknown, kind: Kind): Detail[] {
    if (!Array.isArray(input) || !input.length || input.length > 50)
        throw new Error('Use 1–50 items.');
    return input.map(item => {
        if (!item || typeof item !== 'object' || !Object.hasOwn(detailFields, item.type))
            throw new Error('Unknown item type.');
        const type = item.type as Detail['type'];
        if ((kind === 'meal') !== (type === 'food'))
            throw new Error('Item type does not match entry.');
        const fields: readonly string[] = detailFields[type];
        if (Object.keys(item).some(k => k !== 'type' && !fields.includes(k)))
            throw new Error('Unknown item field.');
        const result: Record<string, string> = { type };
        for (const field of fields) {
            const value: unknown = item[field];
            if (typeof value !== 'string' || value.length > MAX_NOTE)
                throw new Error('Invalid item value.');
            result[field] = value.trim();
        }
        const label = fields[0];
        if (!result[label])
            throw new Error('Each item needs a name.');
        return result as Detail;
    });
}
export function clarify(details: Detail[], index: number, field: string, value: string): Detail[] {
    const target = details[index];
    if (!target || !(detailFields[target.type] as readonly string[]).includes(field))
        throw new Error('Invalid clarification.');
    return details.map((d, i) => i === index ? { ...d, [field]: value.trim() } : { ...d });
}
export function missingFields(detail: Detail): string[] {
    return (detailFields[detail.type] as readonly string[]).filter(field => !String(detail[field as keyof typeof detail] ?? ''));
}
export function detailLabel(detail: Detail): string {
    return detail.type === 'food' ? detail.name : detail.type === 'strength' ? detail.exercise : detail.activity;
}
export function exportText(entry: Pick<Entry, 'kind' | 'note' | 'details' | 'createdAt'>): string {
    const lines = entry.details.map(d => {
        if (d.type === 'food')
            return `- ${d.name}: ${d.amount || 'amount not recorded'}`;
        if (d.type === 'cardio')
            return `- ${d.activity}: ${d.duration || 'duration not recorded'}; ${d.distance || 'distance not recorded'}`;
        return `- ${d.exercise}: ${d.sets || '?'} sets × ${d.reps || '?'} reps; ${d.weight || 'weight not recorded'}`;
    });
    return `${entry.kind === 'meal' ? 'Meal' : 'Workout'} — ${entry.createdAt}\n${lines.join('\n')}\n\nNote: ${entry.note}`;
}
