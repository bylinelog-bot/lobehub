'use client';

import { Flexbox } from '@lobehub/ui';
import type { ReactNode } from 'react';
import { memo } from 'react';

import type { TopicPreview } from '@/services/message/topicPreview';

import WideScreenContainer from '../../../../WideScreenContainer';
import { ChatItem } from '../../../ChatItem';
import { useAgentMeta } from '../../../hooks';
import MessageContent from '../../../Messages/Assistant/components/MessageContent';
import { AssistantMessageExtra } from '../../../Messages/Assistant/Extra';
import ContentBlock from '../../../Messages/AssistantGroup/components/ContentBlock';
import EditedFilesCard from '../../../Messages/EditedFilesCard';
import GoalTaskCard from '../../../Messages/GoalTaskCard';
import { MessageWorkList } from '../../../Messages/MessageWorks';
import { groupAnswerProps, resolvePreviewLayout } from './layout';

interface PreviewTailProps {
  headerSlot?: ReactNode;
  overlayHeight: number;
  preview: TopicPreview;
}

// Paints the final answer where the real list will put it, so the swap only adds rows above.
const PreviewTail = memo<PreviewTailProps>(({ headerSlot, overlayHeight, preview }) => {
  const { message } = preview;
  const avatar = useAgentMeta(message.agentId);
  const { cardsBelow, showModelLine, worksAfterActions } = resolvePreviewLayout(preview);

  return (
    <Flexbox
      height={'100%'}
      justify={'flex-end'}
      style={{ minHeight: 0, overflow: 'hidden', paddingBottom: Math.max(24, overlayHeight + 12) }}
    >
      {headerSlot && <WideScreenContainer>{headerSlot}</WideScreenContainer>}
      <WideScreenContainer style={{ position: 'relative' }}>
        <ChatItem
          showTitle
          actions={<div style={{ height: '28px' }} />}
          afterActions={worksAfterActions && <MessageWorkList items={worksAfterActions} />}
          avatar={avatar}
          placement={'left'}
          time={message.createdAt}
          belowMessage={
            cardsBelow && (
              <Flexbox gap={8}>
                {cardsBelow.editedFiles.length > 0 && (
                  <EditedFilesCard entries={cardsBelow.editedFiles} />
                )}
                {cardsBelow.goals.length > 0 && <GoalTaskCard goals={cardsBelow.goals} />}
                {cardsBelow.works.length > 0 && <MessageWorkList items={cardsBelow.works} />}
              </Flexbox>
            )
          }
          messageExtra={
            showModelLine ? (
              <AssistantMessageExtra
                content={message.content}
                extra={message.extra}
                id={message.id}
                model={message.model ?? undefined}
                performance={(message.performance || message.metadata) ?? undefined}
                provider={message.provider ?? undefined}
                tools={message.tools}
                usage={(message.usage || message.metadata) ?? undefined}
              />
            ) : undefined
          }
        >
          {preview.kind === 'group' ? (
            <ContentBlock {...groupAnswerProps(message)} />
          ) : (
            <MessageContent {...message} />
          )}
        </ChatItem>
      </WideScreenContainer>
    </Flexbox>
  );
});

PreviewTail.displayName = 'PreviewTail';

export default PreviewTail;
