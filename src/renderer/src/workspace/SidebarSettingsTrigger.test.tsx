import { QueryClientProvider } from '@tanstack/react-query';
import { render as renderTestingLibrary, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { voiceSettingsQueryKey } from '@/settings/voiceSettingsQueries';
import {
  createVoiceSettingsSnapshot,
  installPendingVoiceSettingsReadBridge,
} from '@/settings/voiceSettingsTestFixtures';
import { createReoQueryClient } from '../queryClient';
import { SidebarSettingsTrigger } from './SidebarSettingsTrigger';
import type { VoiceTranscriptionSettings } from './workspaceApi';

type SidebarSettingsTriggerTestOptions = {
  readonly seedVoiceSettings?: boolean;
  readonly voiceSettings?: VoiceTranscriptionSettings;
};

function renderSidebarSettingsTrigger(
  ui: ReactNode,
  {
    seedVoiceSettings = true,
    voiceSettings = createVoiceSettingsSnapshot(),
  }: SidebarSettingsTriggerTestOptions = {}
) {
  const queryClient = createReoQueryClient();

  if (seedVoiceSettings) {
    queryClient.setQueryData(voiceSettingsQueryKey(), voiceSettings);
  } else {
    installPendingVoiceSettingsReadBridge();
  }

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return renderTestingLibrary(ui, { wrapper: Wrapper });
}

describe('SidebarSettingsTrigger', () => {
  it('renders the settings button with a Chinese accessible name', () => {
    renderSidebarSettingsTrigger(
      <SidebarSettingsTrigger
        onOpenSettings={vi.fn()}
        onRecordingBlocked={vi.fn()}
        recordingActive={false}
      />
    );

    const button = screen.getByRole('button', { name: '设置' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('设置');
  });

  it('calls onOpenSettings when recording is not active', async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();
    const onRecordingBlocked = vi.fn();

    renderSidebarSettingsTrigger(
      <SidebarSettingsTrigger
        onOpenSettings={onOpenSettings}
        onRecordingBlocked={onRecordingBlocked}
        recordingActive={false}
      />
    );

    await user.click(screen.getByRole('button', { name: '设置' }));

    expect(onOpenSettings).toHaveBeenCalledOnce();
    expect(onRecordingBlocked).not.toHaveBeenCalled();
  });

  it('blocks the settings callback and emits the recording blocked callback while recording', async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();
    const onRecordingBlocked = vi.fn();

    renderSidebarSettingsTrigger(
      <SidebarSettingsTrigger
        onOpenSettings={onOpenSettings}
        onRecordingBlocked={onRecordingBlocked}
        recordingActive
      />
    );

    const button = screen.getByRole('button', { name: '设置' });
    expect(button).toHaveAttribute('aria-disabled', 'true');

    await user.click(button);

    expect(onOpenSettings).not.toHaveBeenCalled();
    expect(onRecordingBlocked).toHaveBeenCalledOnce();
  });

  it('renders a voice credentials dot inside the settings button for auth validation failure', () => {
    renderSidebarSettingsTrigger(
      <SidebarSettingsTrigger
        onOpenSettings={vi.fn()}
        onRecordingBlocked={vi.fn()}
        recordingActive={false}
      />,
      { voiceSettings: createVoiceSettingsSnapshot({ lastValidationCode: 'auth' }) }
    );

    const settingsButton = screen.getByRole('button', { name: '设置' });
    const dot = screen.getByTestId('voice-credentials-dot');

    expect(settingsButton).toContainElement(dot);
  });

  it('keeps the auth dot hidden from assistive tech and preserves the settings click owner', async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();
    const onRecordingBlocked = vi.fn();

    renderSidebarSettingsTrigger(
      <SidebarSettingsTrigger
        onOpenSettings={onOpenSettings}
        onRecordingBlocked={onRecordingBlocked}
        recordingActive={false}
      />,
      { voiceSettings: createVoiceSettingsSnapshot({ lastValidationCode: 'auth' }) }
    );

    const settingsButton = screen.getByRole('button', { name: '设置' });
    const dot = screen.getByTestId('voice-credentials-dot');

    expect(dot).toHaveAttribute('aria-hidden', 'true');
    expect(dot).toHaveClass('pointer-events-none');

    await user.click(settingsButton);

    expect(onOpenSettings).toHaveBeenCalledOnce();
    expect(onRecordingBlocked).not.toHaveBeenCalled();
  });

  it('keeps the auth dot visible while recording and preserves the blocked settings owner', async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();
    const onRecordingBlocked = vi.fn();

    renderSidebarSettingsTrigger(
      <SidebarSettingsTrigger
        onOpenSettings={onOpenSettings}
        onRecordingBlocked={onRecordingBlocked}
        recordingActive
      />,
      { voiceSettings: createVoiceSettingsSnapshot({ lastValidationCode: 'auth' }) }
    );

    const settingsButton = screen.getByRole('button', { name: '设置' });
    const dot = screen.getByTestId('voice-credentials-dot');

    expect(settingsButton).toHaveAttribute('aria-disabled', 'true');
    expect(settingsButton).toContainElement(dot);

    await user.click(settingsButton);

    expect(onOpenSettings).not.toHaveBeenCalled();
    expect(onRecordingBlocked).toHaveBeenCalledOnce();
  });

  it('does not add the auth dot to the keyboard tab order', async () => {
    const user = userEvent.setup();

    renderSidebarSettingsTrigger(
      <>
        <SidebarSettingsTrigger
          onOpenSettings={vi.fn()}
          onRecordingBlocked={vi.fn()}
          recordingActive={false}
        />
        <button type="button">下一个动作</button>
      </>,
      { voiceSettings: createVoiceSettingsSnapshot({ lastValidationCode: 'auth' }) }
    );

    const settingsButton = screen.getByRole('button', { name: '设置' });
    const nextButton = screen.getByRole('button', { name: '下一个动作' });
    const dot = screen.getByTestId('voice-credentials-dot');

    expect(dot).toHaveAttribute('aria-hidden', 'true');
    expect(dot).not.toHaveAttribute('tabindex');

    await user.tab();
    expect(settingsButton).toHaveFocus();

    await user.tab();
    expect(nextButton).toHaveFocus();
  });

  it.each([['ok' as const], ['network' as const]])(
    'does not render a voice credentials dot for %s validation state',
    (lastValidationCode) => {
      renderSidebarSettingsTrigger(
        <SidebarSettingsTrigger
          onOpenSettings={vi.fn()}
          onRecordingBlocked={vi.fn()}
          recordingActive={false}
        />,
        { voiceSettings: createVoiceSettingsSnapshot({ lastValidationCode }) }
      );

      expect(screen.queryByTestId('voice-credentials-dot')).not.toBeInTheDocument();
    }
  );

  it('does not render a voice credentials dot while voice settings are loading', () => {
    renderSidebarSettingsTrigger(
      <SidebarSettingsTrigger
        onOpenSettings={vi.fn()}
        onRecordingBlocked={vi.fn()}
        recordingActive={false}
      />,
      { seedVoiceSettings: false }
    );

    expect(screen.queryByTestId('voice-credentials-dot')).not.toBeInTheDocument();
  });
});
