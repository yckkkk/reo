import {
  coverToneRequiresImageSampling,
  fallbackCoverToneForSource,
  resolveCoverToneForImageSource,
  type CoverTone,
} from './coverTone';
import { useResolvedImageTone } from './useResolvedImageTone';

export function useCoverToneForImageSource(source: string): CoverTone {
  return useResolvedImageTone(
    source,
    fallbackCoverToneForSource,
    resolveCoverToneForImageSource,
    coverToneRequiresImageSampling
  );
}
