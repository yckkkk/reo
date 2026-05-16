import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VoiceTranscriptionSettings } from '../workspace/workspaceApi';
import { VoiceSettingsPanel } from './VoiceSettingsPanel';

type VoiceSettingsBridge = Pick<
  Window['reoWorkspace'],
  | 'clearVoiceTranscriptionApiKey'
  | 'openExternalUrl'
  | 'readVoiceTranscriptionSettings'
  | 'saveVoiceTranscriptionApiKey'
  | 'setVoiceTranscriptionEnabled'
  | 'validateVoiceTranscriptionCredentials'
>;

const disabledNoKeySnapshot: VoiceTranscriptionSettings = {
  enabled: false,
  apiKeyConfigured: false,
  apiKeyLastFour: null,
  lastValidatedAt: null,
  lastValidationCode: null,
  lastValidationOk: null,
};

const enabledNoKeySnapshot: VoiceTranscriptionSettings = {
  ...disabledNoKeySnapshot,
  enabled: true,
};

function installVoiceSettingsBridge(snapshot: VoiceTranscriptionSettings) {
  const bridge: VoiceSettingsBridge = {
    readVoiceTranscriptionSettings: vi.fn(async () => ({
      ok: true as const,
      value: { settings: snapshot },
    })),
    setVoiceTranscriptionEnabled: vi.fn(async (payload) => ({
      ok: true as const,
      value: {
        settings: {
          ...snapshot,
          enabled: payload.enabled,
        },
      },
    })),
    saveVoiceTranscriptionApiKey: vi.fn(),
    clearVoiceTranscriptionApiKey: vi.fn(),
    validateVoiceTranscriptionCredentials: vi.fn(),
    openExternalUrl: vi.fn(),
  };

  Object.defineProperty(window, 'reoWorkspace', {
    configurable: true,
    value: bridge,
  });

  return bridge;
}

function renderVoiceSettingsPanel(snapshot: VoiceTranscriptionSettings) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return {
    bridge: installVoiceSettingsBridge(snapshot),
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={queryClient}>
        <VoiceSettingsPanel />
      </QueryClientProvider>
    ),
  };
}

describe('VoiceSettingsPanel disabled-no-key', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('follows the disabled settings snapshot and locks key entry', async () => {
    renderVoiceSettingsPanel(disabledNoKeySnapshot);

    expect(await screen.findByRole('switch', { name: '启用流式语音识别' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
    expect(screen.getByLabelText('X-Api-Key')).toBeDisabled();
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
  });
});

describe('VoiceSettingsPanel enabled-no-key', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('follows the enabled settings snapshot and requires a key', async () => {
    renderVoiceSettingsPanel(enabledNoKeySnapshot);

    expect(await screen.findByRole('switch', { name: '启用流式语音识别' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByLabelText('X-Api-Key')).not.toBeDisabled();
    expect(screen.getByText('启用后需要 X-Api-Key 才能生成转录')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
  });
});

describe('VoiceSettingsPanel editing-with-key', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the typed key only in the password input value and enables save', async () => {
    const { user } = renderVoiceSettingsPanel(enabledNoKeySnapshot);
    const keyInput = await screen.findByLabelText('X-Api-Key');

    await user.type(keyInput, '  sk-test-1234  ');

    expect(keyInput).toHaveAttribute('type', 'password');
    expect(keyInput).toHaveValue('  sk-test-1234  ');
    expect(screen.getByRole('button', { name: '保存' })).toBeEnabled();
    expect(screen.queryByText('启用后需要 X-Api-Key 才能生成转录')).not.toBeInTheDocument();
    expect(screen.queryByText('sk-test-1234')).not.toBeInTheDocument();
  });
});
