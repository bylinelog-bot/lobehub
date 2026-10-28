import type { EnabledAiModel, EnabledProvider } from 'model-bank';

import type { AiProviderRuntimeConfig } from '@/types/aiProvider';

/** Channel routing runs on the server, so client-only providers cannot participate. */
export const decisionModelProviders = (
  models: EnabledAiModel[],
  providers: EnabledProvider[],
  runtimeConfig: Record<string, AiProviderRuntimeConfig>,
) =>
  providers
    .filter((provider) => !runtimeConfig[provider.id]?.fetchOnClient)
    .map((provider) => ({
      ...provider,
      name: provider.name || provider.id,
      children: models.filter(
        (model) =>
          model.providerId === provider.id &&
          model.type === 'decision' &&
          model.enabled !== false &&
          model.visible !== false,
      ),
    }))
    .filter((provider) => provider.children.length > 0);
