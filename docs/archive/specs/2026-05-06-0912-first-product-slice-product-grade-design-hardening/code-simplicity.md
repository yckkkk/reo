# Code Simplicity

## Hard boundaries

- No generic runtime.
- No generic service layer.
- No generic IPC bridge.
- No unimplemented capabilities in current UI.
- No hidden DB content truth.
- No speculative folder or table.
- No decorative component library.

## Simplicity decisions

| Area          | Allowed                                                               | Not allowed                                      |
| ------------- | --------------------------------------------------------------------- | ------------------------------------------------ |
| UI primitives | source-owned shadcn/ElevenLabs components with real consumer          | wrapper around every primitive “for consistency” |
| Drawer        | one Reo drawer shell if it captures shared focus/size/token invariant | custom modal mechanics                           |
| Recording     | feature reducer + media adapter + explicit IPC                        | generic event bus                                |
| Data          | query key factory per domain                                          | global cache abstraction                         |
| Files         | transaction helper for atomic workspace writes                        | generic filesystem transaction framework         |
| DB            | Drizzle schema by entity/relationship                                 | generic metadata JSON bucket                     |
| Errors        | boundary-specific envelopes                                           | universal error taxonomy with no consumer        |
| Logging       | diagnostics slice with redaction                                      | console/log bridge everywhere                    |

## Refactor triggers

Refactor only when:

- A file exceeds readable feature responsibility and tests cover split behavior.
- A class combination repeats with shared invariant in at least two real consumers.
- A state transition table becomes hard to audit.
- A source-owned component needs repeated retokenize patches across features.

Do not refactor just because a future feature might need it.
