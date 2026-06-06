export const ARTIFACT_RUNTIME_ENTRY_FILE = 'entry.html';
export const ARTIFACT_RUNTIME_MANIFEST_FILE = 'runtime.json';
export const ARTIFACT_RUNTIME_STATE_FILE = 'state.json';
export const ARTIFACT_RUNTIME_ASSETS_DIRECTORY = 'assets';
export const RENDER_SCHEME = 'reo-render';
export const RENDER_VENDOR_PACKAGE = 'reo-render';

function runtimeHostPart(value: string): string {
  const bytes = new TextEncoder().encode(value);
  return `${bytes.length}-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    ''
  )}`;
}

export function artifactSegmentRuntimeHost(workspaceId: string, segmentId: string): string {
  return `segment-${runtimeHostPart(workspaceId)}-${runtimeHostPart(segmentId)}`;
}

export function artifactSupplementRuntimeHost(
  workspaceId: string,
  segmentId: string,
  supplementId: string
): string {
  return `supplement-${runtimeHostPart(workspaceId)}-${runtimeHostPart(segmentId)}-${runtimeHostPart(
    supplementId
  )}`;
}

export function workspaceWidgetRuntimeHost(workspaceId: string, widgetId: string): string {
  return `widget-${runtimeHostPart(workspaceId)}-${runtimeHostPart(widgetId)}`;
}

export function artifactSegmentRuntimeUrl({
  previewVersion,
  segmentId,
  workspaceId,
}: {
  readonly previewVersion: string;
  readonly segmentId: string;
  readonly workspaceId: string;
}): string {
  return `${RENDER_SCHEME}://${artifactSegmentRuntimeHost(
    workspaceId,
    segmentId
  )}/workspaces/${encodeURIComponent(workspaceId)}/segments/${encodeURIComponent(
    segmentId
  )}/${ARTIFACT_RUNTIME_ENTRY_FILE}?v=${encodeURIComponent(previewVersion)}`;
}

export function artifactSupplementRuntimeUrl({
  previewVersion,
  segmentId,
  supplementId,
  workspaceId,
}: {
  readonly previewVersion: string;
  readonly segmentId: string;
  readonly supplementId: string;
  readonly workspaceId: string;
}): string {
  return `${RENDER_SCHEME}://${artifactSupplementRuntimeHost(
    workspaceId,
    segmentId,
    supplementId
  )}/workspaces/${encodeURIComponent(workspaceId)}/segments/${encodeURIComponent(
    segmentId
  )}/supplements/${encodeURIComponent(supplementId)}/${ARTIFACT_RUNTIME_ENTRY_FILE}?v=${encodeURIComponent(
    previewVersion
  )}`;
}

export function workspaceWidgetRuntimeUrl({
  widgetId,
  previewVersion,
  workspaceId,
}: {
  readonly widgetId: string;
  readonly previewVersion: string;
  readonly workspaceId: string;
}): string {
  return `${RENDER_SCHEME}://${workspaceWidgetRuntimeHost(
    workspaceId,
    widgetId
  )}/workspaces/${encodeURIComponent(workspaceId)}/widgets/${encodeURIComponent(
    widgetId
  )}/${ARTIFACT_RUNTIME_ENTRY_FILE}?v=${encodeURIComponent(previewVersion)}`;
}
