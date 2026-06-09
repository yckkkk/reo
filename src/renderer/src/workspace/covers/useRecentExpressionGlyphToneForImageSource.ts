import {
  fallbackRecentExpressionGlyphToneForSource,
  resolveRecentExpressionGlyphToneForImageSource,
  type RecentExpressionGlyphTone,
} from './recentExpressionGlyphTone';
import { useResolvedImageTone } from './useResolvedImageTone';

export function useRecentExpressionGlyphToneForImageSource(
  source: string
): RecentExpressionGlyphTone {
  return useResolvedImageTone(
    source,
    fallbackRecentExpressionGlyphToneForSource,
    resolveRecentExpressionGlyphToneForImageSource
  );
}
