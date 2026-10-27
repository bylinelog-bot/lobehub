import type { TaskDetailActivity } from '@lobechat/types';

/**
 * The run whose report is a completed task's conclusion — its newest run, when
 * that run reported anything. Undefined for a task that is not completed: while
 * the work is still ahead (or stopped short) the latest report is a progress
 * note, not what the task concluded. Undefined too for a completed task whose
 * newest run wrote nothing, so no "Conclusion" band ever claims a result that
 * was never written.
 */
export const resolveTaskConclusion = (
  /** The task detail carries its status as a plain string. */
  status: string | undefined,
  latestRun: TaskDetailActivity | undefined,
): TaskDetailActivity | undefined => {
  if (status !== 'completed' || !latestRun) return;
  if (!latestRun.content && !latestRun.summary) return;
  return latestRun;
};
