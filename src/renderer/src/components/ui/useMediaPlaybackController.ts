import { useCallback, useEffect, useRef, useState } from 'react';

export type MediaPlaybackPlayState = 'idle' | 'loading' | 'playing' | 'paused';

export type MediaPlaybackSource = {
  readonly audio: Uint8Array | Blob;
  readonly mimeType: string;
};

export type UseMediaPlaybackControllerOptions = {
  readonly loadSource: (id: string) => Promise<MediaPlaybackSource>;
  readonly createAudio?: () => HTMLAudioElement;
  readonly createObjectUrl?: (blob: Blob) => string;
  readonly revokeObjectUrl?: (url: string) => void;
};

export type MediaPlaybackController = {
  readonly activeId: string | null;
  readonly playState: MediaPlaybackPlayState;
  readonly stop: () => void;
  readonly toggle: (id: string) => Promise<void>;
};

type LoadedAudioSource = {
  readonly id: string;
  readonly url: string;
};

function copyAudioBytesToArrayBuffer(audio: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(audio.byteLength);
  new Uint8Array(buffer).set(audio);
  return buffer;
}

const defaultCreateAudio = () => new Audio();
const defaultCreateObjectUrl = (blob: Blob) => URL.createObjectURL(blob);
const defaultRevokeObjectUrl = (url: string) => URL.revokeObjectURL(url);

export function useMediaPlaybackController({
  createAudio = defaultCreateAudio,
  createObjectUrl = defaultCreateObjectUrl,
  loadSource,
  revokeObjectUrl = defaultRevokeObjectUrl,
}: UseMediaPlaybackControllerOptions): MediaPlaybackController {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [playState, setPlayState] = useState<MediaPlaybackPlayState>('idle');
  const activeIdRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const createAudioRef = useRef(createAudio);
  const createObjectUrlRef = useRef(createObjectUrl);
  const loadedRef = useRef<LoadedAudioSource | null>(null);
  const loadSourceRef = useRef(loadSource);
  const playStateRef = useRef<MediaPlaybackPlayState>('idle');
  const requestGenerationRef = useRef(0);
  const revokeObjectUrlRef = useRef(revokeObjectUrl);

  useEffect(() => {
    createAudioRef.current = createAudio;
    createObjectUrlRef.current = createObjectUrl;
    loadSourceRef.current = loadSource;
    revokeObjectUrlRef.current = revokeObjectUrl;
  }, [createAudio, createObjectUrl, loadSource, revokeObjectUrl]);

  const setPlaybackState = useCallback(
    (nextActiveId: string | null, nextPlayState: MediaPlaybackPlayState) => {
      activeIdRef.current = nextActiveId;
      playStateRef.current = nextPlayState;
      setActiveId(nextActiveId);
      setPlayState(nextPlayState);
    },
    []
  );

  const releaseLoadedSource = useCallback(() => {
    const loaded = loadedRef.current;
    if (!loaded) {
      return;
    }
    revokeObjectUrlRef.current(loaded.url);
    loadedRef.current = null;
  }, []);

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = createAudioRef.current();
    }
    return audioRef.current;
  }, []);

  const stop = useCallback(() => {
    requestGenerationRef.current += 1;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute('src');
    }
    releaseLoadedSource();
    setPlaybackState(null, 'idle');
  }, [releaseLoadedSource, setPlaybackState]);

  useEffect(() => {
    const audio = ensureAudio();
    const handleEnded = () => {
      audio.currentTime = 0;
      audio.removeAttribute('src');
      releaseLoadedSource();
      setPlaybackState(null, 'idle');
    };
    audio.addEventListener('ended', handleEnded);

    return () => {
      requestGenerationRef.current += 1;
      audio.pause();
      audio.removeEventListener('ended', handleEnded);
      audio.removeAttribute('src');
      releaseLoadedSource();
      audioRef.current = null;
    };
  }, [ensureAudio, releaseLoadedSource, setPlaybackState]);

  const toggle = useCallback(
    async (id: string) => {
      const audio = ensureAudio();
      const loaded = loadedRef.current;
      const currentPlayState = playStateRef.current;

      if (activeIdRef.current === id && loaded?.id === id) {
        if (currentPlayState === 'playing') {
          audio.pause();
          setPlaybackState(id, 'paused');
          return;
        }
        if (currentPlayState === 'paused') {
          try {
            await Promise.resolve(audio.play());
            setPlaybackState(id, 'playing');
          } catch {
            setPlaybackState(id, 'paused');
          }
          return;
        }
        if (currentPlayState === 'loading') {
          return;
        }
      }

      requestGenerationRef.current += 1;
      const requestGeneration = requestGenerationRef.current;
      if (loaded) {
        audio.pause();
        audio.currentTime = 0;
        releaseLoadedSource();
      }

      setPlaybackState(id, 'loading');
      try {
        const source = await loadSourceRef.current(id);
        if (requestGenerationRef.current !== requestGeneration) {
          return;
        }
        const blob =
          source.audio instanceof Blob
            ? source.audio
            : new Blob([copyAudioBytesToArrayBuffer(source.audio)], { type: source.mimeType });
        const url = createObjectUrlRef.current(blob);
        loadedRef.current = { id, url };
        audio.src = url;
        await Promise.resolve(audio.play());
        if (requestGenerationRef.current === requestGeneration) {
          setPlaybackState(id, 'playing');
        }
      } catch {
        if (requestGenerationRef.current === requestGeneration) {
          releaseLoadedSource();
          audio.removeAttribute('src');
          setPlaybackState(null, 'idle');
        }
      }
    },
    [ensureAudio, releaseLoadedSource, setPlaybackState]
  );

  return { activeId, playState, stop, toggle };
}
