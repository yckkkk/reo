import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VoiceTranscriptionSettings } from '../workspace/workspaceApi';
import { VoiceSettingsPanel } from './VoiceSettingsPanel';

type VoiceSettingsBridge = Pick<
  Window['reoWorkspace'],
  | 'clearVoiceTranscriptionApiKey'
  | 'openVoiceTranscriptionProviderConsole'
  | 'readVoiceTranscriptionSettings'
  | 'regenerateImportedSpeechSynthesis'
  | 'saveVoiceTranscriptionApiKey'
  | 'setVoiceSpeechSynthesisSpeaker'
  | 'setVoiceTranscriptionEnabled'
  | 'validateVoiceTranscriptionCredentials'
>;

const defaultSpeaker = 'zh_female_vv_uranus_bigtts' as const;
const disabledNoKeySnapshot: VoiceTranscriptionSettings = {
  enabled: false,
  apiKeyConfigured: false,
  apiKeyLastFour: null,
  speechSynthesisSpeaker: defaultSpeaker,
  lastTranscriptionValidatedAt: null,
  lastTranscriptionValidationCode: null,
  lastTranscriptionValidationOk: null,
  lastSpeechSynthesisValidatedAt: null,
  lastSpeechSynthesisValidationCode: null,
  lastSpeechSynthesisValidationOk: null,
};

const enabledNoKeySnapshot: VoiceTranscriptionSettings = {
  ...disabledNoKeySnapshot,
  enabled: true,
};

const recentValidationIso = new Date(Date.now() - 60_000).toISOString();

const verifiedActiveSnapshot: VoiceTranscriptionSettings = {
  enabled: true,
  apiKeyConfigured: true,
  apiKeyLastFour: '1234',
  speechSynthesisSpeaker: defaultSpeaker,
  lastTranscriptionValidatedAt: recentValidationIso,
  lastTranscriptionValidationCode: 'ok',
  lastTranscriptionValidationOk: true,
  lastSpeechSynthesisValidatedAt: recentValidationIso,
  lastSpeechSynthesisValidationCode: 'ok',
  lastSpeechSynthesisValidationOk: true,
};

const disabledWithKeySnapshot: VoiceTranscriptionSettings = {
  ...verifiedActiveSnapshot,
  enabled: false,
};

const authFailedSnapshot: VoiceTranscriptionSettings = {
  enabled: true,
  apiKeyConfigured: true,
  apiKeyLastFour: '1234',
  speechSynthesisSpeaker: defaultSpeaker,
  lastTranscriptionValidatedAt: recentValidationIso,
  lastTranscriptionValidationCode: 'auth',
  lastTranscriptionValidationOk: false,
  lastSpeechSynthesisValidatedAt: recentValidationIso,
  lastSpeechSynthesisValidationCode: 'auth',
  lastSpeechSynthesisValidationOk: false,
};

const networkFailedSnapshot: VoiceTranscriptionSettings = {
  enabled: true,
  apiKeyConfigured: true,
  apiKeyLastFour: '1234',
  speechSynthesisSpeaker: defaultSpeaker,
  lastTranscriptionValidatedAt: recentValidationIso,
  lastTranscriptionValidationCode: 'network',
  lastTranscriptionValidationOk: null,
  lastSpeechSynthesisValidatedAt: recentValidationIso,
  lastSpeechSynthesisValidationCode: 'network',
  lastSpeechSynthesisValidationOk: null,
};

const unvalidatedConfiguredSnapshot: VoiceTranscriptionSettings = {
  ...verifiedActiveSnapshot,
  lastTranscriptionValidatedAt: null,
  lastTranscriptionValidationCode: null,
  lastTranscriptionValidationOk: null,
  lastSpeechSynthesisValidatedAt: null,
  lastSpeechSynthesisValidationCode: null,
  lastSpeechSynthesisValidationOk: null,
};

const staleVerifiedSnapshot: VoiceTranscriptionSettings = {
  ...verifiedActiveSnapshot,
  lastTranscriptionValidatedAt: '2026-05-08T13:00:00.000Z',
  lastSpeechSynthesisValidatedAt: '2026-05-08T13:00:00.000Z',
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
    setVoiceSpeechSynthesisSpeaker: vi.fn(async (payload) => ({
      ok: true as const,
      value: {
        settings: {
          ...snapshot,
          speechSynthesisSpeaker: payload.speaker,
        },
      },
    })),
    regenerateImportedSpeechSynthesis: vi.fn(async () => ({
      ok: true as const,
      value: {
        failed: 0,
        failedTargets: [],
        generated: 2,
        skipped: 0,
        speaker: defaultSpeaker,
        total: 2,
      },
    })),
    saveVoiceTranscriptionApiKey: vi.fn(),
    clearVoiceTranscriptionApiKey: vi.fn(),
    validateVoiceTranscriptionCredentials: vi.fn(),
    openVoiceTranscriptionProviderConsole: vi.fn(),
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
  overrides: Partial<VoiceSettingsBridge> = {},
  props: ComponentProps<typeof VoiceSettingsPanel> = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return {
    bridge: installVoiceSettingsBridge(snapshot, overrides),
    queryClient,
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={queryClient}>
        <VoiceSettingsPanel {...props} />
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

    expect(await screen.findByRole('switch', { name: '启用豆包语音' })).toHaveAttribute(
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

    expect(await screen.findByRole('switch', { name: '启用豆包语音' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByLabelText('X-Api-Key')).not.toBeDisabled();
    expect(
      screen.getByText('启用后需要 X-Api-Key 才能进行语音识别、录音转录和笔记语音生成')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '重新生成全部笔记语音' })).toBeDisabled();
  });

  it('opens the Volcengine console through the allowlisted workspace bridge', async () => {
    const openVoiceTranscriptionProviderConsole = vi.fn(async () => ({
      ok: true as const,
      value: {},
    }));
    const { user } = renderVoiceSettingsPanel(enabledNoKeySnapshot, {
      openVoiceTranscriptionProviderConsole,
    });

    await user.click(await screen.findByRole('button', { name: '打开火山引擎控制台' }));

    expect(openVoiceTranscriptionProviderConsole).toHaveBeenCalledWith();
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
    expect(
      screen.queryByText('启用后需要 X-Api-Key 才能进行语音识别、录音转录和笔记语音生成')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('sk-test-1234')).not.toBeInTheDocument();
  });

  it('uses an accessible visibility toggle without rendering the typed key as text', async () => {
    const { user } = renderVoiceSettingsPanel(enabledNoKeySnapshot);
    const keyInput = await screen.findByLabelText('X-Api-Key');

    await user.type(keyInput, 'sk-test-1234');
    await user.click(screen.getByRole('button', { name: '显示 X-Api-Key' }));

    expect(keyInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: '隐藏 X-Api-Key' })).toBeInTheDocument();
    expect(screen.queryByText('sk-test-1234')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '隐藏 X-Api-Key' }));

    expect(keyInput).toHaveAttribute('type', 'password');
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
    expect(screen.getByRole('switch', { name: '启用豆包语音' })).toBeDisabled();

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

    expect(await screen.findByText(/语音识别：已验证/)).toBeInTheDocument();
    expect(screen.getByText(/语音生成：已验证/)).toBeInTheDocument();
    expect(keyInput).toHaveValue('');
    expect(screen.getByText(/末 4 位 1234/)).toBeInTheDocument();
    expect(screen.queryByText('sk-test-1234')).not.toBeInTheDocument();
  });

  it('clears the saved draft even when validation returns an auth failure projection', async () => {
    let snapshot = enabledNoKeySnapshot;
    const readVoiceTranscriptionSettings = vi.fn(async () => ({
      ok: true as const,
      value: { settings: snapshot },
    }));
    const saveVoiceTranscriptionApiKey = vi.fn(async () => {
      snapshot = authFailedSnapshot;

      return {
        ok: true as const,
        value: { settings: authFailedSnapshot },
      };
    });
    const { user } = renderVoiceSettingsPanel(enabledNoKeySnapshot, {
      readVoiceTranscriptionSettings,
      saveVoiceTranscriptionApiKey,
    });
    const keyInput = await screen.findByLabelText('X-Api-Key');

    await user.type(keyInput, 'sk-test-1234');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(
      await screen.findByText('语音识别：X-Api-Key 验证失败，请确认密钥后重试。')
    ).toBeInTheDocument();
    expect(keyInput).toHaveValue('');
    expect(screen.queryByText('sk-test-1234')).not.toBeInTheDocument();
  });

  it('shows a safe mutation error without rendering the draft key', async () => {
    const saveVoiceTranscriptionApiKey = vi.fn(async () => ({
      ok: false as const,
      error: {
        code: 'ERR_VOICE_SETTINGS_WRITE_FAILED' as const,
        message: '语音设置无法写入本地配置。',
      },
    }));
    const { user } = renderVoiceSettingsPanel(enabledNoKeySnapshot, {
      saveVoiceTranscriptionApiKey,
    });
    const keyInput = await screen.findByLabelText('X-Api-Key');

    await user.type(keyInput, 'sk-test-1234');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('语音设置无法写入本地配置。')).toBeInTheDocument();
    expect(keyInput).toHaveValue('sk-test-1234');
    expect(screen.queryByText('sk-test-1234')).not.toBeInTheDocument();
  });

  it('clears the draft when the key was written but validation state was not refreshed', async () => {
    let snapshot = enabledNoKeySnapshot;
    const writtenKeySnapshot: VoiceTranscriptionSettings = {
      ...enabledNoKeySnapshot,
      apiKeyConfigured: true,
      apiKeyLastFour: '1234',
    };
    const readVoiceTranscriptionSettings = vi.fn(async () => ({
      ok: true as const,
      value: { settings: snapshot },
    }));
    const saveVoiceTranscriptionApiKey = vi.fn(async () => {
      snapshot = writtenKeySnapshot;

      return {
        ok: false as const,
        error: {
          code: 'ERR_VOICE_SETTINGS_WRITE_FAILED' as const,
          dataRetention: 'file-written-index-stale' as const,
          message: 'validation state write failed',
        },
      };
    });
    const { user } = renderVoiceSettingsPanel(enabledNoKeySnapshot, {
      readVoiceTranscriptionSettings,
      saveVoiceTranscriptionApiKey,
    });
    const keyInput = await screen.findByLabelText('X-Api-Key');

    await user.type(keyInput, 'sk-test-1234');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('语音设置无法写入本地配置。')).toBeInTheDocument();
    await waitFor(() => expect(keyInput).toHaveValue(''));
    expect(screen.getByText(/末 4 位 1234/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '显示 X-Api-Key' })).not.toBeInTheDocument();
    expect(screen.queryByText('sk-test-1234')).not.toBeInTheDocument();
  });

  it('regenerates all imported note speech with the current speaker and active workspace', async () => {
    const regenerateImportedSpeechSynthesis = vi.fn(async () => ({
      ok: true as const,
      value: {
        failed: 0,
        failedTargets: [],
        generated: 3,
        skipped: 0,
        speaker: 'zh_female_vv_uranus_bigtts' as const,
        total: 3,
      },
    }));
    const { user } = renderVoiceSettingsPanel(
      verifiedActiveSnapshot,
      { regenerateImportedSpeechSynthesis },
      { activeWorkspace: { workspaceHandle: 'wh_1', workspaceId: 'ws_1' } }
    );

    await user.click(await screen.findByRole('button', { name: '重新生成全部笔记语音' }));

    expect(regenerateImportedSpeechSynthesis).toHaveBeenCalledWith({
      activeWorkspace: { workspaceHandle: 'wh_1', workspaceId: 'ws_1' },
      mode: 'all',
      speaker: 'zh_female_vv_uranus_bigtts',
    });
    expect(await screen.findByText('已生成 3 项，失败 0 项，跳过 0 项。')).toBeInTheDocument();
  });

  it('spins the regenerate icon while imported note speech is being replaced', async () => {
    const regenerateDeferred = createDeferred<{
      ok: true;
      value: {
        failed: number;
        failedTargets: [];
        generated: number;
        skipped: number;
        speaker: typeof defaultSpeaker;
        total: number;
      };
    }>();
    const regenerateImportedSpeechSynthesis = vi.fn(() => regenerateDeferred.promise);
    const { user } = renderVoiceSettingsPanel(verifiedActiveSnapshot, {
      regenerateImportedSpeechSynthesis,
    });

    await user.click(await screen.findByRole('button', { name: '重新生成全部笔记语音' }));

    const pendingButton = screen.getByRole('button', { name: '重新生成中' });
    expect(pendingButton).toBeDisabled();
    expect(pendingButton.querySelector('svg')).toHaveClass('size-16', 'motion-safe:animate-spin');

    regenerateDeferred.resolve({
      ok: true,
      value: {
        failed: 0,
        failedTargets: [],
        generated: 1,
        skipped: 0,
        speaker: defaultSpeaker,
        total: 1,
      },
    });
  });

  it('does not report settings as blocking while imported note speech regeneration runs', async () => {
    const regenerateDeferred = createDeferred<{
      ok: true;
      value: {
        failed: number;
        failedTargets: [];
        generated: number;
        skipped: number;
        speaker: typeof defaultSpeaker;
        total: number;
      };
    }>();
    const onBusyChange = vi.fn();
    const regenerateImportedSpeechSynthesis = vi.fn(() => regenerateDeferred.promise);
    const { user } = renderVoiceSettingsPanel(
      verifiedActiveSnapshot,
      { regenerateImportedSpeechSynthesis },
      { onBusyChange }
    );

    await user.click(await screen.findByRole('button', { name: '重新生成全部笔记语音' }));

    expect(screen.getByRole('button', { name: '重新生成中' })).toBeDisabled();
    expect(onBusyChange).not.toHaveBeenCalledWith(true);

    regenerateDeferred.resolve({
      ok: true,
      value: {
        failed: 0,
        failedTargets: [],
        generated: 1,
        skipped: 0,
        speaker: defaultSpeaker,
        total: 1,
      },
    });
  });
});

describe('VoiceSettingsPanel remaining key states', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows an auth failure as a safe red retry state without rendering the full key', async () => {
    renderVoiceSettingsPanel(authFailedSnapshot);

    expect(
      await screen.findByText('语音识别：X-Api-Key 验证失败，请确认密钥后重试。')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
    expect(screen.queryByText('sk-test-1234')).not.toBeInTheDocument();
  });

  it('shows a network failure as an amber retry state while preserving configured-key projection', async () => {
    renderVoiceSettingsPanel(networkFailedSnapshot);

    expect(
      await screen.findByText('语音识别：暂时无法连接豆包服务，请稍后重试。')
    ).toBeInTheDocument();
    expect(screen.getByText(/末 4 位 1234/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
  });

  it('allows an existing configured key with missing TTS validation to be verified without retyping it', async () => {
    const validateVoiceTranscriptionCredentials = vi.fn(async () => ({
      ok: true as const,
      value: { code: 'ok' as const },
    }));
    const { user } = renderVoiceSettingsPanel(unvalidatedConfiguredSnapshot, {
      validateVoiceTranscriptionCredentials,
    });

    await screen.findByText(/末 4 位 1234/);
    await user.click(screen.getByRole('button', { name: '验证' }));

    expect(validateVoiceTranscriptionCredentials).toHaveBeenCalledWith(undefined);
  });

  it('keeps a configured key when disabled and locks the password input', async () => {
    renderVoiceSettingsPanel(disabledWithKeySnapshot);

    const input = await screen.findByLabelText('X-Api-Key');

    expect(screen.getByRole('switch', { name: '启用豆包语音' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('placeholder', '输入新的 X-Api-Key 以替换当前密钥');
    expect(screen.getByText(/末 4 位 1234/)).toBeInTheDocument();
    expect(screen.queryByText(/已验证/)).not.toBeInTheDocument();
  });

  it('does not imply that a saved key can be revealed when the replacement draft is empty', async () => {
    renderVoiceSettingsPanel(verifiedActiveSnapshot);

    await screen.findByLabelText('X-Api-Key');

    expect(screen.queryByRole('button', { name: '显示 X-Api-Key' })).not.toBeInTheDocument();
    expect(
      screen.getByText(/此密钥同时用于流式语音识别、录音文件转录和笔记语音生成/)
    ).toBeInTheDocument();
  });

  it('updates the note speech synthesis speaker through the voice settings bridge', async () => {
    const setVoiceSpeechSynthesisSpeaker = vi.fn(async () => ({
      ok: true as const,
      value: {
        settings: {
          ...verifiedActiveSnapshot,
          speechSynthesisSpeaker: 'zh_male_m191_uranus_bigtts' as const,
        },
      },
    }));
    const { queryClient, user } = renderVoiceSettingsPanel(verifiedActiveSnapshot, {
      setVoiceSpeechSynthesisSpeaker,
    });

    await user.click(await screen.findByRole('combobox', { name: '语音音色' }));
    await user.click(await screen.findByRole('option', { name: '云舟' }));

    expect(setVoiceSpeechSynthesisSpeaker).toHaveBeenCalledWith({
      speaker: 'zh_male_m191_uranus_bigtts',
    });
    await waitFor(() => {
      expect(queryClient.getQueryData(['settings', 'voice'])).toMatchObject({
        speechSynthesisSpeaker: 'zh_male_m191_uranus_bigtts',
      });
    });
  });

  it('marks an old successful validation as stale and allows revalidation without polling', async () => {
    const validateVoiceTranscriptionCredentials = vi.fn(async () => ({
      ok: true as const,
      value: { code: 'ok' as const },
    }));
    const { user } = renderVoiceSettingsPanel(staleVerifiedSnapshot, {
      validateVoiceTranscriptionCredentials,
    });

    expect(await screen.findByText(/语音识别：上次验证 \d+ 天前/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '重新验证' }));

    expect(validateVoiceTranscriptionCredentials).toHaveBeenCalledWith(undefined);
  });

  it('clears the configured key only after accessible confirmation and seeds the latest settings', async () => {
    const clearVoiceTranscriptionApiKey = vi.fn(async () => ({
      ok: true as const,
      value: { settings: disabledNoKeySnapshot },
    }));
    const { queryClient, user } = renderVoiceSettingsPanel(verifiedActiveSnapshot, {
      clearVoiceTranscriptionApiKey,
    });

    await user.click(await screen.findByRole('button', { name: '清除 X-Api-Key' }));

    expect(screen.getByRole('alertdialog', { name: '清除 X-Api-Key？' })).toBeInTheDocument();
    expect(
      screen.getByText('清除后，录音实时转写、录音文件转录和笔记语音生成都不会再使用这枚密钥。')
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '清除' }));

    expect(clearVoiceTranscriptionApiKey).toHaveBeenCalledWith(undefined);
    await waitFor(() => {
      expect(queryClient.getQueryData(['settings', 'voice'])).toEqual(disabledNoKeySnapshot);
    });
  });
});
