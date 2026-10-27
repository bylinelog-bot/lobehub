'use client';

import { cssVar, Flexbox, Icon, Text } from '@lobehub/ui';
import { ClipboardCheck } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { useTaskStore } from '@/store/task';
import { taskActivitySelectors, taskDetailSelectors } from '@/store/task/selectors';

import { resolveTaskConclusion } from './resolveTaskConclusion';
import TaskRunReport from './TaskRunReport';

/**
 * What a completed task concluded, at the head of its detail.
 *
 * Once a task is done, the reader opening it wants the outcome, not the
 * contract that produced it: the instruction is what was asked, and after
 * completion it is background. The newest run's report is the conclusion, so
 * it leads the body and the instruction, acceptance and history follow.
 *
 * Which run counts, and when, is `resolveTaskConclusion`; nothing renders when
 * it yields no run — the activity feed already carries that history.
 */
const TaskConclusion = memo(() => {
  const { t } = useTranslation('chat');
  const status = useTaskStore(taskDetailSelectors.activeTaskStatus);
  const latestRun = useTaskStore(taskActivitySelectors.activeTaskLatestTopic);

  const conclusion = resolveTaskConclusion(status, latestRun);
  if (!conclusion) return null;

  return (
    <Flexbox gap={8}>
      <Flexbox horizontal align={'center'} gap={8} paddingBlock={4} paddingInline={8}>
        <Icon color={cssVar.colorTextDescription} icon={ClipboardCheck} size={16} />
        <Text color={cssVar.colorTextSecondary} fontSize={13} weight={500}>
          {t('taskDetail.conclusion')}
        </Text>
      </Flexbox>
      <Flexbox paddingBlock={4} paddingInline={12}>
        <TaskRunReport activity={conclusion} />
      </Flexbox>
    </Flexbox>
  );
});

TaskConclusion.displayName = 'TaskConclusion';

export default TaskConclusion;
