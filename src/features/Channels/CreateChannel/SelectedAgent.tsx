import { agentDisplayName } from '@lobechat/types';
import { ActionIcon, Flexbox, Text } from '@lobehub/ui';
import * as stylex from '@stylexjs/stylex';
import { X } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';

import Avatar from '@/components/Avatar';
import { DEFAULT_AVATAR } from '@/const/meta';
import type { DeviceListResult } from '@/store/device/useDeviceList';

import type { ChannelAgentDraft } from './agentEnvironment';
import { EnvironmentIssue, environmentSummary } from './EnvironmentFields';
import { useChannelAgentDraft } from './useChannelAgentDraft';
import type { ChannelAgentOption } from './useChannelAgentOptions';

const styles = stylex.create({
  extra: { paddingInlineStart: 44, paddingInlineEnd: 8, paddingBlockEnd: 8, minWidth: 0 },
});

/** Channel options for a chosen Agent: inherit its own device and directory, never pick here. */
const INHERITED = { directoryOptional: true };

/**
 * A chosen Agent keeps its own device and directory, shown as one line. Per-channel changes
 * happen after creation, from the member list.
 */
export const SelectedAgent = ({
  agent,
  devices,
  draft: input,
  setDrafts,
}: {
  agent?: ChannelAgentOption;
  devices: DeviceListResult;
  draft: ChannelAgentDraft;
  setDrafts: Dispatch<SetStateAction<ChannelAgentDraft[]>>;
}) => {
  const { t } = useTranslation(['channel', 'chat']);
  const controls = useChannelAgentDraft(input, devices, setDrafts, INHERITED);
  const { draft } = controls;
  const name = agentDisplayName(agent, t('unnamedAgent'));
  const summary = draft.issue
    ? undefined
    : environmentSummary(draft, devices, t('environment.homeDirectory'));

  return (
    <Flexbox gap={4}>
      <Flexbox horizontal align="center" gap={8} padding={8}>
        <Avatar
          avatar={typeof agent?.avatar === 'string' ? agent.avatar : DEFAULT_AVATAR}
          background={agent?.backgroundColor ?? undefined}
          size={28}
        />
        <Text ellipsis style={{ flex: 1 }}>
          {name}
        </Text>
        <ActionIcon
          aria-label={t('group.removeMember', { ns: 'chat' })}
          icon={X}
          size="small"
          title={t('group.removeMember', { ns: 'chat' })}
          onClick={() =>
            setDrafts((current) => current.filter((item) => item.agentId !== draft.agentId))
          }
        />
      </Flexbox>
      {(summary || draft.issue) && (
        <Flexbox gap={8} {...stylex.props(styles.extra)}>
          {summary && (
            <Text ellipsis fontSize={12} title={summary} type="secondary">
              {summary}
            </Text>
          )}
          <EnvironmentIssue inherited controls={controls} />
        </Flexbox>
      )}
    </Flexbox>
  );
};
