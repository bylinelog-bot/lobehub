import type { TaskDetailActivity } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import { resolveTaskConclusion } from './resolveTaskConclusion';

const run = (overrides: Partial<TaskDetailActivity> = {}): TaskDetailActivity =>
  ({ id: 'topic-1', status: 'completed', type: 'topic', ...overrides }) as TaskDetailActivity;

describe('resolveTaskConclusion', () => {
  // Regression: a completed task opened on its instruction, with the run's
  // conclusion buried under the acceptance and the activity feed.
  it('is the newest run report of a completed task', () => {
    const latest = run({ content: 'final conclusion' });
    expect(resolveTaskConclusion('completed', latest)).toBe(latest);
  });

  it('accepts a run that only carries a summary', () => {
    const latest = run({ summary: 'one line' });
    expect(resolveTaskConclusion('completed', latest)).toBe(latest);
  });

  it('is nothing while the task is not completed', () => {
    const latest = run({ content: 'partial' });
    for (const status of ['backlog', 'running', 'paused', 'failed', 'canceled', 'scheduled']) {
      expect(resolveTaskConclusion(status, latest)).toBeUndefined();
    }
    expect(resolveTaskConclusion(undefined, latest)).toBeUndefined();
  });

  it('is nothing when the completed task has no run, or its run reported nothing', () => {
    expect(resolveTaskConclusion('completed', undefined)).toBeUndefined();
    expect(resolveTaskConclusion('completed', run())).toBeUndefined();
    expect(resolveTaskConclusion('completed', run({ content: '', summary: '' }))).toBeUndefined();
  });
});
