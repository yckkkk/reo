# Trigger Evals for `practical-ui`

## What these evals measure

Whether the skill's `description` + `when_to_use` fields **trigger correctly** — that is, whether Claude selects this skill for questions where it would help, and leaves it dormant for adjacent-domain questions where a different (or no) skill should handle the request.

This is **triggering accuracy**, not content quality. The book's content is authoritative by construction; what we test is whether the routing works.

## Files

- `trigger-evals.json` — 16 realistic user prompts
  - 8 `should_trigger: true` — concrete UI decisions the book covers
  - 8 `should_trigger: false` — near-miss prompts (Tailwind tooling, React state, SQL, testing, Figma integration) that would over-trigger a poorly written description
- Each entry carries a `notes` field explaining the mapping to chapter/section or why it's outside scope

## How to run the optimisation loop

The skill-creator's `run_loop.py` evaluates `description` + `when_to_use` against the eval set and iteratively refines the description if accuracy is low. From the project root:

```bash
python -m scripts.run_loop \
  --eval-set .claude/skills/practical-ui/evals/trigger-evals.json \
  --skill-path .claude/skills/practical-ui \
  --model claude-opus-4-7 \
  --max-iterations 5 \
  --verbose
```

(Script path assumes you have the `skill-creator` installed — see `~/.claude/skills/skill-creator/scripts/run_loop.py`.)

Each query is run 3× per iteration to dampen variance, then split 60/40 train/test. The loop picks the best description by **test score**, not train score, to avoid overfitting.

## Cross-model test plan

Anthropic's authoring best practices: *"Skills act as additions to models, so effectiveness depends on the underlying model. Test your Skill with all the models you plan to use it with."*

Run the loop for each tier separately and compare:

| Model | Why test this one |
|---|---|
| `claude-haiku-4-5` | Worst case for discovery — the cheap model has less implicit theory-of-mind about design topics, so it relies most heavily on the description's explicit keywords. If Haiku triggers correctly, Sonnet/Opus will too. |
| `claude-sonnet-4-6` | Primary working model — most real-world invocations happen here. |
| `claude-opus-4-7` | Used for harder UX decisions; should not over-trigger on adjacent-domain questions that Opus could otherwise reason through without the book. |

**Pass bar:** ≥ 85% accuracy on both train and test for each tier. If Haiku lags significantly behind Sonnet, the `description` needs more explicit trigger keywords; if Opus over-triggers, `when_to_use` needs stronger "do not invoke for …" phrasing.

Aggregate results go in `results-<model>-<date>.json` (gitignored) so successive runs can be diffed.

## Evolving the eval set

The eval set is a **living document** — the highest-signal improvements come from real mis-triggers observed in normal Claude Code use.

Workflow:

1. Notice a mis-trigger (or missed trigger) in a real conversation.
2. Add the user's actual phrasing (verbatim, with typos and casual speech preserved) to `trigger-evals.json` with the correct `should_trigger` flag and a `notes` line explaining the boundary.
3. Re-run the optimisation loop.
4. If the loop's best new description differs from the current one, apply the change and commit with a message of the form `chore(skills): practical-ui description v<N> — fix over-trigger on <topic>`.

## Why 16 queries, split 8/8?

Anthropic recommends 20-ish realistic queries for trigger evals. I've gone slightly under because the book's scope is tightly bounded and additional queries would just be paraphrases of existing ones. **Add more when real conversations surface new boundaries** — the set should grow, not be static.

## Anti-patterns to avoid when adding queries

- **Too easy negatives** ("write a fibonacci function" — has no UI vocabulary at all). These don't test the description.
- **Pure synonyms** ("a button colour question" vs "which colour for my button") — adds little signal.
- **Overly formal phrasing** that no real user would type. Keep typos, code-switching (Chinese + English), abbreviations, and stream-of-consciousness intact.

## References

- [Skill authoring best practices — Anthropic](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices)
- [Claude Code skills docs](https://code.claude.com/docs/en/skills)
- [skill-creator source](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md)
