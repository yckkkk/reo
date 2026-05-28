import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { JSONContent } from '@tiptap/core';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  LightweightMarkdownEditorSurface,
  type LightweightMarkdownEditorHandle,
} from './LightweightMarkdownEditorSurface';
import {
  IMMERSIVE_WORKSPACE_ALERT_OVERLAY_Z_CLASS,
  IMMERSIVE_WORKSPACE_SURFACE_CONTENT_Z_CLASS,
} from './immersiveWorkspaceLayers';

function renderEditor(
  value: string,
  editorHandleRef = createRef<LightweightMarkdownEditorHandle>(),
  options: {
    readonly onAttachmentUpload?: (file: File) => Promise<string | null> | string | null | void;
    readonly onChange?: (value: string) => void;
    readonly onRichChange?: Parameters<typeof LightweightMarkdownEditorSurface>[0]['onRichChange'];
    readonly valueTiptapJson?: Parameters<
      typeof LightweightMarkdownEditorSurface
    >[0]['valueTiptapJson'];
  } = {}
) {
  return render(
    <LightweightMarkdownEditorSurface
      attachmentContext={{
        kind: 'segment',
        workspaceId: 'ws_1',
        segmentId: 'seg_1',
      }}
      editorId="lightweight-editor-body"
      editorLabel="笔记正文"
      editorHandleRef={editorHandleRef}
      headerLabel="格式笔记"
      onChange={options.onChange ?? (() => undefined)}
      placeholder="写下正文..."
      surfaceTestId="lightweight-editor"
      value={value}
      {...(options.onAttachmentUpload ? { onAttachmentUpload: options.onAttachmentUpload } : {})}
      {...(options.onRichChange ? { onRichChange: options.onRichChange } : {})}
      {...(options.valueTiptapJson ? { valueTiptapJson: options.valueTiptapJson } : {})}
    />
  );
}

function walkJsonContent(node: JSONContent | null | undefined, visit: (node: JSONContent) => void) {
  if (!node) return;
  visit(node);
  for (const child of node.content ?? []) {
    walkJsonContent(child, visit);
  }
}

function textNodeWithMark(
  doc: JSONContent | null | undefined,
  text: string,
  markType: string
): JSONContent | null {
  let matched: JSONContent | null = null;
  walkJsonContent(doc, (node) => {
    if (matched || node.type !== 'text' || node.text !== text) {
      return;
    }
    if ((node.marks ?? []).some((mark) => mark.type === markType)) {
      matched = node;
    }
  });
  return matched;
}

function firstNodeOfType(
  doc: JSONContent | null | undefined,
  nodeType: string
): JSONContent | null {
  let matched: JSONContent | null = null;
  walkJsonContent(doc, (node) => {
    if (!matched && node.type === nodeType) {
      matched = node;
    }
  });
  return matched;
}

function zIndexNumber(value: string) {
  return Number(value.match(/z-\[(\d+)]/)?.[1] ?? value);
}

function computedZIndex(element: HTMLElement) {
  return zIndexNumber(window.getComputedStyle(element).zIndex);
}

function expectEditorFloatingLayerAboveImmersiveSurface(element: HTMLElement) {
  expect(computedZIndex(element)).toBeGreaterThan(
    zIndexNumber(IMMERSIVE_WORKSPACE_SURFACE_CONTENT_Z_CLASS)
  );
  expect(computedZIndex(element)).toBeLessThan(
    zIndexNumber(IMMERSIVE_WORKSPACE_ALERT_OVERLAY_Z_CLASS)
  );
}

describe('LightweightMarkdownEditorSurface', () => {
  it('renders supported Markdown as Notes-like editable formatting instead of raw markers', () => {
    renderEditor('这是一段 **粗体** 和 *斜体*。\n\n- 第一项\n- 第二项\n\n1. 第一条\n2. 第二条');

    const editor = screen.getByRole('textbox', { name: '笔记正文' });
    expect(editor).toHaveAttribute('contenteditable', 'true');

    const strongText = within(editor).getByText('粗体');
    const emphasisText = within(editor).getByText('斜体');
    expect(strongText.tagName.toLowerCase()).toBe('strong');
    expect(emphasisText.tagName.toLowerCase()).toBe('em');
    expect(within(editor).queryByText(/\*\*/)).not.toBeInTheDocument();
    expect(within(editor).queryByText('*斜体*')).not.toBeInTheDocument();

    const lists = within(editor).getAllByRole('list');
    expect(lists).toHaveLength(2);
    expect(within(lists[0] as HTMLElement).getAllByRole('listitem')).toHaveLength(2);
    expect(within(lists[1] as HTMLElement).getAllByRole('listitem')).toHaveLength(2);
    expect(within(editor).queryByText('- 第一项')).not.toBeInTheDocument();
    expect(within(editor).queryByText('1. 第一条')).not.toBeInTheDocument();
  });

  it('renders Markdown image references as editable image nodes while keeping Markdown as the contract', () => {
    const editorHandleRef = createRef<LightweightMarkdownEditorHandle>();
    renderEditor(
      '![Local cake](attachments/cake.png)\n\n![Remote cake](https://example.test/cake.png)',
      editorHandleRef
    );

    const editor = screen.getByRole('textbox', { name: '笔记正文' });
    expect(
      within(editor).queryByText('![Local cake](attachments/cake.png)')
    ).not.toBeInTheDocument();
    expect(within(editor).getByRole('img', { name: 'Local cake' })).toHaveAttribute(
      'src',
      'reo-attachment://ws_1/segments/seg_1/cake.png'
    );
    const remoteImage = within(editor).getByRole('img', { name: 'Remote cake' });
    expect(remoteImage).not.toHaveAttribute('src');
    expect(remoteImage).toHaveAttribute('data-reo-image-source', 'unsupported');
    expect(editorHandleRef.current?.getMarkdown()).toContain(
      '![Local cake](attachments/cake.png)\n\n![Remote cake](https://example.test/cake.png)'
    );
  });

  it('accepts direct Markdown file edits as normal Tiptap content without exposing source markers', async () => {
    const editorHandleRef = createRef<LightweightMarkdownEditorHandle>();
    const { rerender } = renderEditor('普通正文', editorHandleRef);

    rerender(
      <LightweightMarkdownEditorSurface
        attachmentContext={{
          kind: 'segment',
          workspaceId: 'ws_1',
          segmentId: 'seg_1',
        }}
        editorId="lightweight-editor-body"
        editorLabel="笔记正文"
        editorHandleRef={editorHandleRef}
        headerLabel="格式笔记"
        onChange={() => undefined}
        placeholder="写下正文..."
        surfaceTestId="lightweight-editor"
        value={`# Codex 标题\n\n> Codex 引用\n\n\`\`\`ts\nconst source = 'markdown';\n\`\`\`\n\n- Codex 列表`}
      />
    );

    const editor = screen.getByRole('textbox', { name: '笔记正文' });
    expect(
      await within(editor).findByRole('heading', { name: 'Codex 标题', level: 1 })
    ).toBeInTheDocument();
    expect(editor.querySelector('blockquote')).toHaveTextContent('Codex 引用');
    expect(editor.querySelector('pre code')).toHaveTextContent("const source = 'markdown';");
    expect(within(editor).getByRole('listitem')).toHaveTextContent('Codex 列表');
    expect(within(editor).queryByText('# Codex 标题')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(editorHandleRef.current?.getMarkdown()).toContain('# Codex 标题');
    });
  });

  it('initializes from Tiptap JSON and emits rich changes', async () => {
    const user = userEvent.setup();
    const onRichChange = vi.fn();
    renderEditor('Ignored markdown', createRef<LightweightMarkdownEditorHandle>(), {
      onRichChange,
      valueTiptapJson: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'JSON body',
                marks: [{ type: 'highlight' }],
              },
            ],
          },
        ],
      },
    });

    const editor = screen.getByRole('textbox', { name: '笔记正文' });
    expect(editor).toHaveTextContent('JSON body');

    await user.click(editor);
    await user.keyboard(' updated');

    await waitFor(() => {
      expect(onRichChange).toHaveBeenCalled();
    });
    const latest = onRichChange.mock.calls.at(-1)?.[0];
    expect(latest?.markdown).toContain('JSON body');
    expect(latest?.tiptapJson.type).toBe('doc');
  });

  it('surfaces Tiptap content errors without replacing the current document', async () => {
    const editorHandleRef = createRef<LightweightMarkdownEditorHandle>();
    const { rerender } = renderEditor('Stable body', editorHandleRef);

    rerender(
      <LightweightMarkdownEditorSurface
        attachmentContext={{
          kind: 'segment',
          workspaceId: 'ws_1',
          segmentId: 'seg_1',
        }}
        editorId="lightweight-editor-body"
        editorLabel="笔记正文"
        editorHandleRef={editorHandleRef}
        headerLabel="格式笔记"
        onChange={() => undefined}
        placeholder="写下正文..."
        surfaceTestId="lightweight-editor"
        value="Stable body"
        valueTiptapJson={
          {
            type: 'doc',
            content: [{ type: 'unsupportedNode', attrs: { id: 'external-json-drift' } }],
          } as Parameters<typeof LightweightMarkdownEditorSurface>[0]['valueTiptapJson']
        }
      />
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      '富文本结构无法按当前编辑器模型读取。'
    );
    expect(editorHandleRef.current?.getMarkdown()).toContain('Stable body');
  });

  it('does not carry undo history across content target changes', async () => {
    const editorHandleRef = createRef<LightweightMarkdownEditorHandle>();
    const onChange = vi.fn();
    const { rerender } = render(
      <LightweightMarkdownEditorSurface
        editorId="targeted-editor-body"
        editorLabel="笔记正文"
        editorHandleRef={editorHandleRef}
        editorTargetKey="target-one"
        headerLabel="格式笔记"
        onChange={onChange}
        placeholder="写下正文..."
        surfaceTestId="targeted-editor"
        value="Old target"
      />
    );

    editorHandleRef.current?.insertMarkdown('Edited ');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '撤销' })).toHaveAttribute(
        'data-disabled',
        'false'
      );
    });

    rerender(
      <LightweightMarkdownEditorSurface
        editorId="targeted-editor-body"
        editorLabel="笔记正文"
        editorHandleRef={editorHandleRef}
        editorTargetKey="target-two"
        headerLabel="格式笔记"
        onChange={onChange}
        placeholder="写下正文..."
        surfaceTestId="targeted-editor"
        value="New target"
      />
    );

    await waitFor(() => {
      expect(editorHandleRef.current?.getMarkdown()).toContain('New target');
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '撤销' })).toHaveAttribute('data-disabled', 'true');
    });
  });

  it('exposes the official Simple Editor toolbar shape with real command controls', async () => {
    const user = userEvent.setup();
    const onAttachmentUpload = vi.fn<(file: File) => string>(() => 'attachments/cake.png');
    renderEditor('', createRef<LightweightMarkdownEditorHandle>(), { onAttachmentUpload });

    expect(screen.getByRole('toolbar', { name: '文本编辑工具栏' })).toHaveClass('tiptap-toolbar');
    for (const label of [
      '标题',
      '列表',
      '引用',
      '代码块',
      '粗体',
      '斜体',
      '删除线',
      '行内代码',
      '下划线',
      '高亮',
      '链接',
      '上标',
      '下标',
      '左对齐',
      '居中对齐',
      '右对齐',
      '两端对齐',
      '添加图片',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: '撤销' })).toHaveAttribute('data-disabled', 'true');
    expect(screen.getByRole('button', { name: '重做' })).toHaveAttribute('data-disabled', 'true');

    await user.click(screen.getByRole('button', { name: '标题' }));
    expect(await screen.findByRole('menuitem', { name: '标题 1' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '标题 4' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: '列表' }));
    expect(await screen.findByRole('menuitem', { name: /项目符号列表/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /编号列表/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /待办列表/ })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: '高亮' }));
    expect(await screen.findByRole('button', { name: /绿色高亮/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '清除高亮' })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: '格式' })).not.toBeInTheDocument();
    expect(screen.queryByRole('toolbar', { name: 'Markdown 格式工具栏' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '切换主题' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument();
  });

  it('layers toolbar dropdowns and popovers above immersive editor surfaces', async () => {
    const user = userEvent.setup();
    renderEditor('');

    await user.click(screen.getByRole('button', { name: '标题' }));
    const headingMenu = await screen.findByRole('menuitem', { name: '标题 1' });
    const dropdownContent = headingMenu.closest('[data-slot="tiptap-dropdown-menu-content"]');
    expect(dropdownContent).toBeInstanceOf(HTMLElement);
    expectEditorFloatingLayerAboveImmersiveSurface(dropdownContent as HTMLElement);

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: '高亮' }));
    const highlightButton = await screen.findByRole('button', { name: /绿色高亮/ });
    const popoverContent = highlightButton.closest('.tiptap-popover');
    expect(popoverContent).toBeInstanceOf(HTMLElement);
    expectEditorFloatingLayerAboveImmersiveSurface(popoverContent as HTMLElement);
  });

  it('uses the official Simple Editor node styling for the editable content area', async () => {
    renderEditor('# 标题\n\n- [ ] 待办');

    const editor = screen.getByRole('textbox', { name: '笔记正文' });
    expect(editor).toHaveClass('simple-editor');
    expect(editor).toHaveClass('reo-lightweight-markdown-editor');
    const taskItem = await waitFor(() => {
      const item = editor.querySelector('ul[data-type="taskList"] > li');
      expect(item).toBeInstanceOf(HTMLElement);
      return item as HTMLElement;
    });
    expect(taskItem.querySelector(':scope > label + div')).toBeInstanceOf(HTMLElement);
    expect(within(taskItem).getByText('待办')).toBeInTheDocument();
  });

  it('opens the official link popover instead of a native prompt', async () => {
    const user = userEvent.setup();
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('https://example.test');
    renderEditor('链接');

    await user.click(screen.getByRole('button', { name: /link|链接/i }));

    expect(promptSpy).not.toHaveBeenCalled();
    expect(await screen.findByPlaceholderText('粘贴链接...')).toBeInTheDocument();
    promptSpy.mockRestore();
  });

  it('does not open link editing controls from the initial content selection', async () => {
    renderEditor(
      '[Simple Editor template](https://tiptap.dev/docs/ui-components/templates/simple-editor)'
    );

    expect(screen.getByRole('button', { name: '链接' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('粘贴链接...')).not.toBeInTheDocument();
  });

  it('does not present list toolbar active state from the initial content selection', () => {
    renderEditor('- [ ] Task item');

    expect(screen.getByRole('button', { name: '列表' })).toHaveAttribute(
      'data-active-state',
      'off'
    );
  });

  it('does not open link editing controls from the stale initial selection on first editor focus', async () => {
    const user = userEvent.setup();
    renderEditor(
      '[Simple Editor template](https://tiptap.dev/docs/ui-components/templates/simple-editor)'
    );

    await user.click(screen.getByRole('textbox', { name: '笔记正文' }));

    expect(screen.queryByPlaceholderText('粘贴链接...')).not.toBeInTheDocument();
  });

  it('does not activate list toolbar state from the stale initial selection on first editor focus', async () => {
    const user = userEvent.setup();
    renderEditor('- [ ] Task item');

    await user.click(screen.getByRole('textbox', { name: '笔记正文' }));

    expect(screen.getByRole('button', { name: '列表' })).toHaveAttribute(
      'data-active-state',
      'off'
    );
  });

  it('opens link popover URLs through the Reo external link bridge', async () => {
    const user = userEvent.setup();
    const openMarkdownExternalLink = vi.fn(async () => ({ ok: true, value: {} }));
    const windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    Object.defineProperty(window, 'reoWorkspace', {
      configurable: true,
      value: {
        openMarkdownExternalLink,
      } as unknown as Window['reoWorkspace'],
    });
    renderEditor('链接');

    await user.click(screen.getByRole('button', { name: '链接' }));
    await user.type(await screen.findByPlaceholderText('粘贴链接...'), 'https://tiptap.dev/docs');
    await user.click(screen.getByRole('button', { name: '打开链接' }));

    expect(openMarkdownExternalLink).toHaveBeenCalledWith({ url: 'https://tiptap.dev/docs' });
    expect(windowOpenSpy).not.toHaveBeenCalled();
    windowOpenSpy.mockRestore();
  });

  it('does not externally open relative link popover URLs', async () => {
    const user = userEvent.setup();
    const openMarkdownExternalLink = vi.fn(async () => ({ ok: true, value: {} }));
    Object.defineProperty(window, 'reoWorkspace', {
      configurable: true,
      value: {
        openMarkdownExternalLink,
      } as unknown as Window['reoWorkspace'],
    });
    renderEditor('链接');

    await user.click(screen.getByRole('button', { name: '链接' }));
    await user.type(await screen.findByPlaceholderText('粘贴链接...'), 'docs/page');
    await user.click(screen.getByRole('button', { name: '打开链接' }));

    expect(openMarkdownExternalLink).not.toHaveBeenCalled();
  });

  it('does not persist unsafe link toolbar URLs', async () => {
    const user = userEvent.setup();
    const editorHandleRef = createRef<LightweightMarkdownEditorHandle>();
    const onRichChange = vi.fn();
    renderEditor('Link', editorHandleRef, { onRichChange });

    const editor = screen.getByRole('textbox', { name: '笔记正文' });
    await user.dblClick(within(editor).getByText('Link'));
    await user.click(screen.getByRole('button', { name: '链接' }));
    await user.type(await screen.findByPlaceholderText('粘贴链接...'), 'javascript:alert(1)');
    await user.click(screen.getByRole('button', { name: '应用链接' }));

    await waitFor(() => {
      expect(editorHandleRef.current?.getMarkdown()).not.toContain('javascript:alert');
    });
    expect(textNodeWithMark(onRichChange.mock.calls.at(-1)?.[0]?.tiptapJson, 'Link', 'link')).toBe(
      null
    );
  });

  it('strips credential link hrefs through the official Tiptap Link boundary', async () => {
    renderEditor('', createRef<LightweightMarkdownEditorHandle>(), {
      valueTiptapJson: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Credential link',
                marks: [{ type: 'link', attrs: { href: 'https://user@example.com' } }],
              },
            ],
          },
        ],
      },
    });

    const link = await screen.findByText('Credential link');
    const anchor = link.closest('a');
    expect(anchor).not.toBeNull();
    expect(anchor as HTMLAnchorElement).not.toHaveAttribute('href', 'https://user@example.com');
  });

  it('inserts the official image upload node before choosing files', async () => {
    const user = userEvent.setup();
    const onAttachmentUpload = vi.fn<(file: File) => string>(() => 'attachments/cake.png');
    renderEditor('', createRef<LightweightMarkdownEditorHandle>(), { onAttachmentUpload });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '添加图片' })).toHaveAttribute(
        'data-disabled',
        'false'
      )
    );
    await user.click(screen.getByRole('button', { name: '添加图片' }));

    expect(await screen.findByText(/点击上传/)).toBeInTheDocument();
    expect(screen.getByText(/拖放图片/)).toBeInTheDocument();
    expect(onAttachmentUpload).not.toHaveBeenCalled();
  });

  it('keeps each successful image upload paired with its source file metadata', async () => {
    const user = userEvent.setup();
    const editorHandleRef = createRef<LightweightMarkdownEditorHandle>();
    const onAttachmentUpload = vi.fn<(file: File) => string | null>((file) =>
      file.name === 'second.png' ? 'attachments/second.png' : null
    );
    renderEditor('', editorHandleRef, { onAttachmentUpload });

    await user.click(screen.getByRole('button', { name: '添加图片' }));
    const input = document.querySelector('input[type="file"]');
    expect(input).toBeInstanceOf(HTMLInputElement);
    await user.upload(input as HTMLInputElement, [
      new File(['first'], 'first.png', { type: 'image/png' }),
      new File(['second'], 'second.png', { type: 'image/png' }),
    ]);

    await waitFor(() => {
      expect(editorHandleRef.current?.getMarkdown()).toContain(
        '![second](attachments/second.png "second")'
      );
    });
    expect(editorHandleRef.current?.getMarkdown()).not.toContain('![first]');
  });

  it('does not render manual save actions inside the editor toolbar', () => {
    renderEditor('');

    const actionGroup = screen
      .getByTestId('lightweight-editor')
      .querySelector('[data-slot="lightweight-markdown-editor-actions"]');
    expect(actionGroup).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument();
  });

  it('renders list toolbar results with visible list marker styling', async () => {
    const user = userEvent.setup();
    const editorHandleRef = createRef<LightweightMarkdownEditorHandle>();
    renderEditor('列表项', editorHandleRef);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '列表' })).toHaveAttribute('data-disabled', 'false')
    );
    await user.click(screen.getByRole('button', { name: '列表' }));
    await user.click(await screen.findByRole('menuitem', { name: /项目符号列表/ }));
    await screen.findByRole('list');
    await waitFor(() => {
      expect(editorHandleRef.current?.getMarkdown()).toMatch(/^- 列表项/m);
    });

    await user.click(screen.getByRole('button', { name: '列表' }));
    await user.click(await screen.findByRole('menuitem', { name: /编号列表/ }));
    await waitFor(() => {
      expect(editorHandleRef.current?.getMarkdown()).toMatch(/^1\. 列表项/m);
    });
  });

  it('keeps StarterKit input rules and serializes toolbar formatting as Markdown', async () => {
    const user = userEvent.setup();
    const editorHandleRef = createRef<LightweightMarkdownEditorHandle>();
    renderEditor('', editorHandleRef);

    const editor = screen.getByRole('textbox', { name: '笔记正文' });
    await user.click(editor);
    await user.type(editor, '# ');

    expect(editor.querySelector('h1')).toBeInTheDocument();
    expect(within(editor).queryByText('#')).not.toBeInTheDocument();
  });

  it('serializes toolbar mark commands through the Markdown pipeline', async () => {
    const user = userEvent.setup();
    const editorHandleRef = createRef<LightweightMarkdownEditorHandle>();
    renderEditor('Bold', editorHandleRef);

    const editor = screen.getByRole('textbox', { name: '笔记正文' });
    await user.dblClick(within(editor).getByText('Bold'));
    await user.click(screen.getByRole('button', { name: '粗体' }));
    await waitFor(() => {
      expect(editorHandleRef.current?.getMarkdown()).toContain('**Bold**');
    });
  });

  it('offers official highlight colors and serializes chosen color as Markdown-compatible HTML', async () => {
    const user = userEvent.setup();
    const editorHandleRef = createRef<LightweightMarkdownEditorHandle>();
    const onRichChange = vi.fn();
    renderEditor('Color', editorHandleRef, { onRichChange });

    const editor = screen.getByRole('textbox', { name: '笔记正文' });
    await user.dblClick(within(editor).getByText('Color'));
    await user.click(screen.getByRole('button', { name: '高亮' }));
    await user.click(await screen.findByRole('button', { name: /绿色高亮/ }));

    await waitFor(() => {
      expect(editorHandleRef.current?.getMarkdown()).toContain(
        '<mark data-color="var(--tt-color-highlight-green)" style="background-color: var(--tt-color-highlight-green); color: inherit">Color</mark>'
      );
    });
    await waitFor(() => {
      const highlighted = textNodeWithMark(
        onRichChange.mock.calls.at(-1)?.[0]?.tiptapJson,
        'Color',
        'highlight'
      );
      expect(highlighted?.marks?.[0]?.attrs).toEqual({
        color: 'var(--tt-color-highlight-green)',
      });
    });
  });

  it('serializes heading dropdown commands as Markdown and Tiptap JSON', async () => {
    const user = userEvent.setup();
    const editorHandleRef = createRef<LightweightMarkdownEditorHandle>();
    const onRichChange = vi.fn();
    renderEditor('Heading', editorHandleRef, { onRichChange });

    const editor = screen.getByRole('textbox', { name: '笔记正文' });
    await user.click(within(editor).getByText('Heading'));
    await user.click(screen.getByRole('button', { name: '标题' }));
    await user.click(await screen.findByRole('menuitem', { name: '标题 2' }));

    await waitFor(() => {
      expect(editorHandleRef.current?.getMarkdown()).toMatch(/^## Heading/m);
    });
    await waitFor(() => {
      const heading = firstNodeOfType(onRichChange.mock.calls.at(-1)?.[0]?.tiptapJson, 'heading');
      expect(heading?.attrs).toMatchObject({ level: 2 });
    });
  });

  it.each([
    { buttonName: '下划线', markType: 'underline', text: 'Underline', markdown: '++Underline++' },
    { buttonName: '上标', markType: 'superscript', text: 'Sup', markdown: '<sup>Sup</sup>' },
    { buttonName: '下标', markType: 'subscript', text: 'Sub', markdown: '<sub>Sub</sub>' },
    { buttonName: '行内代码', markType: 'code', text: 'Code', markdown: '`Code`' },
  ])(
    'serializes toolbar $buttonName mark commands as Markdown and Tiptap JSON',
    async ({ buttonName, markType, text, markdown }) => {
      const user = userEvent.setup();
      const editorHandleRef = createRef<LightweightMarkdownEditorHandle>();
      const onRichChange = vi.fn();
      renderEditor(text, editorHandleRef, { onRichChange });

      const editor = screen.getByRole('textbox', { name: '笔记正文' });
      await user.dblClick(within(editor).getByText(text));
      await user.click(screen.getByRole('button', { name: buttonName }));

      await waitFor(() => {
        expect(editorHandleRef.current?.getMarkdown()).toContain(markdown);
      });
      await waitFor(() => {
        expect(
          textNodeWithMark(onRichChange.mock.calls.at(-1)?.[0]?.tiptapJson, text, markType)
        ).not.toBeNull();
      });
    }
  );

  it('serializes link toolbar commands as Markdown and Tiptap JSON', async () => {
    const user = userEvent.setup();
    const editorHandleRef = createRef<LightweightMarkdownEditorHandle>();
    const onRichChange = vi.fn();
    renderEditor('Link', editorHandleRef, { onRichChange });

    const editor = screen.getByRole('textbox', { name: '笔记正文' });
    await user.dblClick(within(editor).getByText('Link'));
    await user.click(screen.getByRole('button', { name: '链接' }));
    await user.type(await screen.findByPlaceholderText('粘贴链接...'), 'https://example.com');
    await user.click(screen.getByRole('button', { name: '应用链接' }));

    await waitFor(() => {
      expect(editorHandleRef.current?.getMarkdown()).toContain('[Link](https://example.com)');
    });
    await waitFor(() => {
      const linked = textNodeWithMark(
        onRichChange.mock.calls.at(-1)?.[0]?.tiptapJson,
        'Link',
        'link'
      );
      expect(linked?.marks?.[0]?.attrs).toMatchObject({ href: 'https://example.com' });
    });
  });

  it('renders durable sidecar JSON marks and attrs through the Tiptap surface', async () => {
    const pink = 'var(--tt-color-highlight-pink)';
    renderEditor('', createRef<LightweightMarkdownEditorHandle>(), {
      valueTiptapJson: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { textAlign: 'right' },
            content: [
              {
                type: 'text',
                text: 'Pink highlight',
                marks: [{ type: 'highlight', attrs: { color: pink } }],
              },
              { type: 'text', text: ' underlined', marks: [{ type: 'underline' }] },
              {
                type: 'text',
                text: ' link',
                marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
              },
              { type: 'text', text: ' sup', marks: [{ type: 'superscript' }] },
              { type: 'text', text: ' sub', marks: [{ type: 'subscript' }] },
            ],
          },
        ],
      },
    });

    const editor = screen.getByRole('textbox', { name: '笔记正文' });
    const highlighted = await within(editor).findByText('Pink highlight');
    expect(highlighted.closest('mark')).toHaveAttribute('data-color', pink);
    expect(within(editor).getByText('underlined').closest('u')).not.toBeNull();
    expect(within(editor).getByText('link').closest('a')).toHaveAttribute(
      'href',
      'https://example.com'
    );
    expect(within(editor).getByText('sup').closest('sup')).not.toBeNull();
    expect(within(editor).getByText('sub').closest('sub')).not.toBeNull();
    expect(highlighted.closest('p')).toHaveStyle({ textAlign: 'right' });
  });

  it('serializes blockquote toolbar commands as Markdown and Tiptap JSON', async () => {
    const user = userEvent.setup();
    const editorHandleRef = createRef<LightweightMarkdownEditorHandle>();
    const onRichChange = vi.fn();
    renderEditor('Quote', editorHandleRef, { onRichChange });

    const editor = screen.getByRole('textbox', { name: '笔记正文' });
    await user.click(within(editor).getByText('Quote'));
    await user.click(screen.getByRole('button', { name: '引用' }));

    await waitFor(() => {
      expect(editorHandleRef.current?.getMarkdown()).toMatch(/^> Quote/m);
    });
    await waitFor(() => {
      expect(
        firstNodeOfType(onRichChange.mock.calls.at(-1)?.[0]?.tiptapJson, 'blockquote')
      ).not.toBeNull();
    });
  });

  it('serializes code block toolbar commands as Markdown and Tiptap JSON', async () => {
    const user = userEvent.setup();
    const editorHandleRef = createRef<LightweightMarkdownEditorHandle>();
    const onRichChange = vi.fn();
    renderEditor('const value = 1', editorHandleRef, { onRichChange });

    const editor = screen.getByRole('textbox', { name: '笔记正文' });
    await user.click(within(editor).getByText('const value = 1'));
    await user.click(screen.getByRole('button', { name: '代码块' }));

    await waitFor(() => {
      expect(editorHandleRef.current?.getMarkdown()).toContain('```\nconst value = 1\n```');
    });
    await waitFor(() => {
      expect(
        firstNodeOfType(onRichChange.mock.calls.at(-1)?.[0]?.tiptapJson, 'codeBlock')
      ).not.toBeNull();
    });
  });

  it('serializes task list toolbar commands and checkbox state as Markdown and Tiptap JSON', async () => {
    const user = userEvent.setup();
    const editorHandleRef = createRef<LightweightMarkdownEditorHandle>();
    const onRichChange = vi.fn();
    renderEditor('Task item', editorHandleRef, { onRichChange });

    const editor = screen.getByRole('textbox', { name: '笔记正文' });
    await user.click(within(editor).getByText('Task item'));
    await user.click(screen.getByRole('button', { name: '列表' }));
    await user.click(await screen.findByRole('menuitem', { name: /待办列表/ }));

    await waitFor(() => {
      expect(editorHandleRef.current?.getMarkdown()).toMatch(/^- \[ \] Task item/m);
    });
    await waitFor(() => {
      expect(
        firstNodeOfType(onRichChange.mock.calls.at(-1)?.[0]?.tiptapJson, 'taskList')
      ).not.toBeNull();
    });

    await user.click(within(editor).getByRole('checkbox', { name: '待办复选框：Task item' }));

    await waitFor(() => {
      expect(editorHandleRef.current?.getMarkdown()).toMatch(/^- \[x\] Task item/m);
    });
    await waitFor(() => {
      expect(
        firstNodeOfType(editorHandleRef.current?.getTiptapJson(), 'taskItem')?.attrs
      ).toMatchObject({ checked: true });
    });
  });

  it('serializes alignment toolbar commands as Markdown and Tiptap JSON', async () => {
    const user = userEvent.setup();
    const editorHandleRef = createRef<LightweightMarkdownEditorHandle>();
    const onRichChange = vi.fn();
    renderEditor('Centered', editorHandleRef, { onRichChange });

    const editor = screen.getByRole('textbox', { name: '笔记正文' });
    await user.click(within(editor).getByText('Centered'));
    await user.click(screen.getByRole('button', { name: '居中对齐' }));

    await waitFor(() => {
      expect(editorHandleRef.current?.getMarkdown()).toContain(
        '<p style="text-align: center">Centered</p>'
      );
    });
    await waitFor(() => {
      const paragraph = firstNodeOfType(
        onRichChange.mock.calls.at(-1)?.[0]?.tiptapJson,
        'paragraph'
      );
      expect(paragraph?.attrs).toMatchObject({ textAlign: 'center' });
    });
  });

  it('round-trips Simple Editor extension content through Markdown', async () => {
    const editorHandleRef = createRef<LightweightMarkdownEditorHandle>();
    renderEditor(
      [
        '==高亮==',
        '',
        '- [ ] 待办',
        '',
        '<p style="text-align: center">居中</p>',
        '',
        '<sup>上标</sup> 和 <sub>下标</sub>',
      ].join('\n'),
      editorHandleRef
    );

    const editor = screen.getByRole('textbox', { name: '笔记正文' });
    expect(within(editor).getByText('高亮').tagName.toLowerCase()).toBe('mark');
    expect(within(editor).getByRole('checkbox')).not.toBeChecked();
    expect(within(editor).getByText('居中')).toHaveStyle({ textAlign: 'center' });
    expect(within(editor).getByText('上标').tagName.toLowerCase()).toBe('sup');
    expect(within(editor).getByText('下标').tagName.toLowerCase()).toBe('sub');
    await waitFor(() => {
      const markdown = editorHandleRef.current?.getMarkdown() ?? '';
      expect(markdown).toContain('==高亮==');
      expect(markdown).toContain('- [ ] 待办');
      expect(markdown).toContain('<p style="text-align: center">居中</p>');
      expect(markdown).toContain('<sup>上标</sup>');
      expect(markdown).toContain('<sub>下标</sub>');
    });
  });

  it('round-trips tokenized highlight colors through Markdown without freezing light colors', async () => {
    const editorHandleRef = createRef<LightweightMarkdownEditorHandle>();
    renderEditor(
      '<mark data-color="var(--tt-color-highlight-green)" style="background-color: var(--tt-color-highlight-green); color: inherit">Token highlight</mark>',
      editorHandleRef
    );

    const editor = screen.getByRole('textbox', { name: '笔记正文' });
    expect(within(editor).getByText('Token highlight').tagName.toLowerCase()).toBe('mark');
    await waitFor(() => {
      expect(editorHandleRef.current?.getMarkdown()).toContain(
        '<mark data-color="var(--tt-color-highlight-green)" style="background-color: var(--tt-color-highlight-green); color: inherit">Token highlight</mark>'
      );
    });
  });

  it('inserts Markdown image content through the Tiptap Markdown pipeline', async () => {
    const editorHandleRef = createRef<LightweightMarkdownEditorHandle>();
    renderEditor('', editorHandleRef);

    editorHandleRef.current?.insertMarkdown('![Codex image](attachments/codex.png)');

    const editor = screen.getByRole('textbox', { name: '笔记正文' });
    expect(await within(editor).findByRole('img', { name: 'Codex image' })).toHaveAttribute(
      'src',
      'reo-attachment://ws_1/segments/seg_1/codex.png'
    );
    await waitFor(() => {
      expect(editorHandleRef.current?.getMarkdown()).toContain(
        '![Codex image](attachments/codex.png)'
      );
    });
  });

  it('reports Markdown changes through the existing controlled editor contract', async () => {
    const onChange = vi.fn();
    const editorHandleRef = createRef<LightweightMarkdownEditorHandle>();

    render(
      <LightweightMarkdownEditorSurface
        editorId="lightweight-editor-body"
        editorLabel="笔记正文"
        editorHandleRef={editorHandleRef}
        headerLabel="格式笔记"
        onChange={onChange}
        placeholder="写下正文..."
        surfaceTestId="lightweight-editor"
        value=""
      />
    );

    expect(onChange).not.toHaveBeenCalled();
    editorHandleRef.current?.insertMarkdown('**Codex** 编辑');
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(expect.stringContaining('**Codex** 编辑'));
    });
  });
});
