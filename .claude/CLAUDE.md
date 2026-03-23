# Jeopardy Coach

## What This Is
A Jeopardy training game for Mike, who is in the contestant pool for 18 months (starting March 2026). Goal: win if selected. Previous attempt at a basic quiz website wasn't engaging enough.

**Core design principle: FUN FIRST.** This is a game, not a study tool.

## Tech Stack
- **Frontend**: Vanilla JS (in `public/`), planned migration to React PWA
- **Backend**: Node.js + Express (`server.js`)
- **Database**: SQLite via better-sqlite3 (`clues.db`)
- **Hosting**: Railway (auto-deploy from GitHub main)
- **Node version**: 18.x (pinned in package.json)

## Key Files
- `server.js` -- Express API server
- `public/` -- frontend assets
- `scripts/import-clues.js` -- clue dataset importer
- `data/` -- source data files

## Dataset
- Source: jwolle1/jeopardy_clue_dataset (538,845 clues, Seasons 1-41)
- TSV format: round, value, category, answer, question, air date
- Needs: category normalization, staleness filtering, difficulty calibration

## Design Decisions (confirmed by Mike)
- "Coach decides" model -- no menus, app tells you what to do today
- Spaced repetition hidden inside gameplay mechanics
- Interleaved practice as default (research-backed)
- 10-15 minute daily sessions
- Cumulative progress over streaks (streaks create anxiety)
- Three training phases: Diagnostic -> Category Building -> Speed/Competition

## Game Modes
1. **Daily Five** -- shared daily challenge, Wordle-style emoji sharing
2. **The Run** -- roguelike-inspired (combos, risk/reward, power-ups, map exploration, boss fights)
3. **Category Blitz** -- targeted weakness training
4. **Head-to-Head** -- async challenges to friends

## Progression
- Category Mastery Map (~50 core categories, visual grid)
- Contestant Rating (Elo-like)
- Cumulative stats (no punitive streaks)

## Key Weaknesses to Address
- Opera, Shakespeare, Bible, and other recurring Jeopardy categories

## Scope Boundaries
This is a project agent. You are NOT Eugene Belford (The Plague), the parent agent.
- **READ**: `~/Webdev/.claude/rules/*`, shared memory (`~/Webdev/.claude/memory/*`), other projects' CLAUDE.md
- **WRITE**: this project's files, this project's `.claude/CLAUDE.md`
- **PROPOSE ONLY**: `/Users/ml/Webdev/.claude/memory/feedback/proposed/` (see format in `~/Webdev/.claude/rules/agent-governance.md`)
- **NEVER MODIFY**: `~/Webdev/.claude/rules/*`, `~/Webdev/.claude/CLAUDE.md`, `/Users/ml/Webdev/.claude/memory/principles.md`, `/Users/ml/Webdev/.claude/memory/MEMORY.md`, `/Users/ml/Webdev/.claude/memory/feedback/*.md` (only `proposed/`)

When you encounter a correction, lesson, or principle worth capturing globally, write a proposal to `/Users/ml/Webdev/.claude/memory/feedback/proposed/jeopardy-coach_<date>_<desc>.md`. Eugene Belford will review and integrate.

## Shared Memory (read-only)
- Daily intentions: `/Users/ml/Webdev/.claude/memory/daily-intentions.md`
- Principles: `/Users/ml/Webdev/.claude/memory/principles.md`
- Feedback log: `/Users/ml/Webdev/.claude/memory/feedback/`
- Full project history: `/Users/ml/Webdev/.claude/memory/jeopardy-coach.md`

## Related Projects
| Project | Path | Relationship |
|---|---|---|
| intention-caller | `/Users/ml/Webdev/intention-caller` | Mike's daily intention system -- training discipline connects to declared commitments |
