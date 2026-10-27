import { describe, expect, it } from 'vitest';

import type { TopicPreview } from '@/services/message/topicPreview';

import { groupAnswerProps, resolvePreviewLayout } from './layout';

const preview = (overrides: Partial<TopicPreview> = {}): TopicPreview =>
  ({
    editedFiles: [],
    goals: [],
    kind: 'group',
    message: { content: 'the final answer', id: 'msg_final', role: 'assistant' },
    status: 'ok',
    topicId: 'tpc_a',
    topicUpdatedAt: '2026-10-27T00:00:00.000Z',
    workRootOperationId: null,
    works: [],
    ...overrides,
  }) as TopicPreview;

describe('groupAnswerProps', () => {
  it('hands the answer text to the group block, which otherwise reads an empty store', () => {
    const props = groupAnswerProps(preview().message);

    expect(props.contentOverride).toBe('the final answer');
    expect(props.hasToolsOverride).toBe(false);
    expect(props.domId).toBe('msg_final__answer');
  });
});

describe('resolvePreviewLayout', () => {
  it('leaves the model line to the action row for a group answer', () => {
    expect(resolvePreviewLayout(preview()).showModelLine).toBe(false);
  });

  it('shows the model line under a single reply', () => {
    expect(resolvePreviewLayout(preview({ kind: 'single' })).showModelLine).toBe(true);
  });

  it("reserves the round's cards below a group answer", () => {
    const layout = resolvePreviewLayout(
      preview({
        editedFiles: [{ path: '/a.ts' }] as TopicPreview['editedFiles'],
        goals: [{ goalId: 'goal_1' }] as TopicPreview['goals'],
        workRootOperationId: 'op_1',
        works: [{ id: 'work_1' }] as TopicPreview['works'],
      }),
    );

    expect(layout.cardsBelow).toEqual({
      editedFiles: [{ path: '/a.ts' }],
      goals: [{ goalId: 'goal_1' }],
      works: [{ id: 'work_1' }],
    });
    expect(layout.worksAfterActions).toBeUndefined();
  });

  it('keeps works off a group answer whose round has no work root', () => {
    const layout = resolvePreviewLayout(
      preview({ works: [{ id: 'work_1' }] as TopicPreview['works'] }),
    );

    expect(layout.cardsBelow).toBeUndefined();
  });

  it('puts a single reply works after the action row', () => {
    const layout = resolvePreviewLayout(
      preview({
        kind: 'single',
        message: {
          content: 'answer',
          id: 'msg_final',
          metadata: { work: { rootOperationId: 'op_1' } },
          role: 'assistant',
        } as TopicPreview['message'],
        works: [{ id: 'work_1' }] as TopicPreview['works'],
      }),
    );

    expect(layout.worksAfterActions).toEqual([{ id: 'work_1' }]);
    expect(layout.cardsBelow).toBeUndefined();
  });
});
