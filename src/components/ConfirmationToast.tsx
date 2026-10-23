import { useEffect, useState } from 'react';
import { CircleCheck, X } from 'lucide-react';

/** Keyed by message at the call site so each confirmation gets a fresh lifetime. */
export function ConfirmationToast({ message }: { message: string }) {
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || !visible) return;
    const timer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timer);
  }, [paused, visible]);
  if (!visible) return null;
  return <div className="confirmation-toast" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
    onFocusCapture={() => setPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
    <div className="toast-message" role="status" aria-atomic="true"><CircleCheck className="ui-icon" size={19} aria-hidden="true" /><p>{message}</p></div>
    <button type="button" className="toast-dismiss" aria-label="Dismiss confirmation" onClick={() => setVisible(false)}><X className="ui-icon" size={17} aria-hidden="true" /></button>
  </div>;
}
