import type { PendingNewTopicDirectory } from '@/store/chat/slices/topic/initialState';

/**
 * The project staging a send's NEW topic is born in, if any. Only a plain new
 * conversation of the agent it was staged on qualifies — never a send into an
 * existing topic, an isolated topic, a group or a direct @-mention route — so
 * one blank project conversation can't leak its project onto another topic.
 */
export const stagedNewTopic = (
  pending: PendingNewTopicDirectory | undefined,
  params: {
    context: { groupId?: string | null; isolatedTopic?: boolean; topicId?: string | null };
    directMentionRoute: unknown;
    ownerAgentId: string;
  },
): PendingNewTopicDirectory | undefined => {
  const { context, directMentionRoute, ownerAgentId } = params;
  return !context.topicId &&
    !context.isolatedTopic &&
    !context.groupId &&
    !directMentionRoute &&
    pending?.agentId === ownerAgentId
    ? pending
    : undefined;
};
