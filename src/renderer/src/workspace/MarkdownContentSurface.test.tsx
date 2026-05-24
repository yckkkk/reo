import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownContentSurface } from './MarkdownContentSurface';

describe('MarkdownContentSurface', () => {
  it('does not render an embedded source-document frontmatter preamble as note body text', () => {
    render(
      <MarkdownContentSurface
        bodyMarkdown={`---\ntitle: "Markdown 全格式测试文档"\nauthor: "Markdown Editor QA"\ndate: "2026-05-22"\ntags:\n  - markdown\n---\n# Markdown 全格式测试文档\n\n正文内容`}
        loading={false}
        title="正文"
      />
    );

    expect(screen.queryByText(/Markdown Editor QA/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^title:/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Markdown 全格式测试文档' })).toBeInTheDocument();
    expect(screen.queryByText('# Markdown 全格式测试文档')).not.toBeInTheDocument();
    expect(screen.getByText('正文内容')).toBeInTheDocument();
  });

  it('keeps unfenced YAML-like text visible as user-authored Markdown body', () => {
    render(
      <MarkdownContentSurface
        bodyMarkdown={`title: 用户正文标题\n---\n正文内容`}
        loading={false}
        title="正文"
      />
    );

    expect(screen.getByText('title: 用户正文标题')).toBeInTheDocument();
    expect(screen.getByText('正文内容')).toBeInTheDocument();
  });

  it('renders basic Markdown block markers as reading content instead of raw source prefixes', () => {
    render(
      <MarkdownContentSurface
        bodyMarkdown={`## 小标题\n\n- 第一项\n- 第二项\n\n---\n\n正文`}
        loading={false}
        title="正文"
      />
    );

    expect(screen.getByRole('heading', { name: '小标题' })).toBeInTheDocument();
    expect(screen.queryByText('## 小标题')).not.toBeInTheDocument();
    expect(screen.getByText('第一项')).toBeInTheDocument();
    expect(screen.getByText('第二项')).toBeInTheDocument();
    expect(screen.queryByText('---')).not.toBeInTheDocument();
  });

  it('renders toolbar-supported emphasis and quote Markdown as reading content', () => {
    render(
      <MarkdownContentSurface
        bodyMarkdown={`这是一段 **粗体** 和 *强调*。\n\n> 引用内容`}
        loading={false}
        title="正文"
      />
    );

    expect(screen.getByText('粗体').tagName.toLowerCase()).toBe('strong');
    expect(screen.getByText('强调').tagName.toLowerCase()).toBe('em');
    const quote = screen.getByText('引用内容').closest('blockquote');
    expect(quote).toBeInTheDocument();
    expect(screen.queryByText('> 引用内容')).not.toBeInTheDocument();
  });

  it('does not render a table-of-contents control marker as note body text', () => {
    render(
      <MarkdownContentSurface
        bodyMarkdown={`# Markdown 全格式测试文档\n\n[TOC]\n\n正文内容`}
        loading={false}
        title="正文"
      />
    );

    expect(screen.getByRole('heading', { name: 'Markdown 全格式测试文档' })).toBeInTheDocument();
    expect(screen.queryByText('[TOC]')).not.toBeInTheDocument();
    expect(screen.getByText('正文内容')).toBeInTheDocument();
  });

  it('renders fenced code blocks as code containers instead of raw fence text', () => {
    render(
      <MarkdownContentSurface
        bodyMarkdown={
          'TypeScript 代码块：\n\n```ts\nconst value = "copyable";\nconsole.log(value);\n```\n\n正文'
        }
        loading={false}
        title="正文"
      />
    );

    expect(screen.getByText('TypeScript 代码块：')).toBeInTheDocument();
    expect(screen.getByText('ts')).toBeInTheDocument();
    const code = screen.getByText(/const value = "copyable";/);
    expect(code.tagName.toLowerCase()).toBe('code');
    expect(code).toHaveTextContent('console.log(value);');
    expect(screen.queryByText('```ts')).not.toBeInTheDocument();
    expect(screen.queryByText('```')).not.toBeInTheDocument();
  });

  it('renders extended fenced code blocks with attributes or longer fence markers', () => {
    render(
      <MarkdownContentSurface
        bodyMarkdown={
          '带属性代码块：\n\n```js {title="example.js" lineNumbers=true}\nconsole.log("attrs");\n```\n\n四反引号代码块：\n\n````\n```text\ninside fence\n```\n````\n\n波浪线代码块：\n\n~~~diff\n+ added\n~~~'
        }
        loading={false}
        title="正文"
      />
    );

    expect(screen.getByText('js')).toBeInTheDocument();
    expect(screen.getByText('diff')).toBeInTheDocument();
    expect(screen.getByText(/console\.log\("attrs"\);/).tagName.toLowerCase()).toBe('code');
    expect(screen.getByText(/```text/).tagName.toLowerCase()).toBe('code');
    expect(screen.getByText(/\+ added/).tagName.toLowerCase()).toBe('code');
    expect(
      screen.queryByText('```js {title="example.js" lineNumbers=true}')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('~~~diff')).not.toBeInTheDocument();
  });

  it('visually indents nested list items from Markdown leading whitespace', () => {
    render(
      <MarkdownContentSurface
        bodyMarkdown={'- 一级列表 A\n  - 二级列表 A1\n    - 三级列表 A1a\n- 一级列表 B'}
        loading={false}
        title="正文"
      />
    );

    const firstLevel = screen.getByText('一级列表 A').closest('[data-list-depth]');
    const secondLevel = screen.getByText('二级列表 A1').closest('[data-list-depth]');
    const thirdLevel = screen.getByText('三级列表 A1a').closest('[data-list-depth]');

    expect(firstLevel).toHaveAttribute('data-list-depth', '0');
    expect(secondLevel).toHaveAttribute('data-list-depth', '1');
    expect(thirdLevel).toHaveAttribute('data-list-depth', '2');
  });

  it('opens the owner editor from loaded reading content without stealing text selection', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    render(
      <MarkdownContentSurface
        bodyMarkdown={'## 可编辑正文\n\n正文内容'}
        loading={false}
        onEdit={onEdit}
        title="正文"
      />
    );

    await user.click(screen.getByRole('heading', { name: '可编辑正文' }));

    expect(onEdit).toHaveBeenCalledOnce();

    const selection = window.getSelection();
    selection?.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(screen.getByText('正文内容'));
    selection?.addRange(range);

    await user.click(screen.getByText('正文内容'));

    expect(onEdit).toHaveBeenCalledOnce();
  });
});
