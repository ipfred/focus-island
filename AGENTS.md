# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the Vue 3 + TypeScript frontend.
- `src/components/` holds island UI components like `Island.vue`, `CapsuleIdle.vue`, `LineHide.vue`.
- `src/composables/` holds shared logic such as `useIslandState.ts` (UI state machine) and `useTimer.ts`.
- `src/panel/` contains the task panel UI (`PanelApp.vue`, `TaskArea.vue`).
- `src/styles.css` defines Tailwind v4 setup and global CSS variables.
- `src-tauri/` contains the Rust backend, with commands in `src-tauri/src/lib.rs` and window config in `src-tauri/tauri.conf.json`.
- Build outputs go to `dist/` and `src-tauri/target/`.

## Build, Test, and Development Commands
- `npm run dev`: Tauri dev (runs Vite + Rust backend).
- `npm run vite:dev`: Frontend-only dev server for UI work.
- `npm run vite:build`: Build frontend to `dist/`.
- `npm run build`: Full Tauri production build (requires WiX on Windows).
- `cargo tauri build --debug` (from `src-tauri/`): Build debug `.exe`.
- `npx vue-tsc --noEmit`: Type check Vue/TS.
- `cargo check` (from `src-tauri/`): Rust compile check.

## Coding Style & Naming Conventions
- Use 2-space indentation in Vue/TS and JSON.
- Vue components use PascalCase filenames (e.g., `Island.vue`).
- Composables are named `useXxx.ts` and export `useXxx`.
- Tailwind v4 lives in `src/styles.css`; for `@apply` inside `<style scoped>`, add `@reference "../styles.css";` at the top.

## Testing Guidelines
There are no automated tests configured yet. Use:
- `npx vue-tsc --noEmit` for frontend type safety.
- `cargo check` for backend compile validation.
If adding tests, keep file names aligned with component or module names.

## Commit & Pull Request Guidelines
Recent commits are short, descriptive phrases in Chinese (e.g., “任务清单布局”). Keep messages concise and action-oriented.
For PRs, include:
- A short summary of behavior changes.
- How you tested (commands and results).
- Screenshots or short clips for UI changes (island/panel behavior).

## Notes & Tips
- The app uses two windows: `main` (island) and `panel` (task list). Coordinate changes across both when adjusting layout or behavior.
- User data is stored under `%APPDATA%\\pomodoro-island\\tasks.json` on Windows.
<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a Trellis command is available on your platform (e.g. `/trellis:finish-work`, `/trellis:continue`), prefer it over manual steps. Not every platform exposes every command.

If you're using Codex or another agent-capable tool, additional project-scoped helpers may live in:
- `.agents/skills/` — reusable Trellis skills
- `.codex/agents/` — optional custom subagents

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update`.

<!-- TRELLIS:END -->
