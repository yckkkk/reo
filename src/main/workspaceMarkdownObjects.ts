import path from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import {
  WIDGET_ID_PATTERN,
  HOME_COMPONENT_ID_PATTERN,
  MEMORY_ID_PATTERN,
  SEGMENT_ID_PATTERN,
  SUPPLEMENT_ID_PATTERN,
  WORKSPACE_CONTENT_KINDS,
} from '../workspace-contract/workspace-contract.js';

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
  id: z.string().regex(MEMORY_ID_PATTERN).optional(),
  memory_date: z.string().optional(),
});

export const workspaceSegmentMarkdownDataSchema = workspaceMarkdownSharedSemanticDataSchema.extend({
  id: z.string().regex(SEGMENT_ID_PATTERN).optional(),
  content_title: z.string().optional(),
  kind: workspaceMarkdownObjectKindSchema.optional(),
  format: z.literal('html').optional(),
  occurred_at: z.string().optional(),
  language: z.string().optional(),
});

export const workspaceSupplementMarkdownDataSchema =
  workspaceMarkdownSharedSemanticDataSchema.extend({
    id: z.string().regex(SUPPLEMENT_ID_PATTERN).optional(),
    kind: workspaceMarkdownObjectKindSchema.optional(),
    format: z.literal('html').optional(),
    occurred_at: z.string().optional(),
    language: z.string().optional(),
  });

export const workspaceWidgetMarkdownDataSchema = workspaceMarkdownSharedSemanticDataSchema.extend({
  id: z.string().regex(WIDGET_ID_PATTERN).optional(),
  kind: z.literal('widget'),
  format: z.literal('html'),
  mount: z.literal('workspace-rail'),
});

export const workspaceHomeComponentMarkdownDataSchema =
  workspaceMarkdownSharedSemanticDataSchema.extend({
    id: z.string().regex(HOME_COMPONENT_ID_PATTERN),
    kind: z.literal('home-component'),
    format: z.literal('html'),
    mount: z.literal('home'),
  });

const workspaceMemoryMarkdownCandidateDataSchema = workspaceMemoryMarkdownDataSchema
  .partial()
  .strip();
const workspaceSegmentMarkdownCandidateDataSchema = workspaceSegmentMarkdownDataSchema
  .partial()
  .strip();
const workspaceSupplementMarkdownCandidateDataSchema = workspaceSupplementMarkdownDataSchema
  .partial()
  .strip();
const workspaceWidgetMarkdownCandidateDataSchema = workspaceWidgetMarkdownDataSchema
  .partial()
  .strip();
const workspaceHomeComponentMarkdownCandidateDataSchema = workspaceHomeComponentMarkdownDataSchema
  .partial()
  .strip();

export type WorkspaceMarkdownObjectType =
  | 'memory'
  | 'segment'
  | 'supplement'
  | 'widget'
  | 'home-component';

type WorkspaceMarkdownObjectDataByType = {
  readonly memory: z.infer<typeof workspaceMemoryMarkdownDataSchema>;
  readonly segment: z.infer<typeof workspaceSegmentMarkdownDataSchema>;
  readonly supplement: z.infer<typeof workspaceSupplementMarkdownDataSchema>;
  readonly widget: z.infer<typeof workspaceWidgetMarkdownDataSchema>;
  readonly 'home-component': z.infer<typeof workspaceHomeComponentMarkdownDataSchema>;
};

type WorkspaceMarkdownObjectCandidateDataByType = {
  readonly memory: z.infer<typeof workspaceMemoryMarkdownCandidateDataSchema>;
  readonly segment: z.infer<typeof workspaceSegmentMarkdownCandidateDataSchema>;
  readonly supplement: z.infer<typeof workspaceSupplementMarkdownCandidateDataSchema>;
  readonly widget: z.infer<typeof workspaceWidgetMarkdownCandidateDataSchema>;
  readonly 'home-component': z.infer<typeof workspaceHomeComponentMarkdownCandidateDataSchema>;
};

export type WorkspaceMarkdownObjectData =
  WorkspaceMarkdownObjectDataByType[WorkspaceMarkdownObjectType];
export type WorkspaceMarkdownObjectCandidateData =
  WorkspaceMarkdownObjectCandidateDataByType[WorkspaceMarkdownObjectType];

export interface ParsedWorkspaceMarkdownObject<
  ObjectType extends WorkspaceMarkdownObjectType = WorkspaceMarkdownObjectType,
> {
  readonly data: WorkspaceMarkdownObjectDataByType[ObjectType];
  readonly content: string;
}

export interface ParsedWorkspaceMarkdownObjectCandidate<
  ObjectType extends WorkspaceMarkdownObjectType = WorkspaceMarkdownObjectType,
> {
  readonly data: WorkspaceMarkdownObjectCandidateDataByType[ObjectType];
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
    case 'widget':
      return workspaceWidgetMarkdownDataSchema;
    case 'home-component':
      return workspaceHomeComponentMarkdownDataSchema;
  }
}

function candidateSchemaForObject(objectType: WorkspaceMarkdownObjectType) {
  switch (objectType) {
    case 'memory':
      return workspaceMemoryMarkdownCandidateDataSchema;
    case 'segment':
      return workspaceSegmentMarkdownCandidateDataSchema;
    case 'supplement':
      return workspaceSupplementMarkdownCandidateDataSchema;
    case 'widget':
      return workspaceWidgetMarkdownCandidateDataSchema;
    case 'home-component':
      return workspaceHomeComponentMarkdownCandidateDataSchema;
  }
}

export function parseWorkspaceMarkdownObject<ObjectType extends WorkspaceMarkdownObjectType>({
  markdown,
  objectType,
}: {
  readonly markdown: string;
  readonly objectType: ObjectType;
}): ParsedWorkspaceMarkdownObject<ObjectType> {
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
    data: dataResult.data as WorkspaceMarkdownObjectDataByType[ObjectType],
    content: parsed.content,
  };
}

export function parseWorkspaceMarkdownObjectCandidate<
  ObjectType extends WorkspaceMarkdownObjectType,
>({
  markdown,
  objectType,
}: {
  readonly markdown: string;
  readonly objectType: ObjectType;
}): ParsedWorkspaceMarkdownObjectCandidate<ObjectType> {
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(markdown);
  } catch (error) {
    throw new Error('Invalid workspace markdown frontmatter', { cause: error });
  }

  const dataResult = candidateSchemaForObject(objectType).safeParse(parsed.data);
  if (!dataResult.success) {
    throw new Error('Invalid workspace markdown frontmatter', { cause: dataResult.error });
  }

  return {
    data: dataResult.data as WorkspaceMarkdownObjectCandidateDataByType[ObjectType],
    content: parsed.content,
  };
}

export function renderWorkspaceMarkdownObject<ObjectType extends WorkspaceMarkdownObjectType>({
  data,
  content,
  objectType,
}: {
  readonly data: WorkspaceMarkdownObjectDataByType[ObjectType];
  readonly content: string;
  readonly objectType: ObjectType;
}): string {
  const dataResult = semanticSchemaForObject(objectType).safeParse(data);
  if (!dataResult.success) {
    throw new Error('Invalid workspace markdown frontmatter', { cause: dataResult.error });
  }

  return matter.stringify(content, dataResult.data);
}
