// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(function () {
    return {};
  }),
}));

const { createTopic, findProject } = vi.hoisted(() => ({
  createTopic: vi.fn(),
  findProject: vi.fn(),
}));
vi.mock('@/database/repositories/topic', () => ({
  TopicRepository: vi.fn(function () {
    return { create: createTopic };
  }),
}));
vi.mock('@/database/models/project', () => ({
  ProjectModel: vi.fn(function () {
    return { findById: findProject };
  }),
}));
vi.mock('../_helpers/resolveContext', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveContextWithAgentId: vi.fn(async () => ({ agentId: 'agt_1', sessionId: 'ssn_1' })),
}));
vi.mock('../_helpers/conversationResourceGuard', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  assertCanUseConversationTargets: vi.fn(),
}));
vi.mock('../_helpers/shareVisitorTargetGuard', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  assertCreatorMessageTargets: vi.fn(),
}));

const { topicRouter } = await import('./index');

const create = (projectId: string) =>
  topicRouter
    .createCaller({ userId: 'user-1' } as any)
    .createTopic({ agentId: 'agt_1', projectId, title: 'Draft' });

// A blank project conversation opened without a working directory stages its
// project alone; the deferred row must be born inside it, never in a project
// the caller can't read.
describe('topic.createTopic with a project and no directory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createTopic.mockResolvedValue({ id: 'tpc_1' });
  });

  it('binds the new row to a readable project', async () => {
    findProject.mockResolvedValue({ id: 'pro_1' });

    await expect(create('pro_1')).resolves.toBe('tpc_1');
    expect(createTopic).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'pro_1' }));
  });

  it('drops a project the caller cannot read, like an unresolvable directory', async () => {
    findProject.mockResolvedValue(undefined);

    await create('pro_other');
    expect(createTopic).toHaveBeenCalledWith(
      expect.not.objectContaining({ projectId: expect.anything() }),
    );
  });
});
