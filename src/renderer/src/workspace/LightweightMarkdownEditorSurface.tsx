import { TaskItem, TaskList } from '@tiptap/extension-list';
import TextAlign from '@tiptap/extension-text-align';
import Typography from '@tiptap/extension-typography';
import { Selection } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import { EditorContent, EditorContext, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { JSONContent } from '@tiptap/core';
import {
  useCallback,
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
import { CodeBlockButton } from '@/components/tiptap-ui/code-block-button';
import { HeadingDropdownMenu } from '@/components/tiptap-ui/heading-dropdown-menu';
import { ImageUploadButton } from '@/components/tiptap-ui/image-upload-button';
import { LinkPopover } from '@/components/tiptap-ui/link-popover';
import { ListDropdownMenu } from '@/components/tiptap-ui/list-dropdown-menu';
import { MarkButton } from '@/components/tiptap-ui/mark-button';
import { TextAlignButton } from '@/components/tiptap-ui/text-align-button';
import { UndoRedoButton } from '@/components/tiptap-ui/undo-redo-button';
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
import { isReoTiptapLinkHref } from '../../../tiptap-markdown/tiptapLinkHref';
import './LightweightMarkdownEditorSurface.scss';

export type LightweightMarkdownEditorHandle = {
  readonly blur: () => void;
  readonly captureSelection: () => LightweightMarkdownEditorSelection | null;
  readonly focus: () => void;
  readonly getMarkdown: () => string;
  readonly getTiptapJson: () => JSONContent | null;
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
  readonly attachmentContext?: MarkdownAttachmentContext | undefined;
  readonly disabled?: boolean;
  readonly editorHandleRef?: Ref<LightweightMarkdownEditorHandle>;
  readonly editorId: string;
  readonly editorLabel: string;
  readonly editorTargetKey?: string;
  readonly headerLabel: string;
  readonly notice?: string | null;
  readonly onAttachmentUpload?: AttachmentUploadHandler;
  readonly onChange: (value: string) => void;
  readonly onRichChange?: (value: {
    readonly markdown: string;
    readonly tiptapJson: JSONContent;
    readonly tiptapJsonKey: string;
  }) => void;
  readonly onDrop?: DragEventHandler<HTMLElement>;
  readonly onDragOver?: DragEventHandler<HTMLElement>;
  readonly onPaste?: ClipboardEventHandler<HTMLElement>;
  readonly placeholder: string;
  readonly readableWidth?: boolean;
  readonly showHeaderLabel?: boolean;
  readonly surfaceRef?: Ref<HTMLDivElement>;
  readonly surfaceTestId: string;
  readonly toolbarDisabled?: boolean;
  readonly value: string;
  readonly valueTiptapJson?: JSONContent | undefined;
};

type LightweightMarkdownEditorSurfaceContentProps = LightweightMarkdownEditorSurfaceProps & {
  readonly resolvedAttachmentContextKey: string;
};

const IMAGE_ATTACHMENT_ACCEPT = 'image/gif,image/jpeg,image/png,image/webp';
const UPLOAD_PROGRESS_DONE = 100;

function isUsableEditor(editor: Editor | null): editor is Editor {
  return Boolean(editor && !editor.isDestroyed);
}

function findUnsupportedTiptapJsonContent(editor: Editor, content: JSONContent): Error | null {
  const stack: JSONContent[] = [content];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      continue;
    }
    if (node.type && !(node.type in editor.schema.nodes)) {
      return new Error(`Unsupported Tiptap node: ${node.type}`);
    }
    for (const mark of node.marks ?? []) {
      if (mark.type && !(mark.type in editor.schema.marks)) {
        return new Error(`Unsupported Tiptap mark: ${mark.type}`);
      }
    }
    for (const child of node.content ?? []) {
      stack.push(child);
    }
  }
  return null;
}

function editorMarkdown(editor: Editor | null) {
  return isUsableEditor(editor) ? editor.getMarkdown() : '';
}

function editorTiptapJson(editor: Editor | null): JSONContent | null {
  return isUsableEditor(editor) ? editor.getJSON() : null;
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
  disabled = false,
  editorHandleRef,
  editorId,
  editorLabel,
  headerLabel,
  notice = null,
  onAttachmentUpload,
  onChange,
  onRichChange,
  onDragOver,
  onDrop,
  onPaste,
  placeholder,
  readableWidth = false,
  showHeaderLabel = false,
  surfaceRef,
  surfaceTestId,
  toolbarDisabled = false,
  value,
  valueTiptapJson,
  resolvedAttachmentContextKey,
}: LightweightMarkdownEditorSurfaceContentProps) {
  const [toolbarRevealed, setToolbarRevealed] = useState(false);
  const [contentErrorMessage, setContentErrorMessage] = useState<string | null>(null);
  const surfaceNodeRef = useRef<HTMLDivElement | null>(null);
  const toolbarShellRef = useRef<HTMLDivElement | null>(null);
  const onAttachmentUploadRef = useRef(onAttachmentUpload);
  const onChangeRef = useRef(onChange);
  const onRichChangeRef = useRef(onRichChange);
  const lastSyncedEditorMarkdownRef = useRef(value);
  const valueTiptapJsonKey = useMemo(
    () => (valueTiptapJson ? JSON.stringify(valueTiptapJson) : null),
    [valueTiptapJson]
  );
  const lastSyncedEditorTiptapJsonKeyRef = useRef(valueTiptapJsonKey);
  const attachmentContextKey = resolvedAttachmentContextKey;

  const setSurfaceNode = useCallback(
    (node: HTMLDivElement | null) => {
      surfaceNodeRef.current = node;
      if (typeof surfaceRef === 'function') {
        surfaceRef(node);
      } else if (surfaceRef) {
        (surfaceRef as { current: HTMLDivElement | null }).current = node;
      }
    },
    [surfaceRef]
  );

  useEffect(() => {
    onAttachmentUploadRef.current = onAttachmentUpload;
  }, [onAttachmentUpload]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onRichChangeRef.current = onRichChange;
  }, [onRichChange]);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: false,
        horizontalRule: false,
        link: {
          openOnClick: false,
          enableClickSelection: true,
          isAllowedUri: (url) => isReoTiptapLinkHref(url),
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
      content: valueTiptapJson ?? value,
      ...(valueTiptapJson ? {} : { contentType: 'markdown' as const }),
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
      emitContentError: true,
      immediatelyRender: false,
      onBlur: ({ editor: blurredEditor }) => {
        setTiptapInteractiveSelectionReady(blurredEditor, false);
      },
      onContentError: () => {
        setContentErrorMessage('富文本结构无法按当前编辑器模型读取。');
      },
      onFocus: ({ editor: focusedEditor }) => {
        setTiptapInteractiveSelectionReady(focusedEditor, false);
      },
      onSelectionUpdate: ({ editor: selectionEditor }) => {
        setTiptapInteractiveSelectionReady(selectionEditor, selectionEditor.isFocused);
      },
      onUpdate: ({ editor: updatedEditor, transaction }) => {
        if (!transaction.docChanged) {
          return;
        }
        const nextMarkdown = updatedEditor.getMarkdown();
        const nextTiptapJson = updatedEditor.getJSON();
        const nextTiptapJsonKey = JSON.stringify(nextTiptapJson);
        if (
          nextMarkdown === lastSyncedEditorMarkdownRef.current &&
          nextTiptapJsonKey === lastSyncedEditorTiptapJsonKeyRef.current
        ) {
          return;
        }
        setContentErrorMessage(null);
        lastSyncedEditorMarkdownRef.current = nextMarkdown;
        lastSyncedEditorTiptapJsonKeyRef.current = nextTiptapJsonKey;
        if (onRichChangeRef.current) {
          onRichChangeRef.current({
            markdown: nextMarkdown,
            tiptapJson: nextTiptapJson,
            tiptapJsonKey: nextTiptapJsonKey,
          });
          return;
        }
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
    lastSyncedEditorTiptapJsonKeyRef.current = JSON.stringify(editor.getJSON());
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
    if (valueTiptapJson) {
      if (
        lastSyncedEditorMarkdownRef.current === value &&
        lastSyncedEditorTiptapJsonKeyRef.current === valueTiptapJsonKey
      ) {
        return;
      }
      const unsupportedContentError = findUnsupportedTiptapJsonContent(editor, valueTiptapJson);
      if (unsupportedContentError) {
        setContentErrorMessage('富文本结构无法按当前编辑器模型读取。');
        return;
      }
      const accepted = editor.commands.setContent(valueTiptapJson, { emitUpdate: false });
      if (!accepted) {
        return;
      }
      setContentErrorMessage(null);
      lastSyncedEditorMarkdownRef.current = editorMarkdown(editor);
      lastSyncedEditorTiptapJsonKeyRef.current = JSON.stringify(editor.getJSON());
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
    const accepted = editor.commands.setContent(value, {
      contentType: 'markdown',
      emitUpdate: false,
    });
    if (!accepted) {
      return;
    }
    setContentErrorMessage(null);
    lastSyncedEditorMarkdownRef.current = editorMarkdown(editor);
    lastSyncedEditorTiptapJsonKeyRef.current = JSON.stringify(editor.getJSON());
  }, [editor, value, valueTiptapJson, valueTiptapJsonKey]);

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
      getTiptapJson: () => editorTiptapJson(editor),
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

  useEffect(() => {
    const surfaceNode = surfaceNodeRef.current;
    if (!surfaceNode) {
      return;
    }
    let pendingFocusExitFrame = 0;
    const cancelPendingFocusExit = () => {
      if (pendingFocusExitFrame) {
        cancelAnimationFrame(pendingFocusExitFrame);
        pendingFocusExitFrame = 0;
      }
    };
    const withinEditingSession = (node: EventTarget | null) => {
      if (!(node instanceof Node)) {
        return false;
      }
      if (surfaceNode.contains(node)) {
        return true;
      }
      // The toolbar's own dropdowns/popovers (heading, list, color, link) are
      // Radix Popper content portalled outside the surface, rendered inside a
      // popper-content-wrapper. Treat pointer/focus there as still editing.
      return (
        node instanceof Element && node.closest('[data-radix-popper-content-wrapper]') !== null
      );
    };
    // Reveal whenever focus enters the editor (click, tab, or programmatic).
    const reveal = () => {
      cancelPendingFocusExit();
      setToolbarRevealed(true);
    };
    const hideIfFocusOutside = () => {
      if (!withinEditingSession(document.activeElement)) {
        setToolbarRevealed(false);
      }
    };
    const hideOnFocusOut = (event: FocusEvent) => {
      if (withinEditingSession(event.relatedTarget)) {
        return;
      }
      if (event.relatedTarget === null) {
        cancelPendingFocusExit();
        pendingFocusExitFrame = requestAnimationFrame(() => {
          pendingFocusExitFrame = 0;
          hideIfFocusOutside();
        });
        return;
      }
      setToolbarRevealed(false);
    };
    const hideOnOutsideFocusIn = (event: FocusEvent) => {
      if (!withinEditingSession(event.target)) {
        setToolbarRevealed(false);
      }
    };
    // Hide whenever a pointer press lands outside the editing session — covers
    // the immersive titlebar, empty areas, and clicks after a dropdown closes,
    // none of which produce a reliable editor blur.
    const hideOnOutsidePointer = (event: PointerEvent) => {
      if (!withinEditingSession(event.target)) {
        setToolbarRevealed(false);
      }
    };
    surfaceNode.addEventListener('focusin', reveal);
    surfaceNode.addEventListener('focusout', hideOnFocusOut);
    document.addEventListener('focusin', hideOnOutsideFocusIn, true);
    document.addEventListener('pointerdown', hideOnOutsidePointer, true);
    return () => {
      cancelPendingFocusExit();
      surfaceNode.removeEventListener('focusin', reveal);
      surfaceNode.removeEventListener('focusout', hideOnFocusOut);
      document.removeEventListener('focusin', hideOnOutsideFocusIn, true);
      document.removeEventListener('pointerdown', hideOnOutsidePointer, true);
    };
  }, []);

  useEffect(() => {
    const toolbarShell = toolbarShellRef.current;
    if (toolbarShell) {
      toolbarShell.inert = !toolbarRevealed;
    }
  }, [toolbarRevealed]);

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
  const visibleNotice = contentErrorMessage ?? notice;

  return (
    <div
      ref={setSurfaceNode}
      className={cn(
        'reo-lightweight-markdown-editor-surface grid h-full min-h-0 w-full overflow-hidden bg-background',
        toolbarRevealed ? 'grid-rows-[44px_minmax(0,1fr)]' : 'grid-rows-[0px_minmax(0,1fr)]',
        bordered && cn('rounded-md border', toolbarRevealed ? 'border-ring' : 'border-secondary'),
        toolbarLocked && 'reo-lightweight-markdown-editor-surface-disabled'
      )}
      data-slot="lightweight-markdown-editor-surface"
      data-testid={surfaceTestId}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <EditorContext.Provider value={{ editor }}>
        <div
          ref={toolbarShellRef}
          data-slot="lightweight-markdown-editor-toolbar"
          data-toolbar-revealed={toolbarRevealed ? 'true' : 'false'}
          className={cn(
            'flex h-[44px] min-h-[44px] min-w-0 items-center transition-opacity duration-150 ease-out motion-reduce:transition-none',
            toolbarRevealed ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
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
              <ColorHighlightPopover editor={editor} disabled={toolbarLocked} />
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
          </Toolbar>
        </div>
        <div
          data-slot="lightweight-markdown-editor-body"
          className="flex min-h-0 flex-col bg-background"
          onPaste={onPaste}
        >
          {visibleNotice ? (
            <p role="status" className="mx-20 mt-16 text-ui-sm leading-ui-sm text-muted-foreground">
              {visibleNotice}
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
