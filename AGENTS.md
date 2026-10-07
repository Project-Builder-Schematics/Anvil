<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

## How to work

- **Problem first.** State the problem and the scope before changing code. If either is unclear, ask one focused question.
- **Push back** when a request contradicts itself, is unsound, creates debt, or skips a quality step without a reason.
- **Less code.** Name the behaviour a function adds before writing it. No pass-through wrappers or aliases.
- **Match what exists.** Follow the patterns already in the repo; never build a parallel one.
- **Solve today's problem.** No options or extension points nobody asked for. Generalise on the second concrete case.
- **Pure where it fits.** Logic is pure; IO and framework hooks stay at the edges. In the API, Nest appears only in `infrastructure/` and `composition.ts` wires everything.
- **Clean your touch zone, nothing more.**
- **Verify before claiming.** Check the docs or the code for every version-specific API; run the check before saying it passes.
- **External ground truth.** A claim about a system we don't own is proven by its docs or a real call, not by a fixture we wrote.
- **Bugs.** Reproduce and find the root cause before fixing.
- **No theatre.** No padding or invented caveats. An empty section says "None".
- **Know when to stop.** After 2 or 3 failed attempts at the same fix, stop and report.
- **Re-read the diff** before each commit and before opening a PR. Remove indirection, duplication and derivable state.

### One worktree per change

- Create a sibling worktree `../demo-<branch>` on its own branch from a fresh base, never under `/tmp`. The main checkout stays on `main` and clean.
- Each worktree runs its own `bun install`; never symlink `node_modules`.
- The dev scripts (`bun run dev`, see the README) isolate ports, compose project and database per worktree, so several worktrees run side by side.
