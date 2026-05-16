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

const verifiedActiveSnapshot: VoiceTranscriptionSettings = {
  enabled: true,
  apiKeyConfigured: true,
  apiKeyLastFour: '1234',
  lastValidatedAt: '2026-05-16T13:00:00.000Z',
  lastValidationCode: 'ok',
  lastValidationOk: true,
};

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

function installVoiceSettingsBridge(
  snapshot: VoiceTranscriptionSettings,
  overrides: Partial<VoiceSettingsBridge> = {}
) {
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
    ...overrides,
  };

  Object.defineProperty(window, 'reoWorkspace', {
    configurable: true,
    value: bridge,
  });

  return bridge;
}

function renderVoiceSettingsPanel(
  snapshot: VoiceTranscriptionSettings,
  overrides: Partial<VoiceSettingsBridge> = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return {
    bridge: installVoiceSettingsBridge(snapshot, overrides),
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

describe('VoiceSettingsPanel validating and verified-active', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('submits a trimmed key and locks controls while the save probe validates', async () => {
    const saveDeferred = createDeferred<{
      ok: true;
      value: { settings: VoiceTranscriptionSettings };
    }>();
    const saveVoiceTranscriptionApiKey = vi.fn(() => saveDeferred.promise);
    const { user } = renderVoiceSettingsPanel(enabledNoKeySnapshot, {
      saveVoiceTranscriptionApiKey,
    });
    const keyInput = await screen.findByLabelText('X-Api-Key');

    await user.type(keyInput, '  sk-test-1234  ');
    expect(keyInput).toHaveValue('  sk-test-1234  ');

    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(saveVoiceTranscriptionApiKey).toHaveBeenCalledWith({ apiKey: 'sk-test-1234' });
    expect(screen.getByRole('status')).toHaveTextContent('正在验证 X-Api-Key');
    expect(screen.getByRole('status')).not.toHaveTextContent('sk-test-1234');
    expect(screen.getByRole('button', { name: '验证中' })).toBeDisabled();
    expect(keyInput).toBeDisabled();
    expect(screen.getByRole('switch', { name: '启用流式语音识别' })).toBeDisabled();

    saveDeferred.resolve({
      ok: true,
      value: { settings: verifiedActiveSnapshot },
    });
  });

  it('clears the draft and renders verified projection after save succeeds', async () => {
    let snapshot = enabledNoKeySnapshot;
    const readVoiceTranscriptionSettings = vi.fn(async () => ({
      ok: true as const,
      value: { settings: snapshot },
    }));
    const saveVoiceTranscriptionApiKey = vi.fn(async () => {
      snapshot = verifiedActiveSnapshot;

      return {
        ok: true as const,
        value: { settings: verifiedActiveSnapshot },
      };
    });
    const { user } = renderVoiceSettingsPanel(enabledNoKeySnapshot, {
      readVoiceTranscriptionSettings,
      saveVoiceTranscriptionApiKey,
    });
    const keyInput = await screen.findByLabelText('X-Api-Key');

    await user.type(keyInput, '  sk-test-1234  ');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText(/已验证/)).toBeInTheDocument();
    expect(keyInput).toHaveValue('');
    expect(screen.getByText(/末 4 位 1234/)).toBeInTheDocument();
    expect(screen.queryByText('sk-test-1234')).not.toBeInTheDocument();
  });
});
