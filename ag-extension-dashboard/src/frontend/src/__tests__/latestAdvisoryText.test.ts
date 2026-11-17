import { describe, expect, it } from 'vitest';
import { latestAdvisoryText, WELCOME_MESSAGE_ID, type ChatMessageItem } from '@/components/Cyber/alpha/response';

const msg = (id: string, sender: 'user' | 'assistant', text: string): ChatMessageItem =>
  ({ id, sender, text, timestamp: '08:00' });

const welcome = msg(WELCOME_MESSAGE_ID, 'assistant', 'Agronomic Decision Support Co-Pilot');

describe('latestAdvisoryText', () => {
  it('ignores the static greeting so it is never exported or sent to a farmer', () => {
    expect(latestAdvisoryText([welcome])).toBeUndefined();
  });

  it('ignores the greeting even after the officer has only asked a question', () => {
    expect(latestAdvisoryText([welcome, msg('u1', 'user', 'maize leaf spots?')])).toBeUndefined();
  });

  it('returns the most recent real advisory', () => {
    const messages = [
      welcome,
      msg('u1', 'user', 'first question'),
      msg('a1', 'assistant', 'first advisory'),
      msg('u2', 'user', 'second question'),
      msg('a2', 'assistant', 'second advisory'),
    ];
    expect(latestAdvisoryText(messages)).toBe('second advisory');
  });

  it('does not mutate the message list', () => {
    const messages = [welcome, msg('a1', 'assistant', 'advisory')];
    latestAdvisoryText(messages);
    expect(messages[0].id).toBe(WELCOME_MESSAGE_ID);
  });
});
