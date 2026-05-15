import { useEffect, useRef } from 'react';
import { Agentation } from 'agentation';

const AGENTATION_ENDPOINT = 'http://localhost:4747';
const AGENTATION_ENABLED_BY_DEFAULT = import.meta.env.DEV && import.meta.env.MODE !== 'test';
const AGENTATION_REARRANGE_PREFIX = 'agentation-rearrange-';
const AGENTATION_SESSION_PREFIX = 'agentation-session-';
const LAYOUT_NOTE_SYNC_INTERVAL_MS = 500;

type AgentationRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

type AgentationLayoutSection = {
  readonly id: string;
  readonly label: string;
  readonly selector: string;
  readonly tagName: string;
  readonly note?: string;
  readonly originalRect: AgentationRect;
  readonly currentRect: AgentationRect;
};

type AgentationRearrangeState = {
  readonly detectedAt: number;
  readonly originalOrder: readonly string[];
  readonly sections: readonly AgentationLayoutSection[];
};

export type DevAgentationProps = {
  readonly enabled?: boolean;
  readonly endpoint?: string;
};

function copyWithSelectionFallback(output: string): boolean {
  const textArea = document.createElement('textarea');
  textArea.value = output;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  textArea.style.top = '0';

  document.body.append(textArea);
  textArea.select();

  try {
    return document.execCommand('copy');
  } finally {
    textArea.remove();
  }
}

function getAgentationPathname(): string {
  if (typeof window === 'undefined') {
    return '/';
  }

  return window.location.pathname || '/';
}

function readStoredRearrangeState(pathname: string): AgentationRearrangeState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = localStorage.getItem(`${AGENTATION_REARRANGE_PREFIX}${pathname}`);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as Partial<AgentationRearrangeState>;
    if (!Array.isArray(parsed.sections)) {
      return null;
    }

    return parsed as AgentationRearrangeState;
  } catch {
    return null;
  }
}

function getStoredSessionId(pathname: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return localStorage.getItem(`${AGENTATION_SESSION_PREFIX}${pathname}`);
  } catch {
    return null;
  }
}

function hasLayoutChange(section: AgentationLayoutSection): boolean {
  const original = section.originalRect;
  const current = section.currentRect;

  return (
    Math.abs(original.x - current.x) > 1 ||
    Math.abs(original.y - current.y) > 1 ||
    Math.abs(original.width - current.width) > 1 ||
    Math.abs(original.height - current.height) > 1
  );
}

function getSectionNote(section: AgentationLayoutSection): string {
  return section.note?.trim() ?? '';
}

function getLayoutNoteOutput(pathname: string): string {
  const state = readStoredRearrangeState(pathname);
  const notedSections = state?.sections.filter((section) => getSectionNote(section)) ?? [];

  if (notedSections.length === 0) {
    return '';
  }

  const lines = notedSections.map(
    (section) => `- Note for **${section.label}**: ${getSectionNote(section)}`
  );

  return `\n## Layout Mode Notes\n\n${lines.join('\n')}\n`;
}

function enrichAgentationOutput(output: string, pathname = getAgentationPathname()): string {
  const layoutNoteOutput = getLayoutNoteOutput(pathname);
  if (!layoutNoteOutput) {
    return output;
  }

  const state = readStoredRearrangeState(pathname);
  const notes = state?.sections.map(getSectionNote).filter(Boolean) ?? [];
  if (notes.some((note) => output.includes(note))) {
    return output;
  }

  return `${output.trimEnd()}${layoutNoteOutput}`;
}

export async function copyAgentationOutput(output: string): Promise<void> {
  const enrichedOutput = enrichAgentationOutput(output);

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(enrichedOutput);
      return;
    }
  } catch {
    // Electron can reject navigator.clipboard even during a toolbar click.
  }

  copyWithSelectionFallback(enrichedOutput);
}

function formatLayoutAnnotationComment(section: AgentationLayoutSection): string {
  const note = getSectionNote(section);
  const original = section.originalRect;
  const current = section.currentRect;
  const layoutChange = `Move ${section.label} section (${section.tagName}) - from (${Math.round(original.x)},${Math.round(original.y)}) ${Math.round(original.width)}x${Math.round(original.height)} to (${Math.round(current.x)},${Math.round(current.y)}) ${Math.round(current.width)}x${Math.round(current.height)}`;

  if (!note) {
    return layoutChange;
  }

  if (!hasLayoutChange(section)) {
    return `Note for ${section.label} section (${section.tagName}) - ${note}`;
  }

  return `${layoutChange}. Note: ${note}`;
}

function buildLayoutAnnotation(section: AgentationLayoutSection, pathname: string) {
  return {
    id: section.id,
    x: (section.currentRect.x / window.innerWidth) * 100,
    y: section.currentRect.y,
    comment: formatLayoutAnnotationComment(section),
    element: section.selector,
    elementPath: '[rearrange]',
    timestamp: Date.now(),
    url: pathname,
    intent: 'change',
    severity: 'important',
    kind: 'rearrange',
    rearrange: {
      selector: section.selector,
      label: section.label,
      tagName: section.tagName,
      note: getSectionNote(section) || undefined,
      originalRect: section.originalRect,
      currentRect: section.currentRect,
    },
  };
}

async function updateLayoutAnnotation(
  endpoint: string,
  sectionId: string,
  comment: string
): Promise<boolean> {
  const response = await fetch(`${endpoint}/annotations/${sectionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment }),
  });

  return response.ok;
}

async function createLayoutAnnotation(
  endpoint: string,
  sessionId: string,
  annotation: ReturnType<typeof buildLayoutAnnotation>
): Promise<void> {
  const response = await fetch(`${endpoint}/sessions/${sessionId}/annotations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(annotation),
  });

  if (!response.ok) {
    throw new Error(`Failed to sync Agentation layout note: ${response.status}`);
  }
}

export async function syncAgentationLayoutNotes(
  endpoint: string,
  pathname = getAgentationPathname()
): Promise<void> {
  const sessionId = getStoredSessionId(pathname);
  const state = readStoredRearrangeState(pathname);
  if (!sessionId || !state) {
    return;
  }

  const sections = state.sections.filter(
    (section) => getSectionNote(section) || hasLayoutChange(section)
  );
  for (const section of sections) {
    const annotation = buildLayoutAnnotation(section, pathname);
    const updated = await updateLayoutAnnotation(endpoint, section.id, annotation.comment);
    if (!updated) {
      await createLayoutAnnotation(endpoint, sessionId, annotation);
    }
  }
}

function getLayoutSyncSignature(pathname: string): string {
  const sessionId = getStoredSessionId(pathname);
  const state = readStoredRearrangeState(pathname);

  if (!sessionId || !state) {
    return '';
  }

  const sections = state.sections
    .filter((section) => getSectionNote(section) || hasLayoutChange(section))
    .map((section) => ({
      id: section.id,
      note: getSectionNote(section),
      originalRect: section.originalRect,
      currentRect: section.currentRect,
    }));

  return JSON.stringify({ pathname, sessionId, sections });
}

export function DevAgentation({
  enabled = AGENTATION_ENABLED_BY_DEFAULT,
  endpoint = AGENTATION_ENDPOINT,
}: DevAgentationProps) {
  const lastLayoutSyncSignature = useRef('');

  useEffect(() => {
    if (!enabled || !endpoint) {
      return;
    }

    const syncLayoutNotes = () => {
      const pathname = getAgentationPathname();
      const signature = getLayoutSyncSignature(pathname);
      if (!signature || signature === lastLayoutSyncSignature.current) {
        return;
      }

      lastLayoutSyncSignature.current = signature;
      void syncAgentationLayoutNotes(endpoint, pathname);
    };

    syncLayoutNotes();
    const intervalId = window.setInterval(syncLayoutNotes, LAYOUT_NOTE_SYNC_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, endpoint]);

  if (!enabled) {
    return null;
  }

  return (
    <Agentation
      copyToClipboard={true}
      endpoint={endpoint}
      onCopy={(output) => {
        void copyAgentationOutput(output);
      }}
    />
  );
}
