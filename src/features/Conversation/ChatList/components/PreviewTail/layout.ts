import type { TopicPreview } from '@/services/message/topicPreview';

type PreviewMessage = TopicPreview['message'];

// The group block reads its text from the conversation store unless overridden,
// and the store holds no messages while the preview shows.
export const groupAnswerProps = (message: PreviewMessage) => ({
  assistantId: message.id,
  content: message.content,
  contentOverride: message.content,
  disableEditing: true,
  domId: `${message.id}__answer`,
  error: message.error ?? undefined,
  hasToolsOverride: false,
  id: message.id,
  imageList: message.imageList,
  metadata: message.metadata ?? undefined,
  reasoning: message.reasoning ?? undefined,
  tools: message.tools,
});

export const resolvePreviewLayout = ({
  editedFiles,
  goals,
  kind,
  message,
  workRootOperationId,
  works,
}: TopicPreview) => {
  const roundWorks = workRootOperationId ? works : [];
  const hasCards = editedFiles.length > 0 || goals.length > 0 || roundWorks.length > 0;

  return {
    cardsBelow:
      kind === 'group' && hasCards ? { editedFiles, goals, works: roundWorks } : undefined,
    showModelLine: kind === 'single',
    worksAfterActions:
      kind === 'single' && message.metadata?.work?.rootOperationId && works.length > 0
        ? works
        : undefined,
  };
};
