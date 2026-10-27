import type { BotReplyPlacement } from '@lobechat/types';
import { BOT_REPLY_PLACEMENT_DIRECTIVE, BOT_REPLY_PLACEMENTS } from '@lobechat/types';

import type { ReplyPlacementTargets } from './platforms';

const PLACEMENTS = BOT_REPLY_PLACEMENTS.join('|');

/** `[[reply:thread]]` / `[[reply:channel]]` on a line of its own, at the start or end of the reply. */
const LEADING_DIRECTIVE = new RegExp(
  String.raw`^\s*\[\[\s*${BOT_REPLY_PLACEMENT_DIRECTIVE}\s*[:：]\s*(${PLACEMENTS})\s*\]\][^\S\n]*(?:\n|$)`,
  'i',
);
const TRAILING_DIRECTIVE = new RegExp(
  String.raw`(?:^|\n)[^\S\n]*\[\[\s*${BOT_REPLY_PLACEMENT_DIRECTIVE}\s*[:：]\s*(${PLACEMENTS})\s*\]\]\s*$`,
  'i',
);

export interface ExtractedReplyPlacement {
  /** The reply with the directive removed. */
  content?: string;
  placement?: BotReplyPlacement;
}

/**
 * Pull the placement directive out of the agent's reply. The directive is removed even when the
 * conversation offers no choice, so it never reaches the user.
 */
export const extractReplyPlacement = (content?: string): ExtractedReplyPlacement => {
  if (!content) return { content };

  for (const pattern of [LEADING_DIRECTIVE, TRAILING_DIRECTIVE]) {
    const match = pattern.exec(content);
    if (match) {
      return {
        content: content.replace(pattern, '').trim(),
        placement: match[1].toLowerCase() as BotReplyPlacement,
      };
    }
  }

  return { content };
};

export interface ResolvedReplyPlacement extends ExtractedReplyPlacement {
  /** Where to post the reply; `undefined` when the conversation offers no choice. */
  threadId?: string;
}

/** Strip the directive and pick the `platformThreadId` the reply goes to. */
export const resolveReplyPlacement = (
  content: string | undefined,
  targets: ReplyPlacementTargets | undefined,
): ResolvedReplyPlacement => {
  const extracted = extractReplyPlacement(content);
  if (!targets) return { content: extracted.content };

  const placement = extracted.placement ?? targets.default;
  return { content: extracted.content, placement, threadId: targets[placement] };
};
