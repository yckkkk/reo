---
name: practical-ui
description: Design guidelines from Adham Dannaway's *Practical UI* (2nd ed.) — a 373-page reference covering UI fundamentals, minimalism, colour (WCAG 2 + APCA accessibility), layout & spacing (12-col grid, spacing scale, box model), typography (type scale, line-height, line-length), UI copywriting (labels, errors, sentence case), buttons (primary/secondary/tertiary weights, target size, destructive confirmations), and forms (single-column layout, required/optional marks, validation strategies). Applies to any concrete UI decision — button colour, spacing, font size, contrast ratio, radio vs dropdown, label placement, placeholder usage, error wording, modal vs inline, dark vs light palette, primary vs secondary action, icon+text alignment, empty-state structure. Also triggers on critique-style prompts ("does this look right", "feels off", "too cluttered", "看起来对吗") and on component design/review tasks in shadcn/Radix/Tailwind codebases, even when the user doesn't say "design system".
when_to_use: Trigger on any phrase describing a visual or interactive UI tradeoff — component weights, spacing rhythm, colour harmony, typography hierarchy, accessibility contrast, microcopy decisions, form UX flow. Also trigger when the user is about to make or critique a UI component even without domain keywords. Do NOT trigger for Tailwind/Figma tooling bugs, state-management choices (react-query vs swr), testing strategy, database/API design, or pure performance work — those are outside this book's scope.
---

# Practical UI — Design Guidelines Reference

This skill wraps Adham Dannaway's *Practical UI (2nd edition, 2024)* — a concise, evidence-based guide covering the 20% of UI knowledge that produces 80% of good outcomes. The book is split into 10 chapter bundles under `chapters/`. Each bundle contains:

- `chapter.md` — full parsed text with inline `![alt](images/...)` references, opened by an auto-generated `## Contents` block (for long chapters) so a `head -N` preview shows every guideline at a glance
- `images/` — every visual example extracted from the source PDF
- `chapter.pdf` — the original pages, optimized for visual fidelity (use when the markdown can't capture what you need — subtle colour comparisons, multi-column dos/don'ts layouts, rendered type hierarchy)

## How to use this skill

1. **Identify the relevant chapter(s)** using the routing table and sub-section index below. Don't load the whole book — average chapter is only 400–1000 lines of markdown. Loading the wrong chapter is cheaper than loading everything.
2. **Read the chapter's `chapter.md` first.** Each long chapter opens with a `## Contents` block — a `head -80 chapter.md` already shows every guideline name. Markdown is ~5% the size of the PDF and carries ~90% of the content; all images are referenced inline.
3. **Open `chapter.pdf` (with a page range) only when you need the rendered visual** — e.g., comparing dark vs light palettes side-by-side, validating spacing rhythm, judging type hierarchy as rendered. Markdown flattens multi-column visual comparisons.
4. **Read adjacent sub-sections, not the full chapter.** Each `## Heading` in `chapter.md` is one guideline; sub-sections are self-contained. When solving a specific question ("what line-height for 14px body?"), jump to the heading that matches — grep by heading text.
5. **Cite the guideline source when you apply it** — e.g., "*Practical UI* Ch.3 'Ensure sufficient contrast' recommends APCA ≥ 75 for 18px body". This helps the user verify your recommendation and learn the reasoning, not just the rule.

## Core philosophy (the book's stance)

These guidelines are weighted toward **defaults that rarely fail**, not maximum artistic flexibility. The author explicitly rejects "gut feeling" design and favours:

- **Fewer choices, made well** — 1 sans-serif, 1 brand colour, ~5 colour variations, 2 font weights (regular + bold).
- **Accessibility as a floor, not a ceiling** — WCAG 2.1 AA is the minimum; APCA is the preferred (emerging) standard for contrast.
- **Function before decoration** — remove styles that don't disambiguate; use colour only to signal meaning; don't underline every link.
- **Explicit over implicit** — mark both required and optional fields; describe button actions; front-load text.

When a user's preference contradicts the book (rainbow palette, uppercase body, playful brand), present the book's reasoning but respect their intent. The book is a **default to deviate from consciously**, not a rulebook to enforce.

When the book's guidance conflicts with the current repo's UI/design-system truth, do **not** automatically choose either side. Surface the tension, interview the user, and help decide whether the repo truth should be upgraded, the book's rule is not applicable here, or the task needs a bounded carve-out.

## Routing table — topic → chapter

| User asks about… | Read chapter |
|---|---|
| first principles, usability risks, interaction cost, decision frameworks, design-system foundations, accessibility overview | `01-fundamentals` |
| removing clutter, progressive disclosure, minimalism vs simplicity, mobile-first | `02-less-is-more` |
| contrast (WCAG/APCA), brand colour, palettes, dark mode, shadows, colour naming, photo colour matching | `03-colour` |
| grouping, visual hierarchy, 12-column grid, box model, spacing scale, whitespace, alignment, rule of thirds | `04-layout-spacing` |
| font choice, type scale, font weights, line-height, line-length, letter-spacing, text-on-photo | `05-typography` |
| UI copy, tone, sentence case, abbreviations, error messages, labels, text length parity | `06-copywriting` |
| button weights (primary/secondary/tertiary), disabled buttons, target size, destructive confirmations, icon+text buttons | `07-buttons` |
| form layout, required/optional marks, placeholders vs labels, radios vs dropdowns, toggles, validation | `08-forms` |
| book overview, author POV, scope, how guidelines were validated | `00-introduction` |
| closing thoughts, further reading | `09-conclusion` |

## Sub-section index (routing inside a chapter)

Use this to jump inside a chapter without reading all of it. Headings in `chapter.md` match these entries verbatim — grep or string-search by the heading text.

### 01-fundamentals (Ch.1)
- Minimise usability risks
- Have a logical reason for every design detail
- Minimise interaction cost (keep related actions close / reduce distractions / minimise choice)
- Minimise cognitive load
- Create a design system (colour, typography, spacing options; reusable modules; usage guidelines)
- Ensure an interface is accessible (assistive tech, screen readers, screen magnifiers)
- Use common design patterns
- Use the 80/20 Rule to prioritise
- Keep costs in mind
- Be consistent (within your product & with other products)
- Clearly indicate interaction states

### 02-less-is-more (Ch.2)
- Remove unnecessary information
- Remove unnecessary styles
- Not all links need to be underlined
- Use progressive disclosure
- Don't confuse minimalism with simplicity
- Make sure important content is visible
- Design for the smallest screen first
- Reduce choice to speed up decision making

### 03-colour (Ch.3) — **longest chapter, rich in palettes**
- Ensure sufficient contrast (WCAG 2 ratios)
- An improved way to measure contrast (APCA)
- Don't rely on colour alone to convey meaning
- Use system colours to indicate status
- Use colour to define a clear visual hierarchy
- Use black and white for a timeless aesthetic
- Add a tinge of colour to black and white
- Use 1 brand colour
- Apply the brand colour to interactive elements
- Create a colour palette with rules that govern its usage
- Use the HSB colour system
- 5 colour variations is often all you need
- Create a dark colour palette
- Add depth using colour and shadows
- Consider using transparent colours
- Create a transparent colour palette
- Use transparent layers for interaction states
- Name colours to keep them organised
- Adjust photo colour temperature to match the palette

### 04-layout-spacing (Ch.4)
- Group related elements
- Create a clear visual hierarchy
- Test visual hierarchy using The Squint Test
- Use depth to create visual hierarchy
- Understand the box model
- Design @1x using points
- Create a set of predefined spacing options
- Space elements based on how closely related they are
- Be generous with white space
- Align the main layout to a 12 column grid
- Align text to improve readability
- Try to avoid using multiple alignments
- Keep related actions close
- Ensure your interface is unbreakable
- Use the Rule of Thirds for photos

### 05-typography (Ch.5)
- Use a single sans serif typeface
- Evoke emotion using a second typeface for headings
- Use regular and bold font weights only
- Use a type scale to set font sizes
- Make long body text bigger
- Use at least 1.5 line height for long body text
- Decrease line height as font size increases
- Ensure ideal line length
- Left align text
- Decrease letter spacing for large text
- Ensure text on photos is legible
- Avoid light grey and pure black text

### 06-copywriting (Ch.6)
- Be concise
- Use sentence case
- Use plain and simple language
- Front-load text
- Use the inverted pyramid
- Limit the use of abbreviations and acronyms
- Limit the use of UPPERCASE
- Break up content using descriptive headings and bullets
- Avoid using "my" on form labels
- Use vocabulary consistently
- Use numerals for numbers
- Avoid full stops if possible
- Ensure text length is similar across similar interface elements
- Ensure text links describe their destination
- Write clear error messages

### 07-buttons (Ch.7)
- Define 3 button weights (primary/secondary/tertiary)
- Use a single primary button for the most important action
- Use secondary buttons for less important actions
- Use tertiary buttons for the least important actions
- Try to avoid disabled buttons
- Left align buttons
- Ensure button text describes the action
- Ensure buttons have a sufficient target size
- Balance icon and text pairs
- Add friction to destructive actions

### 08-forms (Ch.8)
- Stack forms in a single column layout
- Minimise the number of form fields
- Mark optional fields / Mark both required and optional fields
- Try to avoid optional fields by using opt-ins
- Match field width to the intended input
- Stick with conventional form field styles
- Display hints above form fields
- Don't use placeholder text instead of a label
- Ensure form field labels are close to their fields
- Try to use radio buttons instead of dropdowns
- Use an autocomplete instead of a long dropdown
- Use steppers for numeric fields instead of dropdowns
- Use a checkbox or toggle switch for 2 options
- Use positive phrasing for checkboxes
- Break up long forms into multiple steps
- Group related fields under headings
- Ensure form field borders are high contrast
- Choose your form validation approach

## Gotchas

Add new gotchas here as real-world usage surfaces them — this is the highest-signal part of the skill over time.

- **The book is prescriptive, not absolutist.** When the user's product, brand, or context has a legitimate reason to deviate (playful consumer app with rainbow palettes, regulatory labels that genuinely need ALL CAPS, micro-interactions that intentionally break the "no disabled buttons" rule), cite the book's *reasoning* and respect the deviation. Don't pitch a guideline as law.
- **Image filenames are GUIDs** (ZhiPu's extractor names them by internal position like `019d...jpg`). Captions flow under each image — the caption, not the filename, is the reliable identifier.
- **Multi-column visuals linearize in markdown.** The "dos vs don'ts" grids or "5 colour variations" palette rows lose their spatial relationship after parsing. If an arrangement reads oddly, open `chapter.pdf` at the approximate page.
- **Ch.1 is the only meta chapter.** Every other chapter gives object-level rules (about buttons, about colour). Don't look for cross-cutting architectural advice outside Ch.1 — for that, point to MemoryOS's own `docs/design-system/*` tree.
- **British spelling ("colour", "minimise").** Mirror the user's spelling; don't auto-correct either way. Headings in the source text use British forms.
- **APCA is WCAG 3 draft, not a shipped standard.** When recommending APCA thresholds, note that WCAG 2 AA remains the legal baseline in most jurisdictions (EU, US federal, many corporate procurement checks).
- **Some diagrams are process references, not reproducible visuals** — e.g., the book's Figma-specific workflows. Don't quote them as implementation guidance in a non-Figma codebase.
- **Do not auto-resolve repo-truth conflicts.** If the book and the current project design-system disagree, treat that as a design review moment. Surface the conflict, ask whether the project truth is outdated, and only then recommend updating or preserving the local rule.

## Evals and iteration

This skill ships with `evals/trigger-evals.json` — 16 realistic user prompts split into should-trigger (8) and should-not-trigger (8) groups, covering the near-miss boundary (Tailwind config, state management, testing, backend) where a too-eager description would over-trigger.

See `evals/README.md` for how to run the description-optimisation loop and for the cross-model test plan (Haiku / Sonnet / Opus).

Re-run the evals any time:
- the `description` or `when_to_use` frontmatter is edited,
- a new mis-trigger is observed in real use (add it to the eval set as a negative case, then iterate),
- a new missed trigger is observed (add it as a positive case).

## How this skill was built

Source: a 373-page, 174MB PDF. Pipeline:

1. Split the PDF into 10 chapter-level PDFs with `pdfseparate` + `pdfunite`.
2. Optimise each with Ghostscript (`/printer` preset — near-lossless, strips redundant font embeds). Final per-chapter PDF sizes: 0.8MB (conclusion) – 40MB (colour).
3. Send each chapter to ZhiPu's `expert` async file parser → receive a zip of `result.md` + extracted images (360 in total).
4. Unpack into `chapters/<n>-<slug>/`.
5. Run `scripts/add_toc.py` to inject a `## Contents` block at the top of each long chapter so `head -N` previews show the full guideline inventory.

Build scripts live under `scripts/` for reproducibility. Re-running from the source PDF needs `ZHIPU_API_KEY` in the environment.
