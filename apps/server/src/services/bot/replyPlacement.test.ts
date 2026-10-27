import { describe, expect, it } from 'vitest';

import { extractReplyPlacement, resolveReplyPlacement } from './replyPlacement';

const targets = {
  channel: 'slack:C1',
  default: 'thread' as const,
  thread: 'slack:C1:111.222',
};

describe('extractReplyPlacement', () => {
  it.each([
    ['[[reply:thread]]\nworking on it', 'thread', 'working on it'],
    ['[[reply:channel]]\nshipped', 'channel', 'shipped'],
    ['  [[ Reply : Channel ]]  \nshipped', 'channel', 'shipped'],
    ['[[reply：thread]]\n结果如下', 'thread', '结果如下'],
    ['[[reply:channel]]', 'channel', ''],
    ['shipped\n\n[[reply:channel]]', 'channel', 'shipped'],
  ])('reads %j', (content, placement, rest) => {
    expect(extractReplyPlacement(content)).toEqual({ content: rest, placement });
  });

  it.each([
    'plain answer',
    'use `[[reply:thread]]` to answer in a thread',
    '[[reply:dm]]\nhello',
    '',
    undefined,
  ])('leaves %j untouched', (content) => {
    expect(extractReplyPlacement(content)).toEqual({ content });
  });
});

describe('resolveReplyPlacement', () => {
  it('routes the reply to the picked target', () => {
    expect(resolveReplyPlacement('[[reply:channel]]\nshipped', targets)).toEqual({
      content: 'shipped',
      placement: 'channel',
      threadId: 'slack:C1',
    });
  });

  it('falls back to the default target without a directive', () => {
    expect(resolveReplyPlacement('a long investigation', targets)).toEqual({
      content: 'a long investigation',
      placement: 'thread',
      threadId: 'slack:C1:111.222',
    });
  });

  it('strips the directive even when the conversation offers no choice', () => {
    expect(resolveReplyPlacement('[[reply:channel]]\nshipped', undefined)).toEqual({
      content: 'shipped',
    });
  });
});
