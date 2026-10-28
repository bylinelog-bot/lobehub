import { describe, expect, it } from 'vitest';

import { stagedNewTopic } from './stagedNewTopic';

const project = { agentId: 'agt_1', projectId: 'pro_1' };
const directory = { agentId: 'agt_1', projectWorkingDirectoryId: 'pwd_1' };
const plain = { context: {}, directMentionRoute: undefined, ownerAgentId: 'agt_1' };

describe('stagedNewTopic', () => {
  it('applies a directory or a project-only staging to a new conversation of its agent', () => {
    expect(stagedNewTopic(directory, plain)).toBe(directory);
    expect(stagedNewTopic(project, plain)).toBe(project);
  });

  it('never lands on another agent, an existing topic, a group or a mention route', () => {
    expect(stagedNewTopic(project, { ...plain, ownerAgentId: 'agt_2' })).toBeUndefined();
    expect(stagedNewTopic(project, { ...plain, context: { topicId: 'tpc_1' } })).toBeUndefined();
    expect(stagedNewTopic(project, { ...plain, context: { groupId: 'grp_1' } })).toBeUndefined();
    expect(stagedNewTopic(project, { ...plain, context: { isolatedTopic: true } })).toBeUndefined();
    expect(stagedNewTopic(project, { ...plain, directMentionRoute: {} })).toBeUndefined();
    expect(stagedNewTopic(undefined, plain)).toBeUndefined();
  });
});
