import { createHash } from 'node:crypto';

export function transcriptDigest(transcript: string): string {
  return createHash('sha256').update(transcript, 'utf8').digest('hex');
}
