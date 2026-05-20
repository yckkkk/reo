import path from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import { WORKSPACE_CONTENT_KINDS } from '../workspace-contract/workspace-contract.js';

const workspaceMarkdownObjectKindSchema = z.enum(WORKSPACE_CONTENT_KINDS);

const stringListSchema = z.array(z.string());

const workspaceMarkdownSharedSemanticDataSchema = z
  .object({
    title: z.string(),
    summary: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(['active', 'archived']).optional(),
    tags: stringListSchema.optional(),
    topics: stringListSchema.optional(),
    people: stringListSchema.optional(),
    places: stringListSchema.optional(),
    related: stringListSchema.optional(),
  })
  .strict();

export const workspaceMemoryMarkdownDataSchema = workspaceMarkdownSharedSemanticDataSchema.extend({
  memory_date: z.string().optional(),
});

export const workspaceSegmentMarkdownDataSchema = workspaceMarkdownSharedSemanticDataSchema.extend({
  kind: workspaceMarkdownObjectKindSchema.optional(),
  occurred_at: z.string().optional(),
  language: z.string().optional(),
});

export const workspaceSupplementMarkdownDataSchema =
  workspaceMarkdownSharedSemanticDataSchema.extend({
    kind: workspaceMarkdownObjectKindSchema.optional(),
    occurred_at: z.string().optional(),
    language: z.string().optional(),
  });

export type WorkspaceMarkdownObjectType = 'memory' | 'segment' | 'supplement';
export type WorkspaceMarkdownObjectData =
  | z.infer<typeof workspaceMemoryMarkdownDataSchema>
  | z.infer<typeof workspaceSegmentMarkdownDataSchema>
  | z.infer<typeof workspaceSupplementMarkdownDataSchema>;

export interface ParsedWorkspaceMarkdownObject {
  readonly data: WorkspaceMarkdownObjectData;
  readonly content: string;
}

export function validateWorkspaceRelativeResourcePath(resourcePath: string): string {
  const trimmed = resourcePath.trim();
  if (!trimmed) {
    throw new Error('Resource path must be a relative file path');
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    throw new Error('Resource path must be a relative file path');
  }

  const resourcePathWithPosixSeparators = trimmed.replace(/\\/g, '/');

  if (path.isAbsolute(trimmed) || path.posix.isAbsolute(resourcePathWithPosixSeparators)) {
    throw new Error('Resource path must stay inside the object directory');
  }

  const normalized = path.posix.normalize(resourcePathWithPosixSeparators);
  if (normalized === '.' || normalized.startsWith('../') || normalized === '..') {
    throw new Error('Resource path must stay inside the object directory');
  }

  return normalized;
}

function semanticSchemaForObject(objectType: WorkspaceMarkdownObjectType) {
  switch (objectType) {
    case 'memory':
      return workspaceMemoryMarkdownDataSchema;
    case 'segment':
      return workspaceSegmentMarkdownDataSchema;
    case 'supplement':
      return workspaceSupplementMarkdownDataSchema;
  }
}

export function parseWorkspaceMarkdownObject({
  markdown,
  objectType,
}: {
  readonly markdown: string;
  readonly objectType: WorkspaceMarkdownObjectType;
}): ParsedWorkspaceMarkdownObject {
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(markdown);
  } catch (error) {
    throw new Error('Invalid workspace markdown frontmatter', { cause: error });
  }

  const dataResult = semanticSchemaForObject(objectType).safeParse(parsed.data);
  if (!dataResult.success) {
    throw new Error('Invalid workspace markdown frontmatter', { cause: dataResult.error });
  }

  return {
    data: dataResult.data,
    content: parsed.content,
  };
}

export function renderWorkspaceMarkdownObject({
  data,
  content,
  objectType,
}: {
  readonly data: WorkspaceMarkdownObjectData;
  readonly content: string;
  readonly objectType: WorkspaceMarkdownObjectType;
}): string {
  const dataResult = semanticSchemaForObject(objectType).safeParse(data);
  if (!dataResult.success) {
    throw new Error('Invalid workspace markdown frontmatter', { cause: dataResult.error });
  }

  return matter.stringify(content, dataResult.data);
}
