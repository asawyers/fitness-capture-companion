// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Toast } from '../../src/components/Toast';

afterEach(() => { cleanup(); vi.useRealTimers(); });

test('simultaneous errors stack outside forms and stay until individually dismissed', () => {
  vi.useFakeTimers();
  const view = render(<><Toast message="Microphone unavailable." tone="error" /><Toast message="Could not save your note." tone="error" /></>);
  expect(screen.getAllByRole('alert')).toHaveLength(2);
  expect(view.container.querySelector('.toast')).toBeNull();
  expect(document.querySelectorAll('#toast-viewport > .toast.error')).toHaveLength(2);
  act(() => vi.advanceTimersByTime(60_000));
  expect(screen.getAllByRole('alert')).toHaveLength(2);
  fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss error' })[0]);
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss error' }));
  expect(screen.queryByRole('alert')).toBeNull();
});
