// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BottomPanel } from './BottomPanel';
import { Card, CardStack } from './Card';

describe('Card', () => {
  it('renders its content and passes attributes through', () => {
    render(
      <Card aria-label="Word card" className="extra">
        meticulous
      </Card>,
    );
    const card = screen.getByLabelText('Word card');
    expect(card).toHaveTextContent('meticulous');
    expect(card).toHaveClass('extra');
  });
});

describe('CardStack', () => {
  it('puts two decorative cards behind the current one', () => {
    const { container } = render(
      <CardStack>
        <Card>meticulous</Card>
      </CardStack>,
    );
    const hidden = container.querySelectorAll('[aria-hidden="true"]');
    expect(hidden).toHaveLength(2);
    expect(screen.getByText('meticulous')).toBeInTheDocument();
  });
});

describe('BottomPanel', () => {
  it('is a compact panel by default', () => {
    const { container } = render(<BottomPanel color="orange">Think first…</BottomPanel>);
    const panel = container.firstElementChild!;
    expect(panel.className).toMatch(/orange/);
    expect(panel.className).toMatch(/compact/);
    expect(panel).toHaveTextContent('Think first…');
  });

  it('can be tall and aqua, with a mascot peeking over the edge', () => {
    const { container } = render(
      <BottomPanel color="aqua" size="tall" mascot={<svg data-testid="mascot" />}>
        All done for today
      </BottomPanel>,
    );
    const panel = container.firstElementChild!;
    expect(panel.className).toMatch(/aqua/);
    expect(panel.className).toMatch(/tall/);
    expect(screen.getByTestId('mascot')).toBeInTheDocument();
  });
});
