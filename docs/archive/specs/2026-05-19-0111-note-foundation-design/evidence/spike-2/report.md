# Spike #2 Round-trip Report

## What Ran

- Sandbox: `.tmp/note-foundation-spikes/spike-2-roundtrip/`
- Fixtures: 25
- Command: `npm install @blocknote/core unified remark-parse remark-gfm remark-stringify gray-matter js-yaml toml`
- Command: `npm install jsdom`
- Command: `npm test`
- Command: `npm run check`

## Package Versions

- `@blocknote/core`: `0.51.1`
- `gray-matter`: `4.0.3`
- `js-yaml`: `4.1.1`
- `jsdom`: `29.1.1`
- `remark-gfm`: `4.0.1`
- `remark-parse`: `11.0.0`
- `remark-stringify`: `11.0.0`
- `toml`: `4.1.1`
- `unified`: `11.0.5`

## Execution Method

The script executed the official BlockNote APIs in Node with a JSDOM DOM shim:

- `editor.tryParseMarkdownToBlocks(markdown)`
- `editor.blocksToMarkdownLossy(blocks)`

The report treats BlockNote export as lossy, per official docs, and validates subset fixtures by comparing normalized Markdown AST before and after the BlockNote parse/export cycle.

## Results

- Subset pass rate: 84.6% (11/13)
- Raw trigger pass rate: 100.0% (12/12)
- Failure count: 2
- BlockNote threshold status: FAIL (>5% subset failure rate or any subset red)
- Milkdown fallback decision: TRIGGERED

## Exact Failures

- `07-blockquote-1762__subset.md`: expected `subset`, actual `raw`; BlockNote lossy markdown round-trip changed normalized AST; BlockNote export: "> A quoted paragraph should stay a quote after import and export.\\\\n> Cover BlockNote issue 1762.\\n"
- `13-html-attachment-image__subset.md`: expected `subset`, actual `raw`; BlockNote lossy markdown round-trip changed normalized AST; BlockNote export: "![photo](attachments/photo.jpg)\\n\\nAttachment HTML image is the only allowed raw HTML form.\\n"

## Fixture Coverage

- `01-headings__subset.md`: expected `subset`, actual `subset`, pass=true, features=heading-h1, heading-h2, heading-h3, heading-h4, heading-h5, heading-h6; BlockNote round-trip ok (6 blocks)
- `02-inline-formatting__subset.md`: expected `subset`, actual `subset`, pass=true, features=emphasis, hard-break, inline-code, paragraph, strikethrough, strong; BlockNote round-trip ok (1 blocks)
- `03-links__subset.md`: expected `subset`, actual `subset`, pass=true, features=link, paragraph; BlockNote round-trip ok (1 blocks)
- `04-unordered-list__subset.md`: expected `subset`, actual `subset`, pass=true, features=paragraph, unordered-list; BlockNote round-trip ok (3 blocks)
- `05-ordered-list__subset.md`: expected `subset`, actual `subset`, pass=true, features=ordered-list, paragraph; BlockNote round-trip ok (3 blocks)
- `06-task-list-826__subset.md`: expected `subset`, actual `subset`, pass=true, features=paragraph, task-list, unordered-list; BlockNote round-trip ok (3 blocks)
- `07-blockquote-1762__subset.md`: expected `subset`, actual `raw`, pass=false, features=blockquote, paragraph; BlockNote lossy markdown round-trip changed normalized AST; BlockNote export: "> A quoted paragraph should stay a quote after import and export.\\\\n> Cover BlockNote issue 1762.\\n"
- `08-code-fence-lang__subset.md`: expected `subset`, actual `subset`, pass=true, features=code-fence-lang; BlockNote round-trip ok (1 blocks)
- `09-gfm-table__subset.md`: expected `subset`, actual `subset`, pass=true, features=gfm-table; BlockNote round-trip ok (1 blocks)
- `10-attachment-image__subset.md`: expected `subset`, actual `subset`, pass=true, features=attachment-image, paragraph; BlockNote round-trip ok (2 blocks)
- `11-frontmatter-mixed__subset.md`: expected `subset`, actual `subset`, pass=true, features=heading-h1, paragraph; BlockNote round-trip ok (2 blocks)
- `12-mixed-subset__subset.md`: expected `subset`, actual `subset`, pass=true, features=blockquote, heading-h2, link, ordered-list, paragraph, task-list, unordered-list; BlockNote round-trip ok (6 blocks)
- `13-html-attachment-image__subset.md`: expected `subset`, actual `raw`, pass=false, features=attachment-image-html, paragraph; BlockNote lossy markdown round-trip changed normalized AST; BlockNote export: "![photo](attachments/photo.jpg)\\n\\nAttachment HTML image is the only allowed raw HTML form.\\n"
- `14-footnote__raw.md`: expected `raw`, actual `raw`, pass=true, features=paragraph; raw triggers: footnote; BlockNote round-trip ok (2 blocks)
- `15-inline-math__raw.md`: expected `raw`, actual `raw`, pass=true, features=paragraph; raw triggers: math inline/block; BlockNote round-trip ok (1 blocks)
- `16-block-math__raw.md`: expected `raw`, actual `raw`, pass=true, features=paragraph; raw triggers: math inline/block; BlockNote lossy markdown round-trip changed normalized AST; BlockNote export: "$$\\\\n E = mc^2\\\\n $$\\n"
- `17-callout-blockquote__raw.md`: expected `raw`, actual `raw`, pass=true, features=blockquote, paragraph; raw triggers: callout/admonition; BlockNote lossy markdown round-trip changed normalized AST; BlockNote export: "> [!NOTE]\\\\n> This Obsidian-style callout must stay raw.\\n"
- `18-admonition-directive__raw.md`: expected `raw`, actual `raw`, pass=true, features=paragraph; raw triggers: callout/admonition; BlockNote lossy markdown round-trip changed normalized AST; BlockNote export: ":::warning\\\\n Directive-style admonition must stay raw.\\\\n :::\\n"
- `19-definition-list__raw.md`: expected `raw`, actual `raw`, pass=true, features=paragraph; raw triggers: definition list; BlockNote lossy markdown round-trip changed normalized AST; BlockNote export: "Term\\\\n : Definition text that requires definition-list syntax.\\n"
- `20-mdx-import-jsx__raw.md`: expected `raw`, actual `raw`, pass=true, features=paragraph; raw triggers: MDX/import/JSX, unknown inline HTML except attachments img; BlockNote lossy markdown round-trip changed normalized AST; BlockNote export: "import Widget from \"./Widget\";\\n"
- `21-remote-image__raw.md`: expected `raw`, actual `raw`, pass=true, features=paragraph; raw triggers: non-attachments image/link scheme; BlockNote round-trip ok (1 blocks)
- `22-file-link-scheme__raw.md`: expected `raw`, actual `raw`, pass=true, features=link, paragraph; raw triggers: non-attachments image/link scheme; BlockNote lossy markdown round-trip changed normalized AST; BlockNote export: "Local file\\n"
- `23-unknown-html__raw.md`: expected `raw`, actual `raw`, pass=true, features=paragraph; raw triggers: unknown inline HTML except attachments img; BlockNote lossy markdown round-trip changed normalized AST; BlockNote export: "This has inline HTML that must stay raw.\\n"
- `24-extra-yaml-block__raw.md`: expected `raw`, actual `raw`, pass=true, features=heading-h2, paragraph; raw triggers: extra YAML/TOML blocks beyond frontmatter; BlockNote round-trip ok (3 blocks)
- `25-extra-toml-block__raw.md`: expected `raw`, actual `raw`, pass=true, features=paragraph; raw triggers: extra YAML/TOML blocks beyond frontmatter; BlockNote lossy markdown round-trip changed normalized AST; BlockNote export: "+++\\\\n title = \"TOML block\"\\\\n +++\\n\\nTOML frontmatter is not the supported semantic contract here.\\n"

## Round-trip Log

```text
PASS | 01-headings__subset.md | expected=subset | actual=subset | blocknoteExecuted=true | blocks=6
PASS | 02-inline-formatting__subset.md | expected=subset | actual=subset | blocknoteExecuted=true | blocks=1
PASS | 03-links__subset.md | expected=subset | actual=subset | blocknoteExecuted=true | blocks=1
PASS | 04-unordered-list__subset.md | expected=subset | actual=subset | blocknoteExecuted=true | blocks=3
PASS | 05-ordered-list__subset.md | expected=subset | actual=subset | blocknoteExecuted=true | blocks=3
PASS | 06-task-list-826__subset.md | expected=subset | actual=subset | blocknoteExecuted=true | blocks=3
FAIL | 07-blockquote-1762__subset.md | expected=subset | actual=raw | blocknoteExecuted=true | failure=BlockNote lossy markdown round-trip changed normalized AST
PASS | 08-code-fence-lang__subset.md | expected=subset | actual=subset | blocknoteExecuted=true | blocks=1
PASS | 09-gfm-table__subset.md | expected=subset | actual=subset | blocknoteExecuted=true | blocks=1
PASS | 10-attachment-image__subset.md | expected=subset | actual=subset | blocknoteExecuted=true | blocks=2
PASS | 11-frontmatter-mixed__subset.md | expected=subset | actual=subset | blocknoteExecuted=true | blocks=2
PASS | 12-mixed-subset__subset.md | expected=subset | actual=subset | blocknoteExecuted=true | blocks=6
FAIL | 13-html-attachment-image__subset.md | expected=subset | actual=raw | blocknoteExecuted=true | failure=BlockNote lossy markdown round-trip changed normalized AST
PASS | 14-footnote__raw.md | expected=raw | actual=raw | blocknoteExecuted=true | blocks=2
PASS | 15-inline-math__raw.md | expected=raw | actual=raw | blocknoteExecuted=true | blocks=1
PASS | 16-block-math__raw.md | expected=raw | actual=raw | blocknoteExecuted=true | failure=BlockNote lossy markdown round-trip changed normalized AST
PASS | 17-callout-blockquote__raw.md | expected=raw | actual=raw | blocknoteExecuted=true | failure=BlockNote lossy markdown round-trip changed normalized AST
PASS | 18-admonition-directive__raw.md | expected=raw | actual=raw | blocknoteExecuted=true | failure=BlockNote lossy markdown round-trip changed normalized AST
PASS | 19-definition-list__raw.md | expected=raw | actual=raw | blocknoteExecuted=true | failure=BlockNote lossy markdown round-trip changed normalized AST
PASS | 20-mdx-import-jsx__raw.md | expected=raw | actual=raw | blocknoteExecuted=true | failure=BlockNote lossy markdown round-trip changed normalized AST
PASS | 21-remote-image__raw.md | expected=raw | actual=raw | blocknoteExecuted=true | blocks=1
PASS | 22-file-link-scheme__raw.md | expected=raw | actual=raw | blocknoteExecuted=true | failure=BlockNote lossy markdown round-trip changed normalized AST
PASS | 23-unknown-html__raw.md | expected=raw | actual=raw | blocknoteExecuted=true | failure=BlockNote lossy markdown round-trip changed normalized AST
PASS | 24-extra-yaml-block__raw.md | expected=raw | actual=raw | blocknoteExecuted=true | blocks=3
PASS | 25-extra-toml-block__raw.md | expected=raw | actual=raw | blocknoteExecuted=true | failure=BlockNote lossy markdown round-trip changed normalized AST
```

## Known Issue Coverage

- BlockNote #1762 blockquote: covered by `07-blockquote-1762__subset.md`.
- BlockNote #826 checklist: covered by `06-task-list-826__subset.md`.

## Implementation Recommendation

Do not adopt BlockNote as the default markdown-truth editor for Reo Note Foundation without a second editor evaluation. Start the Milkdown fallback evaluation because at least one subset fixture failed the BlockNote round-trip gate.
