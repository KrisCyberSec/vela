# Workflow

How work moves through the project. Minimal by design — three docs, four
queue states, one prompt template directory. If you're a Claude session
starting up, read `docs/HANDOFF.md` first for project orientation, then
this for "what should I be doing right now."

## The four states

Every piece of work lives in exactly one of four places:

| State | Where it lives | What it means |
|---|---|---|
| **Parking lot** | `docs/operations/parking-lot.md` | Idea or follow-up captured so we don't lose it. Not committed to. Triaged weekly. |
| **Now** | `docs/operations/now.md` | Active focus. What you (Kris) or a Claude session is working on this week. Has a clear "done means" line. |
| **Waiting on a human** | `docs/operations/manual-tasks.md` | Built. Waiting on a dashboard click, account creation, secret paste, Apple UI — something Claude can't push through. |
| **Shipped** | git log + `docs/HANDOFF.md` recent-commits section | Done. Reflected in the codebase. |

That's the entire model. Nothing is "in review" or "blocked" or "on
deck" — those are just sub-flavors of one of the four above. If a thing
doesn't fit in one of these buckets, it's probably noise and shouldn't
exist in this system.

## Flow

```
new idea → parking-lot.md
              ↓ (triage decides this matters)
            now.md
              ↓ (Claude builds it)
       manual-tasks.md (if a human gate exists)
              ↓ (Kris does the dashboard step)
       shipped (commit + remove from now.md)
```

Most things skip `manual-tasks.md` and go directly from `now.md` to
shipped. Most things skip `parking-lot.md` when they're urgent.

## Conventions

### Adding to the parking lot
Free-form. One line per item. If you notice something while doing
something else, drop it here. Format:

```
- [yyyy-mm-dd] One-sentence description. Optional: file:line if relevant.
```

The point is to not lose the thought. Triage promotes it later — or
deletes it if it's stale.

### Adding to `now.md`
Each item gets:
- A name
- A "done means" criterion (1-2 lines, observable)
- Optional: which surface (Claude session, Kris dashboard, etc.)

Keep it short. If `now.md` has more than ~5 items, you're not focused.
Move things back to `parking-lot.md`.

### Adding to `manual-tasks.md`
**Claude must add to this list in the same commit** that builds anything
requiring a manual gate. The list is the contract between Claude's
work and Kris's dashboard work. See the existing entries for format —
each item has a checklist of what to click, what to paste, what to
verify.

### Spawning a Cowork session
Templates live in `docs/operations/cowork-prompts/`. The convention:
one file per category of work. When you want to spawn a session, you
either:
- copy an existing template, fill in specifics, send to Cowork; OR
- write a new self-contained prompt and add it to the directory for
  next time.

A good Cowork prompt:
- Briefs context (the new session has no memory of your conversation)
- Names exact files and line numbers
- Defines deliverables precisely
- Has a "definition of done" with verification steps
- Mentions the commit message format

Bad Cowork prompts are short, ambiguous, or assume context. They produce
shallow, generic work.

## Daily / weekly cadence

**Daily** (before starting work): glance at `now.md`. Anything left over
from yesterday? Anything in `manual-tasks.md` you can knock out in
under 5 minutes? Triage `parking-lot.md` if it's getting noisy.

**Weekly** (Friday or whenever): empty `now.md` of things that shipped.
Promote anything from `parking-lot.md` that matters into `now.md`.
Delete `parking-lot.md` items that no longer matter — most don't.

## Anti-patterns

- **Long-running things in `now.md`.** If it's been there 3+ weeks, it's
  not "now." Either ship it or move it back to the parking lot.
- **Parking-lot items with no date.** Without a date you can't tell what's
  stale. Always lead with `[yyyy-mm-dd]`.
- **Manual tasks without a verification step.** Every entry should have
  "to verify it worked: do X, expect Y."
- **Cowork prompts that say "based on our conversation."** The new
  session has no conversation. Be self-contained or it fails silently.
- **Multiple sessions editing the same file.** If you're spawning
  parallel Cowork sessions, give each one a disjoint set of files. See
  the Phase 2 screen-extraction commit for an example — four agents
  each wrote to a different `src/screens/X.jsx`, integration was a
  single Python pass at the end.

## Where this scales (and where it doesn't)

This works fine for a solo founder with parallel Claude sessions. It
stops working when:

- A co-founder joins (need shared visibility — promote to GitHub
  Projects or Linear)
- Outside contributors file bugs (need real ticketing — same)
- Customers report issues (need a support inbox + triage workflow)

None of those are true for Vela today. When any of them become true,
this doc becomes a relic and a real tracker takes over. Until then,
markdown in the repo, grep-able, free.
