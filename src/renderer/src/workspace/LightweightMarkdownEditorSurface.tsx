import { TaskItem, TaskList } from '@tiptap/extension-list';
import TextAlign from '@tiptap/extension-text-align';
import Typography from '@tiptap/extension-typography';
import { Selection } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import { EditorContent, EditorContext, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ClipboardEventHandler,
  type DragEventHandler,
  type Ref,
} from 'react';
import { ImageUploadNode } from '@/components/tiptap-node/image-upload-node/image-upload-node-extension';
import { HorizontalRule } from '@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension';
import '@/components/tiptap-node/blockquote-node/blockquote-node.scss';
import '@/components/tiptap-node/code-block-node/code-block-node.scss';
import '@/components/tiptap-node/heading-node/heading-node.scss';
import '@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss';
import '@/components/tiptap-node/image-node/image-node.scss';
import '@/components/tiptap-node/image-upload-node/image-upload-node.scss';
import '@/components/tiptap-node/list-node/list-node.scss';
import '@/components/tiptap-node/paragraph-node/paragraph-node.scss';
import { Spacer } from '@/components/tiptap-ui-primitive/spacer';
import { Toolbar, ToolbarGroup, ToolbarSeparator } from '@/components/tiptap-ui-primitive/toolbar';
import { BlockquoteButton } from '@/components/tiptap-ui/blockquote-button';
import { ColorHighlightPopover } from '@/components/tiptap-ui/color-highlight-popover';
import { pickHighlightColorsByValue } from '@/components/tiptap-ui/color-highlight-button';
import { CodeBlockButton } from '@/components/tiptap-ui/code-block-button';
import { HeadingDropdownMenu } from '@/components/tiptap-ui/heading-dropdown-menu';
import { ImageUploadButton } from '@/components/tiptap-ui/image-upload-button';
import { LinkPopover } from '@/components/tiptap-ui/link-popover';
import { ListDropdownMenu } from '@/components/tiptap-ui/list-dropdown-menu';
import { MarkButton } from '@/components/tiptap-ui/mark-button';
import { TextAlignButton } from '@/components/tiptap-ui/text-align-button';
import { UndoRedoButton } from '@/components/tiptap-ui/undo-redo-button';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { setTiptapInteractiveSelectionReady } from '@/hooks/use-tiptap-editor';
import { cn } from '@/lib/utils';
import {
  markdownAttachmentContextKey,
  type MarkdownAttachmentContext,
} from './markdownAttachmentSource';
import { NOTE_ATTACHMENT_MAX_BYTES } from './noteEditorModel';
import {
  createMarkdownImageExtension,
  HEADING_LEVELS,
  MarkdownHeading,
  MarkdownHighlight,
  MarkdownParagraph,
  MarkdownSubscript,
  MarkdownSuperscript,
} from './tiptapMarkdownExtensions';
import './LightweightMarkdownEditorSurface.scss';

export type LightweightMarkdownEditorHandle = {
  readonly blur: () => void;
  readonly captureSelection: () => LightweightMarkdownEditorSelection | null;
  readonly focus: () => void;
  readonly getMarkdown: () => string;
  readonly insertMarkdown: (
    markdown: string,
    selection?: LightweightMarkdownEditorSelection | null
  ) => void;
};

export type LightweightMarkdownEditorSelection = {
  readonly from: number;
  readonly to: number;
};

type AttachmentUploadHandler = (
  file: File,
  signal?: AbortSignal
) => Promise<string | null> | string | null | void;

export type LightweightMarkdownEditorSurfaceProps = {
  readonly bordered?: boolean;
  readonly cancelButtonClassName?: string;
  readonly cancelLabel?: string;
  readonly attachmentContext?: MarkdownAttachmentContext | undefined;
  readonly disabled?: boolean;
  readonly editorFocused?: boolean;
  readonly editorHandleRef?: Ref<LightweightMarkdownEditorHandle>;
  readonly editorId: string;
  readonly editorLabel: string;
  readonly editorTargetKey?: string;
  readonly headerLabel: string;
  readonly notice?: string | null;
  readonly onAttachmentUpload?: AttachmentUploadHandler;
  readonly onCancel?: () => void;
  readonly onChange: (value: string) => void;
  readonly onDrop?: DragEventHandler<HTMLElement>;
  readonly onDragOver?: DragEventHandler<HTMLElement>;
  readonly onPaste?: ClipboardEventHandler<HTMLElement>;
  readonly onSave?: () => void;
  readonly placeholder: string;
  readonly readableWidth?: boolean;
  readonly saveDisabled?: boolean;
  readonly saveButtonClassName?: string;
  readonly saveLabel?: string;
  readonly showHeaderLabel?: boolean;
  readonly showActions?: boolean;
  readonly surfaceRef?: Ref<HTMLDivElement>;
  readonly surfaceTestId: string;
  readonly onEditorFocusChange?: (editorFocused: boolean) => void;
  readonly toolbarDisabled?: boolean;
  readonly value: string;
};

type LightweightMarkdownEditorSurfaceContentProps = LightweightMarkdownEditorSurfaceProps & {
  readonly resolvedAttachmentContextKey: string;
};

const IMAGE_ATTACHMENT_ACCEPT = 'image/gif,image/jpeg,image/png,image/webp';
const HIGHLIGHT_COLORS = pickHighlightColorsByValue([
  'var(--tt-color-highlight-green)',
  'var(--tt-color-highlight-blue)',
  'var(--tt-color-highlight-red)',
  'var(--tt-color-highlight-purple)',
  'var(--tt-color-highlight-yellow)',
]);
const UPLOAD_PROGRESS_DONE = 100;

function isUsableEditor(editor: Editor | null): editor is Editor {
  return Boolean(editor && !editor.isDestroyed);
}

function editorMarkdown(editor: Editor | null) {
  return isUsableEditor(editor) ? editor.getMarkdown() : '';
}

function captureEditorSelection(editor: Editor): LightweightMarkdownEditorSelection {
  const domSelection = window.getSelection();
  if (
    domSelection?.anchorNode &&
    domSelection.focusNode &&
    editor.view.dom.contains(domSelection.anchorNode) &&
    editor.view.dom.contains(domSelection.focusNode)
  ) {
    const anchor = editor.view.posAtDOM(domSelection.anchorNode, domSelection.anchorOffset);
    const focus = editor.view.posAtDOM(domSelection.focusNode, domSelection.focusOffset);
    return {
      from: Math.min(anchor, focus),
      to: Math.max(anchor, focus),
    };
  }
  return {
    from: editor.state.selection.from,
    to: editor.state.selection.to,
  };
}

export function LightweightMarkdownEditorSurface(props: LightweightMarkdownEditorSurfaceProps) {
  const attachmentContextKey = markdownAttachmentContextKey(props.attachmentContext);
  const editorLifecycleKey = props.editorTargetKey ?? attachmentContextKey;

  return (
    <LightweightMarkdownEditorSurfaceContent
      key={editorLifecycleKey}
      {...props}
      resolvedAttachmentContextKey={attachmentContextKey}
    />
  );
}

function LightweightMarkdownEditorSurfaceContent({
  attachmentContext,
  bordered = true,
  cancelButtonClassName,
  cancelLabel = '取消',
  disabled = false,
  editorFocused,
  editorHandleRef,
  editorId,
  editorLabel,
  headerLabel,
  notice = null,
  onAttachmentUpload,
  onCancel,
  onChange,
  onDragOver,
  onDrop,
  onPaste,
  onSave,
  placeholder,
  readableWidth = false,
  saveDisabled = false,
  saveButtonClassName,
  saveLabel,
  showHeaderLabel = false,
  showActions = true,
  surfaceRef,
  surfaceTestId,
  onEditorFocusChange,
  toolbarDisabled = false,
  value,
  resolvedAttachmentContextKey,
}: LightweightMarkdownEditorSurfaceContentProps) {
  const [uncontrolledEditorFocused, setUncontrolledEditorFocused] = useState(false);
  const onAttachmentUploadRef = useRef(onAttachmentUpload);
  const onChangeRef = useRef(onChange);
  const lastSyncedEditorMarkdownRef = useRef(value);
  const resolvedEditorFocused = editorFocused ?? uncontrolledEditorFocused;
  const attachmentContextKey = resolvedAttachmentContextKey;

  useEffect(() => {
    onAttachmentUploadRef.current = onAttachmentUpload;
  }, [onAttachmentUpload]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: false,
        horizontalRule: false,
        link: {
          openOnClick: false,
          enableClickSelection: true,
        },
        paragraph: false,
      }),
      MarkdownHeading.configure({
        levels: HEADING_LEVELS,
      }),
      MarkdownParagraph,
      HorizontalRule,
      TaskList,
      TaskItem.configure({
        nested: true,
        a11y: {
          checkboxLabel: (node) => `待办复选框：${node.textContent || '空待办'}`,
        },
      }),
      MarkdownHighlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Typography,
      MarkdownSuperscript,
      MarkdownSubscript,
      createMarkdownImageExtension(attachmentContext),
      Selection,
      ImageUploadNode.configure({
        accept: IMAGE_ATTACHMENT_ACCEPT,
        limit: 3,
        maxSize: NOTE_ATTACHMENT_MAX_BYTES,
        upload: async (file, onProgress, signal) => {
          const upload = onAttachmentUploadRef.current;
          if (!upload || signal?.aborted) {
            throw new Error('Image upload is not available.');
          }
          const result = await upload(file, signal);
          if (signal?.aborted) {
            throw new Error('Image upload was cancelled.');
          }
          if (typeof result !== 'string' || result.length === 0) {
            throw new Error('Image upload failed.');
          }
          onProgress?.({ progress: UPLOAD_PROGRESS_DONE });
          return result;
        },
      }),
      Markdown.configure({
        indentation: {
          style: 'space',
          size: 2,
        },
        markedOptions: {
          gfm: true,
        },
      }),
    ],
    [attachmentContextKey]
  );

  const editor = useEditor(
    {
      content: value,
      contentType: 'markdown',
      editable: !disabled,
      editorProps: {
        attributes: {
          autocomplete: 'off',
          autocapitalize: 'off',
          autocorrect: 'off',
          'aria-label': editorLabel,
          'aria-multiline': 'true',
          class: 'simple-editor reo-lightweight-markdown-editor',
          'data-slot': 'lightweight-markdown-rich-editor',
          id: editorId,
          role: 'textbox',
        },
      },
      extensions,
      immediatelyRender: false,
      onBlur: ({ editor: blurredEditor }) => {
        setTiptapInteractiveSelectionReady(blurredEditor, false);
        setResolvedEditorFocused(false);
      },
      onFocus: ({ editor: focusedEditor }) => {
        setTiptapInteractiveSelectionReady(focusedEditor, false);
        setResolvedEditorFocused(true);
      },
      onSelectionUpdate: ({ editor: selectionEditor }) => {
        setTiptapInteractiveSelectionReady(selectionEditor, selectionEditor.isFocused);
      },
      onUpdate: ({ editor: updatedEditor, transaction }) => {
        if (!transaction.docChanged) {
          return;
        }
        const nextMarkdown = updatedEditor.getMarkdown();
        if (nextMarkdown === lastSyncedEditorMarkdownRef.current) {
          return;
        }
        lastSyncedEditorMarkdownRef.current = nextMarkdown;
        onChangeRef.current(nextMarkdown);
      },
    },
    [attachmentContextKey]
  );

  useEffect(() => {
    if (!isUsableEditor(editor)) {
      return;
    }
    lastSyncedEditorMarkdownRef.current = editorMarkdown(editor);
  }, [editor]);

  useEffect(() => {
    if (!isUsableEditor(editor)) {
      return;
    }
    editor.setEditable(!disabled, false);
  }, [disabled, editor]);

  useEffect(() => {
    if (!isUsableEditor(editor)) {
      return;
    }
    if (lastSyncedEditorMarkdownRef.current === value) {
      return;
    }
    const currentMarkdown = editorMarkdown(editor);
    if (currentMarkdown === value) {
      lastSyncedEditorMarkdownRef.current = currentMarkdown;
      return;
    }
    editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
    lastSyncedEditorMarkdownRef.current = editorMarkdown(editor);
  }, [editor, value]);

  useImperativeHandle(
    editorHandleRef,
    () => ({
      blur: () => {
        if (isUsableEditor(editor)) {
          editor.commands.blur();
        }
      },
      captureSelection: () => (isUsableEditor(editor) ? captureEditorSelection(editor) : null),
      focus: () => {
        if (isUsableEditor(editor)) {
          editor.commands.focus('end');
        }
      },
      getMarkdown: () => editorMarkdown(editor),
      insertMarkdown: (markdown: string, selection?: LightweightMarkdownEditorSelection | null) => {
        if (!isUsableEditor(editor)) {
          return;
        }
        const boundedSelection = selection
          ? {
              from: Math.min(selection.from, editor.state.doc.content.size),
              to: Math.min(selection.to, editor.state.doc.content.size),
            }
          : null;
        const chain = editor.chain().focus();
        if (boundedSelection) {
          chain.insertContentAt(boundedSelection, markdown, { contentType: 'markdown' }).run();
          return;
        }
        chain.insertContent(markdown, { contentType: 'markdown' }).run();
      },
    }),
    [editor]
  );

  function setResolvedEditorFocused(nextEditorFocused: boolean) {
    if (editorFocused === undefined) {
      setUncontrolledEditorFocused(nextEditorFocused);
    }
    onEditorFocusChange?.(nextEditorFocused);
  }

  const placeholderNode = useMemo(
    () =>
      value.trim().length === 0 ? (
        <div aria-hidden="true" className="reo-lightweight-markdown-editor-placeholder">
          {placeholder}
        </div>
      ) : null,
    [placeholder, value]
  );

  const toolbarLocked = toolbarDisabled || disabled;

  return (
    <div
      ref={surfaceRef}
      className={cn(
        'reo-lightweight-markdown-editor-surface grid h-full min-h-0 w-full grid-rows-[44px_minmax(0,1fr)] overflow-hidden bg-background',
        bordered &&
          cn(
            'rounded-md border transition-[border-color] duration-150 ease-out',
            resolvedEditorFocused ? 'border-ring' : 'border-secondary'
          ),
        toolbarLocked && 'reo-lightweight-markdown-editor-surface-disabled'
      )}
      data-slot="lightweight-markdown-editor-surface"
      data-testid={surfaceTestId}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <EditorContext.Provider value={{ editor }}>
        <div
          data-slot="lightweight-markdown-editor-toolbar"
          className="flex h-[44px] min-h-[44px] min-w-0 items-center"
        >
          {showHeaderLabel ? (
            <span className="flex min-w-fit items-center px-12 text-ui-sm leading-ui-sm text-muted-foreground">
              {headerLabel}
            </span>
          ) : (
            <span className="sr-only">{headerLabel}</span>
          )}
          <Toolbar aria-label="文本编辑工具栏">
            <Spacer />
            <ToolbarGroup>
              <UndoRedoButton editor={editor} action="undo" disabled={toolbarLocked} />
              <UndoRedoButton editor={editor} action="redo" disabled={toolbarLocked} />
            </ToolbarGroup>
            <ToolbarSeparator />
            <ToolbarGroup>
              <HeadingDropdownMenu
                editor={editor ?? undefined}
                levels={[1, 2, 3, 4]}
                modal={false}
                disabled={toolbarLocked}
              />
              <ListDropdownMenu
                editor={editor ?? undefined}
                modal={false}
                types={['bulletList', 'orderedList', 'taskList']}
                disabled={toolbarLocked}
              />
              <BlockquoteButton editor={editor} disabled={toolbarLocked} />
              <CodeBlockButton editor={editor} disabled={toolbarLocked} />
            </ToolbarGroup>
            <ToolbarSeparator />
            <ToolbarGroup>
              <MarkButton editor={editor} type="bold" disabled={toolbarLocked} />
              <MarkButton editor={editor} type="italic" disabled={toolbarLocked} />
              <MarkButton editor={editor} type="strike" disabled={toolbarLocked} />
              <MarkButton editor={editor} type="code" disabled={toolbarLocked} />
              <MarkButton editor={editor} type="underline" disabled={toolbarLocked} />
              <ColorHighlightPopover
                editor={editor}
                colors={HIGHLIGHT_COLORS}
                disabled={toolbarLocked}
              />
              <LinkPopover editor={editor} disabled={toolbarLocked} />
            </ToolbarGroup>
            <ToolbarSeparator />
            <ToolbarGroup>
              <MarkButton editor={editor} type="superscript" disabled={toolbarLocked} />
              <MarkButton editor={editor} type="subscript" disabled={toolbarLocked} />
            </ToolbarGroup>
            <ToolbarSeparator />
            <ToolbarGroup>
              <TextAlignButton editor={editor} align="left" disabled={toolbarLocked} />
              <TextAlignButton editor={editor} align="center" disabled={toolbarLocked} />
              <TextAlignButton editor={editor} align="right" disabled={toolbarLocked} />
              <TextAlignButton editor={editor} align="justify" disabled={toolbarLocked} />
            </ToolbarGroup>
            {onAttachmentUpload ? (
              <>
                <ToolbarSeparator />
                <ToolbarGroup>
                  <ImageUploadButton editor={editor} text="添加" disabled={toolbarLocked} />
                </ToolbarGroup>
              </>
            ) : null}
            <Spacer />
            {showActions && onSave ? (
              <>
                <ToolbarSeparator />
                <ToolbarGroup
                  className="reo-lightweight-markdown-editor-actions shrink-0"
                  data-slot="lightweight-markdown-editor-actions"
                >
                  {onCancel ? (
                    <Button
                      type="button"
                      size="compact"
                      disabled={saveDisabled}
                      className={cancelButtonClassName}
                      onClick={onCancel}
                    >
                      {cancelLabel}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="compact"
                    disabled={saveDisabled}
                    className={saveButtonClassName}
                    onClick={onSave}
                  >
                    {saveLabel}
                  </Button>
                </ToolbarGroup>
              </>
            ) : null}
          </Toolbar>
        </div>
        <div
          data-slot="lightweight-markdown-editor-body"
          className="flex min-h-0 flex-col bg-background"
          onPaste={onPaste}
        >
          {notice ? (
            <p role="status" className="mx-20 mt-16 text-ui-sm leading-ui-sm text-muted-foreground">
              {notice}
            </p>
          ) : null}
          <Label htmlFor={editorId} className="sr-only">
            {editorLabel}
          </Label>
          <div className="reo-lightweight-markdown-editor-scrollport relative min-h-0 flex-1 overflow-y-auto">
            <div
              className={cn(
                'simple-editor-content reo-lightweight-markdown-editor-content relative',
                readableWidth && 'reo-lightweight-markdown-editor-content--readable'
              )}
            >
              {placeholderNode}
              <EditorContent editor={editor} role="presentation" />
            </div>
          </div>
        </div>
      </EditorContext.Provider>
    </div>
  );
}
