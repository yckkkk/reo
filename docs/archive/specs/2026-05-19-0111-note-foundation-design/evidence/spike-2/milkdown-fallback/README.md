# Milkdown Fallback Round-trip Report

## Verdict

Status: `DONE_WITH_CONCERNS`

Milkdown should not replace BlockNote as the default editor under the current
markdown-truth criteria. It fixes BlockNote's red cases for blockquote and HTML
attachment image fixtures, but it introduces red cases for list serialization.
Sub-spec (a) can proceed because it only changes the multi-kind data contract;
sub-spec (b) needs a deeper editor decision before implementation.

## What Ran

- Sandbox: `.tmp/note-foundation-spikes/spike-2b-milkdown-fallback/`
- Fixtures: 25
- Command: `npm install @milkdown/kit @milkdown/react @milkdown/crepe unified remark-parse remark-gfm remark-stringify gray-matter jsdom`
- Command: `npm install @milkdown/preset-gfm remark-stringify`
- Command: `npm test`

## Package Versions

- `@milkdown/crepe`: `7.21.1`
- `@milkdown/kit`: `7.21.1`
- `@milkdown/preset-gfm`: `7.21.1`
- `@milkdown/react`: `7.21.1`
- `gray-matter`: `4.0.3`
- `jsdom`: `29.1.1`
- `remark-gfm`: `4.0.1`
- `remark-parse`: `11.0.0`
- `remark-stringify`: `11.0.0`
- `unified`: `11.0.5`

## Execution Method

The script executed Milkdown in Node with a JSDOM DOM shim:

- `Editor.make()`
- `rootCtx` and `defaultValueCtx`
- `commonmark`, `gfm`, `history`, and `listener`
- Markdown readback through `serializerCtx(editorViewCtx.state.doc)`

Subset fixtures pass only when the normalized Markdown AST is unchanged after parse and serialize. Raw fixtures pass when the subset gate routes them to raw mode before editor conversion.

## Results

- Subset pass rate: 84.6% (11/13)
- Raw trigger pass rate: 100.0% (12/12)
- Failure count: 2
- Recommendation key: `pause-for-deeper-editor-spec`

## Exact Failures

- `04-unordered-list__subset.md`: Milkdown markdown round-trip changed normalized AST; Milkdown export: "_ Capture source material\n\n_ Review useful fragments\n\n _ Keep only the signal\n\n_ Draft the work\n"
- `06-task-list-826__subset.md`: Milkdown markdown round-trip changed normalized AST; Milkdown export: "_ [x] Preserve checked item state\n\n_ [ ] Preserve unchecked item state\n\n\* [x] Cover BlockNote issue 826\n"

## Fixture Coverage

- `01-headings__subset.md`: expected `subset`, actual `subset`, pass=true, features=heading-h1, heading-h2, heading-h3, heading-h4, heading-h5, heading-h6; Milkdown round-trip ok
- `02-inline-formatting__subset.md`: expected `subset`, actual `subset`, pass=true, features=emphasis, hard-break, inline-code, paragraph, strikethrough, strong; Milkdown round-trip ok
- `03-links__subset.md`: expected `subset`, actual `subset`, pass=true, features=link, paragraph; Milkdown round-trip ok
- `04-unordered-list__subset.md`: expected `subset`, actual `raw`, pass=false, features=paragraph, unordered-list; Milkdown markdown round-trip changed normalized AST; Milkdown export: "_ Capture source material\n\n_ Review useful fragments\n\n _ Keep only the signal\n\n_ Draft the work\n"
- `05-ordered-list__subset.md`: expected `subset`, actual `subset`, pass=true, features=ordered-list, paragraph; Milkdown round-trip ok
- `06-task-list-826__subset.md`: expected `subset`, actual `raw`, pass=false, features=paragraph, task-list, unordered-list; Milkdown markdown round-trip changed normalized AST; Milkdown export: "_ [x] Preserve checked item state\n\n_ [ ] Preserve unchecked item state\n\n\* [x] Cover BlockNote issue 826\n"
- `07-blockquote-1762__subset.md`: expected `subset`, actual `subset`, pass=true, features=blockquote, paragraph; Milkdown round-trip ok
- `08-code-fence-lang__subset.md`: expected `subset`, actual `subset`, pass=true, features=code-fence-lang; Milkdown round-trip ok
- `09-gfm-table__subset.md`: expected `subset`, actual `subset`, pass=true, features=gfm-table; Milkdown round-trip ok
- `10-attachment-image__subset.md`: expected `subset`, actual `subset`, pass=true, features=attachment-image, paragraph; Milkdown round-trip ok
- `11-frontmatter-mixed__subset.md`: expected `subset`, actual `subset`, pass=true, features=heading-h1, paragraph; Milkdown round-trip ok
- `12-mixed-subset__subset.md`: expected `subset`, actual `subset`, pass=true, features=blockquote, heading-h2, link, ordered-list, paragraph, task-list, unordered-list; Milkdown round-trip ok
- `13-html-attachment-image__subset.md`: expected `subset`, actual `subset`, pass=true, features=attachment-image-html, paragraph; Milkdown round-trip ok
- `14-footnote__raw.md`: expected `raw`, actual `raw`, pass=true, features=paragraph; raw triggers: footnote; Milkdown round-trip ok
- `15-inline-math__raw.md`: expected `raw`, actual `raw`, pass=true, features=paragraph; raw triggers: math inline/block; Milkdown round-trip ok
- `16-block-math__raw.md`: expected `raw`, actual `raw`, pass=true, features=paragraph; raw triggers: math inline/block; Milkdown round-trip ok
- `17-callout-blockquote__raw.md`: expected `raw`, actual `raw`, pass=true, features=blockquote, paragraph; raw triggers: callout/admonition; Milkdown round-trip ok
- `18-admonition-directive__raw.md`: expected `raw`, actual `raw`, pass=true, features=paragraph; raw triggers: callout/admonition; Milkdown round-trip ok
- `19-definition-list__raw.md`: expected `raw`, actual `raw`, pass=true, features=paragraph; raw triggers: definition list; Milkdown round-trip ok
- `20-mdx-import-jsx__raw.md`: expected `raw`, actual `raw`, pass=true, features=paragraph; raw triggers: MDX/import/JSX, unknown inline HTML except attachments img; Milkdown round-trip ok
- `21-remote-image__raw.md`: expected `raw`, actual `raw`, pass=true, features=paragraph; raw triggers: non-attachments image/link scheme; Milkdown round-trip ok
- `22-file-link-scheme__raw.md`: expected `raw`, actual `raw`, pass=true, features=link, paragraph; raw triggers: non-attachments image/link scheme; Milkdown round-trip ok
- `23-unknown-html__raw.md`: expected `raw`, actual `raw`, pass=true, features=paragraph; raw triggers: unknown inline HTML except attachments img; Milkdown round-trip ok
- `24-extra-yaml-block__raw.md`: expected `raw`, actual `raw`, pass=true, features=heading-h2, paragraph; raw triggers: extra YAML/TOML blocks beyond frontmatter; Milkdown round-trip ok
- `25-extra-toml-block__raw.md`: expected `raw`, actual `raw`, pass=true, features=paragraph; raw triggers: extra YAML/TOML blocks beyond frontmatter; Milkdown round-trip ok

## Round-trip Log

```text
PASS | 01-headings__subset.md | expected=subset | actual=subset | milkdownExecuted=true | roundtrip=ok
PASS | 02-inline-formatting__subset.md | expected=subset | actual=subset | milkdownExecuted=true | roundtrip=ok
PASS | 03-links__subset.md | expected=subset | actual=subset | milkdownExecuted=true | roundtrip=ok
FAIL | 04-unordered-list__subset.md | expected=subset | actual=raw | milkdownExecuted=true | failure=Milkdown markdown round-trip changed normalized AST
PASS | 05-ordered-list__subset.md | expected=subset | actual=subset | milkdownExecuted=true | roundtrip=ok
FAIL | 06-task-list-826__subset.md | expected=subset | actual=raw | milkdownExecuted=true | failure=Milkdown markdown round-trip changed normalized AST
PASS | 07-blockquote-1762__subset.md | expected=subset | actual=subset | milkdownExecuted=true | roundtrip=ok
PASS | 08-code-fence-lang__subset.md | expected=subset | actual=subset | milkdownExecuted=true | roundtrip=ok
PASS | 09-gfm-table__subset.md | expected=subset | actual=subset | milkdownExecuted=true | roundtrip=ok
PASS | 10-attachment-image__subset.md | expected=subset | actual=subset | milkdownExecuted=true | roundtrip=ok
PASS | 11-frontmatter-mixed__subset.md | expected=subset | actual=subset | milkdownExecuted=true | roundtrip=ok
PASS | 12-mixed-subset__subset.md | expected=subset | actual=subset | milkdownExecuted=true | roundtrip=ok
PASS | 13-html-attachment-image__subset.md | expected=subset | actual=subset | milkdownExecuted=true | roundtrip=ok
PASS | 14-footnote__raw.md | expected=raw | actual=raw | milkdownExecuted=true | roundtrip=ok
PASS | 15-inline-math__raw.md | expected=raw | actual=raw | milkdownExecuted=true | roundtrip=ok
PASS | 16-block-math__raw.md | expected=raw | actual=raw | milkdownExecuted=true | roundtrip=ok
PASS | 17-callout-blockquote__raw.md | expected=raw | actual=raw | milkdownExecuted=true | roundtrip=ok
PASS | 18-admonition-directive__raw.md | expected=raw | actual=raw | milkdownExecuted=true | roundtrip=ok
PASS | 19-definition-list__raw.md | expected=raw | actual=raw | milkdownExecuted=true | roundtrip=ok
PASS | 20-mdx-import-jsx__raw.md | expected=raw | actual=raw | milkdownExecuted=true | roundtrip=ok
PASS | 21-remote-image__raw.md | expected=raw | actual=raw | milkdownExecuted=true | roundtrip=ok
PASS | 22-file-link-scheme__raw.md | expected=raw | actual=raw | milkdownExecuted=true | roundtrip=ok
PASS | 23-unknown-html__raw.md | expected=raw | actual=raw | milkdownExecuted=true | roundtrip=ok
PASS | 24-extra-yaml-block__raw.md | expected=raw | actual=raw | milkdownExecuted=true | roundtrip=ok
PASS | 25-extra-toml-block__raw.md | expected=raw | actual=raw | milkdownExecuted=true | roundtrip=ok
```
