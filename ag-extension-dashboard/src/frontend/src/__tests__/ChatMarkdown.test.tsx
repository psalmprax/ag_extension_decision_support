import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatMarkdown } from '@/components/chat/ChatMarkdown';
import { FarmerChatMessage } from '@/components/chat/FarmerChatMessage';

describe('ChatMarkdown', () => {
  it('renders bold and lists instead of raw markdown', () => {
    const { container } = render(<ChatMarkdown content={'**Scout first**\n\n- Check 20 plants\n- Note leaf damage'} />);
    expect(screen.getByText('Scout first').tagName).toBe('STRONG');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(container.textContent).not.toContain('**');
  });

  it('never renders raw HTML or script-style links', () => {
    const { container } = render(<ChatMarkdown content={'<img src=x onerror=alert(1)> [x](javascript:alert(1)) [ok](https://fao.org)'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('a[href^="javascript"]')).toBeNull();
    expect(screen.getByRole('link', { name: 'ok' })).toHaveAttribute('href', 'https://fao.org');
  });
});

describe('FarmerChatMessage', () => {
  it('formats AI replies but keeps what people typed verbatim', () => {
    const { rerender, container } = render(<FarmerChatMessage message={{ role: 'assistant', content: '**Apply after rain**' } as never} />);
    expect(screen.getByText('Apply after rain').tagName).toBe('STRONG');
    rerender(<FarmerChatMessage message={{ role: 'user', content: '**my maize**' } as never} />);
    expect(container.textContent).toContain('**my maize**');
  });
});
