import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert, CircleCheck, X } from 'lucide-react';

/** Sources clear transient errors on dismissal so an identical retry failure can reappear. */
export function Toast({ message, tone = 'success', onDismiss }: { message: string; tone?: 'success' | 'error'; onDismiss?(): void }) {
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const [viewport, setViewport] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let element = document.getElementById('toast-viewport');
    if (!element) {
      element = document.createElement('div');
      element.id = 'toast-viewport';
      element.className = 'toast-viewport';
      document.body.appendChild(element);
    }
    setViewport(element);
  }, []);
  useEffect(() => {
    if (tone === 'error' || paused || !visible) return;
    const timer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timer);
  }, [tone, paused, visible]);
  if (!visible || !viewport) return null;
  const Icon = tone === 'error' ? CircleAlert : CircleCheck;
  return createPortal(<div className={`toast ${tone}`} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
    onFocusCapture={() => setPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
    <div className="toast-message" role={tone === 'error' ? 'alert' : 'status'} aria-atomic="true"><Icon className="ui-icon" size={19} aria-hidden="true" /><p>{message}</p></div>
    <button type="button" className="toast-dismiss" aria-label={tone === 'error' ? 'Dismiss error' : 'Dismiss confirmation'} onClick={() => { setVisible(false); onDismiss?.(); }}><X className="ui-icon" size={17} aria-hidden="true" /></button>
  </div>, viewport);
}
