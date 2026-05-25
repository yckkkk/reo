import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  LightweightMarkdownEditorSurface,
  type LightweightMarkdownEditorHandle,
} from './LightweightMarkdownEditorSurface';

function renderEditor(
  value: string,
  editorHandleRef = createRef<LightweightMarkdownEditorHandle>(),
  options: {
    readonly onAttachmentUpload?: (file: File) => Promise<string | null> | string | null | void;
    readonly onChange?: (value: string) => void;
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
      onSave={() => undefined}
      placeholder="写下正文..."
      saveLabel="保存"
      surfaceTestId="lightweight-editor"
      value={value}
      {...(options.onAttachmentUpload ? { onAttachmentUpload: options.onAttachmentUpload } : {})}
    />
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
        onSave={() => undefined}
        placeholder="写下正文..."
        saveLabel="保存"
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
    await user.click(screen.getByTitle('打开链接'));

    expect(openMarkdownExternalLink).toHaveBeenCalledWith({ url: 'https://tiptap.dev/docs' });
    expect(windowOpenSpy).not.toHaveBeenCalled();
    windowOpenSpy.mockRestore();
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

  it('keeps editor save actions aligned away from the direct formatting buttons', () => {
    renderEditor('');

    const actionGroup = screen
      .getByTestId('lightweight-editor')
      .querySelector('[data-slot="lightweight-markdown-editor-actions"]');
    expect(actionGroup).toBeInstanceOf(HTMLElement);
    expect(actionGroup).toHaveClass('reo-lightweight-markdown-editor-actions', 'shrink-0');
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
    renderEditor('Color', editorHandleRef);

    const editor = screen.getByRole('textbox', { name: '笔记正文' });
    await user.dblClick(within(editor).getByText('Color'));
    await user.click(screen.getByRole('button', { name: '高亮' }));
    await user.click(await screen.findByRole('button', { name: /绿色高亮/ }));

    await waitFor(() => {
      expect(editorHandleRef.current?.getMarkdown()).toContain(
        '<mark data-color="#dcfce7" style="background-color: #dcfce7; color: #111827">Color</mark>'
      );
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
        onSave={() => undefined}
        placeholder="写下正文..."
        saveLabel="保存"
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
