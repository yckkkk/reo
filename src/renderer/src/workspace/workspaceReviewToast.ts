type WorkspaceReviewSnapshot = {
  readonly workspaceId: string;
  readonly review?: {
    readonly needsReviewCount: number;
    readonly markdownCandidateCount?: number;
    readonly tiptapSidecarCount?: number;
  };
};

type WorkspaceReviewToastState =
  | {
      readonly status: 'clean';
    }
  | {
      readonly status: 'unresolved';
      readonly count: number;
      readonly toastId: string;
    };

export function workspaceReviewToastId(workspaceId: string): string {
  return `reo-needs-review:${workspaceId}`;
}

export function workspaceReviewToastState(
  snapshot: WorkspaceReviewSnapshot
): WorkspaceReviewToastState {
  const count = snapshot.review?.needsReviewCount ?? 0;
  if (count <= 0) {
    return { status: 'clean' };
  }

  return {
    status: 'unresolved',
    count,
    toastId: workspaceReviewToastId(snapshot.workspaceId),
  };
}
