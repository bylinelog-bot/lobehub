import { toast } from '@lobehub/ui';
import { useTranslation } from 'react-i18next';

import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { useProjectDirectoryStore } from '@/store/projectWorkingDirectory';

import { getProjectTopicPath } from '../Layout/navigation';
import { startProjectTopicDraft } from './startProjectTopicDraft';

/**
 * Every project "new topic" goes straight into the agent's conversation, never
 * through a picker, and creates nothing up front: it opens a blank draft — on a
 * directory the agent can run in, else on the project alone — and the first
 * message creates the topic. Only `bindDirectoryId`, a directory the caller
 * names that a draft can't stage on (e.g. read-only), starts the topic there.
 */
export const useStartProjectTopic = (projectId: string | undefined) => {
  const { t } = useTranslation('project');
  const navigate = useWorkspaceAwareNavigate();
  const startDirectoryTopic = useProjectDirectoryStore((s) => s.startTopic);

  return async ({
    agentId,
    bindDirectoryId,
    directoryId,
  }: {
    agentId: string;
    bindDirectoryId?: string;
    directoryId?: string;
  }) => {
    if (!projectId) return;
    if (!bindDirectoryId) {
      startProjectTopicDraft({ agentId, directoryId, navigate, projectId });
      return;
    }
    try {
      const topic = await startDirectoryTopic(bindDirectoryId, agentId, t('directories.untitled'));
      navigate(getProjectTopicPath(projectId, topic.id));
    } catch (error) {
      console.error('Failed to start a project topic', error);
      toast.error(t('overview.sendFailed'));
    }
  };
};
