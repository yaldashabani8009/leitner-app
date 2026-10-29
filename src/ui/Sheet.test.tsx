// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Sheet } from './Sheet';

/** A page with a button that opens the sheet, like the top bar + does. */
function Page({
  variant,
  withFocusTarget = false,
  onClose,
}: {
  variant?: 'bottom' | 'dialog';
  withFocusTarget?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wordRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Sheet
        open={open}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        title="New word"
        variant={variant}
        initialFocusRef={withFocusTarget ? wordRef : undefined}
        mascot={<svg data-testid="mascot" />}
        footer={<button type="button">Save word</button>}
      >
        <label>
          The word
          <input ref={wordRef} />
        </label>
      </Sheet>
    </>
  );
}

async function openSheet(props: Parameters<typeof Page>[0] = {}) {
  const view = render(<Page {...props} />);
  await userEvent.click(screen.getByRole('button', { name: 'Open' }));
  return view;
}

describe('Sheet', () => {
  it('renders nothing while closed', () => {
    render(<Page />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens as a modal dialog named by its title, and focuses itself', async () => {
    await openSheet();
    const dialog = screen.getByRole('dialog', { name: 'New word' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'New word' })).toBeInTheDocument();
    expect(screen.getByTestId('mascot')).toBeInTheDocument();
  });

  it('can focus a chosen field instead', async () => {
    await openSheet({ withFocusTarget: true });
    expect(screen.getByLabelText('The word')).toHaveFocus();
  });

  it('makes the page behind inert and stops it scrolling, then undoes both', async () => {
    const { container } = await openSheet();
    expect(container).toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('hidden');

    await userEvent.keyboard('{Escape}');
    expect(container).not.toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('');
  });

  it('closes on Esc and gives focus back to the opener', async () => {
    const onClose = vi.fn();
    await openSheet({ onClose });
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
  });

  it('closes when the dim overlay is tapped', async () => {
    const onClose = vi.fn();
    await openSheet({ onClose });
    const overlay = screen.getByRole('dialog').previousElementSibling!;
    await userEvent.click(overlay);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('has a round ✕ that closes the bottom sheet', async () => {
    const onClose = vi.fn();
    await openSheet({ onClose });
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps Tab inside the sheet, both ways', async () => {
    await openSheet();
    const close = screen.getByRole('button', { name: 'Close' });
    const input = screen.getByLabelText('The word');
    const save = screen.getByRole('button', { name: 'Save word' });

    // From the sheet itself, Shift+Tab wraps to the last control.
    await userEvent.tab({ shift: true });
    expect(save).toHaveFocus();
    // From the last control, Tab wraps to the first.
    await userEvent.tab();
    expect(close).toHaveFocus();
    await userEvent.tab();
    expect(input).toHaveFocus();
    await userEvent.tab();
    expect(save).toHaveFocus();
    // From the first control, Shift+Tab wraps to the last.
    close.focus();
    await userEvent.tab({ shift: true });
    expect(save).toHaveFocus();
  });

  it('keeps focus on the sheet when there is nothing to tab to', async () => {
    function Empty() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <Sheet open={open} onClose={() => setOpen(false)} title="Hi" variant="dialog" />
        </>
      );
    }
    render(<Empty />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await userEvent.tab();
    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('shows the dialog look without the ✕', async () => {
    await openSheet({ variant: 'dialog' });
    expect(screen.getByRole('dialog').className).toMatch(/dialog/);
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save word' })).toBeInTheDocument();
  });

  it('gives control back to the first sheet when a second one closes', async () => {
    function Stacked() {
      const [second, setSecond] = useState(false);
      return (
        <Sheet open onClose={() => {}} title="New word">
          <button type="button" onClick={() => setSecond(true)}>
            Save word
          </button>
          <Sheet open={second} onClose={() => setSecond(false)} title="Duplicate" variant="dialog">
            <button type="button" onClick={() => setSecond(false)}>
              Cancel
            </button>
          </Sheet>
        </Sheet>
      );
    }
    render(<Stacked />);
    const first = screen.getByRole('dialog', { name: 'New word' });
    await userEvent.click(screen.getByRole('button', { name: 'Save word' }));
    expect(first.parentElement).toHaveAttribute('inert');

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(first.parentElement).not.toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('hidden');
    expect(screen.getByRole('button', { name: 'Save word' })).toHaveFocus();
  });

  it('follows the visible area, so it sits on top of the iPhone keyboard', async () => {
    // A phone 852px tall; the keyboard covers 336px and Safari has scrolled the page by 40px.
    const listeners = new Set<() => void>();
    const viewport = {
      height: 852,
      offsetTop: 0,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    };
    vi.stubGlobal('visualViewport', viewport);
    vi.stubGlobal('innerHeight', 852);
    try {
      await openSheet();
      const layer = screen.getByRole('dialog').parentElement!;
      expect(layer.style.height).toBe('852px');
      expect(layer.className).not.toMatch(/keyboardOpen/);

      viewport.height = 516;
      viewport.offsetTop = 40;
      act(() => listeners.forEach((fn) => fn()));
      expect(layer.style.height).toBe('516px');
      expect(layer.style.top).toBe('40px');
      expect(layer.className).toMatch(/keyboardOpen/);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('closes when the handle is dragged down far enough, and stays open after a short drag', async () => {
    Element.prototype.setPointerCapture ??= () => {};
    Element.prototype.releasePointerCapture ??= () => {};
    Element.prototype.hasPointerCapture ??= () => false;
    const onClose = vi.fn();
    await openSheet({ onClose });
    const grab = screen.getByRole('dialog').querySelector('[class*="grab"]')!;
    const drag = (dy: number, pointerId: number) => {
      const start = {
        pointerId,
        clientX: 100,
        clientY: 100,
        buttons: 1,
        isPrimary: true,
        pointerType: 'touch',
      };
      fireEvent.pointerDown(grab, start);
      for (let step = 1; step <= 5; step++) {
        fireEvent.pointerMove(grab, { ...start, clientY: 100 + (dy * step) / 5 });
      }
      fireEvent.pointerUp(grab, { ...start, clientY: 100 + dy, buttons: 0 });
    };

    drag(40, 1);
    expect(onClose).not.toHaveBeenCalled();
    drag(200, 2);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
