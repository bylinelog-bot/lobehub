// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageModel } from '@/database/models/message';
import { ProjectModel } from '@/database/models/project';
import { TopicRepository } from '@/database/repositories/topic';
import { AiChatService } from '@/server/services/aiChat';

import { aiChatRouter } from '../aiChat';

vi.mock('@/server/routers/lambda/_helpers/resolveContext', () => ({
  resolveContext: vi.fn(async (input) => ({
    ...input,
    agentId: input.agentId ?? null,
    sessionId: input.sessionId ?? null,
  })),
}));
vi.mock('@/database/models/agent');
vi.mock('@/database/models/message');
vi.mock('@/database/models/project');
vi.mock('@/database/models/thread');
vi.mock('@/database/repositories/topic');
vi.mock('@/server/services/aiChat');
vi.mock('@/server/services/file', () => ({ FileService: vi.fn() }));
vi.mock('@/server/modules/ModelRuntime', () => ({ initModelRuntimeFromDB: vi.fn() }));

// Review feedback: a project "new topic" without a working directory now opens
// a blank conversation, so the client-runtime first send creates the topic and
// must bind it to the project — only one the caller can read.
describe('aiChat.sendMessageInServer new topic in a project', () => {
  const createTopic = vi.fn();
  const findProject = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    createTopic.mockResolvedValue({ id: 'tpc_1' });
    vi.mocked(TopicRepository).mockImplementation(function () {
      return { create: createTopic } as any;
    });
    vi.mocked(ProjectModel).mockImplementation(function () {
      return { findById: findProject } as any;
    });
    const create = vi.fn().mockResolvedValue({ id: 'msg_1' });
    vi.mocked(MessageModel).mockImplementation(function () {
      return {
        create,
        createUserAndAssistantMessages: vi.fn(async () => ({
          assistantMessage: { id: 'msg_2' },
          userMessage: { id: 'msg_1' },
        })),
        getLatestSpineMessageId: vi.fn(),
        isMessageDescendantOf: vi.fn().mockResolvedValue(true),
      } as any;
    });
    vi.mocked(AiChatService).mockImplementation(function () {
      return {
        getMessagesAndTopics: vi.fn().mockResolvedValue({ messages: [], topics: [] }),
      } as any;
    });
  });

  const send = (projectId: string) =>
    aiChatRouter.createCaller({ userId: 'u1' } as any).sendMessageInServer({
      newAssistantMessage: { model: 'gpt-4o', provider: 'openai' },
      newTopic: { projectId, title: 'T' },
      newUserMessage: { content: 'hi' },
      sessionId: 's1',
    } as any);

  it('creates the topic inside a readable project', async () => {
    findProject.mockResolvedValue({ id: 'pro_1' });

    await send('pro_1');

    expect(findProject).toHaveBeenCalledWith('pro_1');
    expect(createTopic).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'pro_1', title: 'T' }),
      undefined,
    );
  });

  it('refuses a project the caller cannot read before creating anything', async () => {
    findProject.mockResolvedValue(undefined);

    await expect(send('pro_other')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(createTopic).not.toHaveBeenCalled();
  });
});
