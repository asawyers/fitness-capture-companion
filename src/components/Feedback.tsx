import { CircleCheck, CircleHelp, CircleAlert, Dumbbell, LoaderCircle, Utensils } from 'lucide-react';

/** Decorative cues always accompany a visible text label. */
export function KindIcon({ kind }: { kind: 'meal' | 'workout' }) {
  const Icon = kind === 'meal' ? Utensils : Dumbbell;
  return <Icon className="ui-icon" aria-hidden="true" size={16} />;
}

export function Spinner() {
  return <LoaderCircle className="ui-icon loading-spinner" aria-hidden="true" size={16} />;
}

export function StatusIcon({ status }: { status: 'processing' | 'question' | 'retry' | 'ready' | 'logged' }) {
  if (status === 'processing') return <Spinner />;
  const Icon = status === 'question' ? CircleHelp : status === 'retry' ? CircleAlert : CircleCheck;
  return <Icon className="ui-icon" aria-hidden="true" size={14} />;
}
