import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMediaPlaybackController } from './useMediaPlaybackController';

class FakeAudioElement {
  readonly pause = vi.fn();
  readonly play = vi.fn(async () => undefined);
  currentTime = 0;
  src = '';
  private readonly listeners = new Map<string, Set<EventListener>>();

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  removeAttribute(name: string): void {
    if (name === 'src') {
      this.src = '';
    }
  }

  emit(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(new Event(type));
    }
  }
}

describe('useMediaPlaybackController', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts idle with no active item', () => {
    const audio = new FakeAudioElement();
    const { result } = renderHook(() =>
      useMediaPlaybackController({
        createAudio: () => audio as unknown as HTMLAudioElement,
        createObjectUrl: () => 'blob:A',
        loadSource: vi.fn(),
        revokeObjectUrl: vi.fn(),
      })
    );

    expect(result.current.activeId).toBeNull();
    expect(result.current.playState).toBe('idle');
  });

  it('loads and plays a source when toggled', async () => {
    const audio = new FakeAudioElement();
    let resolveSource!: (source: { readonly audio: Uint8Array; readonly mimeType: string }) => void;
    const sourcePromise = new Promise<{ readonly audio: Uint8Array; readonly mimeType: string }>(
      (resolve) => {
        resolveSource = resolve;
      }
    );
    const loadSource = vi.fn(async () => sourcePromise);
    const { result } = renderHook(() =>
      useMediaPlaybackController({
        createAudio: () => audio as unknown as HTMLAudioElement,
        createObjectUrl: () => 'blob:A',
        loadSource,
        revokeObjectUrl: vi.fn(),
      })
    );

    await act(async () => {
      void result.current.toggle('A');
    });
    expect(result.current.activeId).toBe('A');
    expect(result.current.playState).toBe('loading');

    await act(async () => {
      resolveSource({ audio: new Uint8Array([1, 2, 3]), mimeType: 'audio/webm' });
    });
    await waitFor(() => expect(result.current.playState).toBe('playing'));
    expect(loadSource).toHaveBeenCalledTimes(1);
    expect(loadSource).toHaveBeenCalledWith('A');
    expect(audio.src).toBe('blob:A');
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it('pauses and resumes the same source without loading it twice', async () => {
    const audio = new FakeAudioElement();
    const loadSource = vi.fn(async () => ({
      audio: new Uint8Array([1, 2, 3]),
      mimeType: 'audio/webm',
    }));
    const { result } = renderHook(() =>
      useMediaPlaybackController({
        createAudio: () => audio as unknown as HTMLAudioElement,
        createObjectUrl: () => 'blob:A',
        loadSource,
        revokeObjectUrl: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.toggle('A');
    });
    await waitFor(() => expect(result.current.playState).toBe('playing'));

    act(() => {
      void result.current.toggle('A');
    });
    expect(result.current.playState).toBe('paused');
    expect(audio.pause).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.toggle('A');
    });
    await waitFor(() => expect(result.current.playState).toBe('playing'));
    expect(loadSource).toHaveBeenCalledTimes(1);
    expect(audio.play).toHaveBeenCalledTimes(2);
  });

  it('switches active source and revokes the previous object URL', async () => {
    const audio = new FakeAudioElement();
    const loadSource = vi.fn(async (id: string) => ({
      audio: new Uint8Array(id === 'A' ? [1] : [2]),
      mimeType: 'audio/webm',
    }));
    const revokeObjectUrl = vi.fn();
    let objectUrlIndex = 0;
    const { result } = renderHook(() =>
      useMediaPlaybackController({
        createAudio: () => audio as unknown as HTMLAudioElement,
        createObjectUrl: () => {
          objectUrlIndex += 1;
          return `blob:${objectUrlIndex}`;
        },
        loadSource,
        revokeObjectUrl,
      })
    );

    await act(async () => {
      await result.current.toggle('A');
    });
    await waitFor(() => expect(result.current.playState).toBe('playing'));

    await act(async () => {
      await result.current.toggle('B');
    });
    await waitFor(() => expect(result.current.activeId).toBe('B'));

    expect(loadSource).toHaveBeenCalledTimes(2);
    expect(audio.pause).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:1');
    expect(audio.src).toBe('blob:2');
  });

  it('returns to idle when audio ends', async () => {
    const audio = new FakeAudioElement();
    const revokeObjectUrl = vi.fn();
    const { result } = renderHook(() =>
      useMediaPlaybackController({
        createAudio: () => audio as unknown as HTMLAudioElement,
        createObjectUrl: () => 'blob:A',
        loadSource: vi.fn(async () => ({
          audio: new Uint8Array([1, 2, 3]),
          mimeType: 'audio/webm',
        })),
        revokeObjectUrl,
      })
    );

    await act(async () => {
      await result.current.toggle('A');
    });
    await waitFor(() => expect(result.current.playState).toBe('playing'));

    act(() => {
      audio.emit('ended');
    });

    expect(result.current.activeId).toBeNull();
    expect(result.current.playState).toBe('idle');
    expect(audio.src).toBe('');
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:A');
  });

  it('revokes the loaded object URL on unmount', async () => {
    const audio = new FakeAudioElement();
    const revokeObjectUrl = vi.fn();
    const { result, unmount } = renderHook(() =>
      useMediaPlaybackController({
        createAudio: () => audio as unknown as HTMLAudioElement,
        createObjectUrl: () => 'blob:A',
        loadSource: vi.fn(async () => ({
          audio: new Uint8Array([1, 2, 3]),
          mimeType: 'audio/webm',
        })),
        revokeObjectUrl,
      })
    );

    await act(async () => {
      await result.current.toggle('A');
    });
    await waitFor(() => expect(result.current.playState).toBe('playing'));
    unmount();

    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:A');
  });
});
