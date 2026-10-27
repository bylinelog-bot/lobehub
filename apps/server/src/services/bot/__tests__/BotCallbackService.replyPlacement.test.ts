import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BotCallbackBody } from '../BotCallbackService';
import { BotCallbackService } from '../BotCallbackService';

/**
 * Queue mode: the completion webhook carries the reply targets the agent could pick from, and the
 * agent's `[[reply:…]]` directive decides which messenger the reply goes out through.
 */

const messengers = vi.hoisted(() => new Map<string, Record<string, ReturnType<typeof vi.fn>>>());
const messengerFor = vi.hoisted(() => (threadId: string) => {
  let messenger = messengers.get(threadId);
  if (!messenger) {
    messenger = {
      createMessage: vi.fn().mockResolvedValue(undefined),
      deleteMessage: vi.fn().mockResolvedValue(undefined),
      editMessage: vi.fn().mockResolvedValue(undefined),
      removeReaction: vi.fn().mockResolvedValue(undefined),
    };
    messengers.set(threadId, messenger);
  }
  return messenger;
});

vi.mock('@/database/models/agentBotProvider', () => ({
  AgentBotProviderModel: {
    findByPlatformAndAppId: vi.fn().mockResolvedValue({ credentials: '{}', settings: {} }),
  },
}));
vi.mock('@/database/models/topic', () => ({
  TopicModel: vi.fn().mockImplementation(function () {
    return { findById: vi.fn().mockResolvedValue({ title: 'set' }), update: vi.fn() };
  }),
}));
vi.mock('@/server/modules/KeyVaultsEncrypt', () => ({
  KeyVaultsGateKeeper: {
    initWithEnvKey: vi
      .fn()
      .mockResolvedValue({ decrypt: vi.fn().mockResolvedValue({ plaintext: '{}' }) }),
  },
}));
vi.mock('@/server/modules/AgentRuntime/redis', () => ({
  getAgentRuntimeRedisClient: vi.fn().mockReturnValue(null),
}));
vi.mock('../AgentBridgeService', () => ({
  AgentBridgeService: { clearActiveThread: vi.fn() },
}));
vi.mock('../BotMessageRouter', () => ({
  getBotMessageRouter: () => ({ replayDeferredMessages: vi.fn() }),
}));
vi.mock('@/server/services/messenger/MessengerRouter', () => ({
  getMessengerRouter: () => ({ replayDeferredMessages: vi.fn() }),
}));
vi.mock('@/server/services/gateway/MessageGatewayClient', () => ({
  getMessageGatewayClient: vi.fn().mockReturnValue({ isEnabled: false }),
}));
vi.mock('@/server/services/systemAgent', () => ({
  SystemAgentService: vi.fn().mockImplementation(function () {
    return { generateTopicTitle: vi.fn() };
  }),
}));
vi.mock('@/server/services/messenger/installations', () => ({
  getInstallationStore: vi.fn(),
  messengerConnectionIdForUser: vi.fn(),
}));
vi.mock('@/server/services/messenger/platforms', () => ({
  messengerPlatformRegistry: { createBinder: vi.fn(), getPlatform: vi.fn() },
}));
vi.mock('../platforms', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  const client = {
    extractChatId: (id: string) => id,
    getMessenger: (threadId: string) => messengerFor(threadId),
  };
  return {
    ...actual,
    platformRegistry: {
      getPlatform: () => ({
        clientFactory: { createClient: () => client },
        credentials: [],
        id: 'slack',
        name: 'slack',
        schema: [],
      }),
    },
  };
});

const THREAD = 'slack:C1:111.222';
const CHANNEL = 'slack:C1';

const body = (overrides: Partial<BotCallbackBody> = {}): BotCallbackBody => ({
  applicationId: 'app-1',
  operationId: 'op-1',
  platformThreadId: THREAD,
  progressMessageId: 'placeholder-1',
  reason: 'done',
  replyPlacement: { channel: CHANNEL, default: 'thread', thread: THREAD },
  topicId: 'topic-1',
  type: 'completion',
  userId: 'user-1',
  userMessageId: '111.222',
  userPrompt: 'when is the release?',
  ...overrides,
});

describe('BotCallbackService reply placement (queue mode)', () => {
  let service: BotCallbackService;

  beforeEach(() => {
    messengers.clear();
    service = new BotCallbackService({} as any);
  });

  it('posts in the channel when the agent picks it, and drops the thread placeholder', async () => {
    await service.handleCallback(body({ lastAssistantContent: '[[reply:channel]]\nFriday.' }));

    expect(messengerFor(CHANNEL).createMessage).toHaveBeenCalledWith('Friday.');
    expect(messengerFor(THREAD).editMessage).not.toHaveBeenCalled();
    expect(messengerFor(THREAD).createMessage).not.toHaveBeenCalled();
    expect(messengerFor(THREAD).deleteMessage).toHaveBeenCalledWith('placeholder-1');
  });

  it('edits the placeholder in the thread when the agent picks the thread', async () => {
    await service.handleCallback(body({ lastAssistantContent: '[[reply:thread]]\nLong answer.' }));

    expect(messengerFor(THREAD).editMessage).toHaveBeenCalledWith('placeholder-1', 'Long answer.');
    expect(messengerFor(THREAD).deleteMessage).not.toHaveBeenCalled();
    expect(messengerFor(CHANNEL).createMessage).not.toHaveBeenCalled();
  });

  it('keeps the default target without a directive', async () => {
    await service.handleCallback(body({ lastAssistantContent: 'Long answer.' }));

    expect(messengerFor(THREAD).editMessage).toHaveBeenCalledWith('placeholder-1', 'Long answer.');
    expect(messengerFor(CHANNEL).createMessage).not.toHaveBeenCalled();
  });

  it('strips the directive when the conversation offered no choice', async () => {
    await service.handleCallback(
      body({ lastAssistantContent: '[[reply:channel]]\nFriday.', replyPlacement: undefined }),
    );

    expect(messengerFor(THREAD).editMessage).toHaveBeenCalledWith('placeholder-1', 'Friday.');
    expect(messengerFor(CHANNEL).createMessage).not.toHaveBeenCalled();
  });
});
