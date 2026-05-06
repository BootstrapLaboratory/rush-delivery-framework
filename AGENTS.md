# AGENTS.md

- if you do not find files referenced in this document, then STOP processing and write error message about it
- Read `.ai/rules/BashModules.md` only when working on bash modules, shell scripts, or shell-based project layout.
- Do not load specialized docs unless the task touches that area.
- after completing any repository file changes, give two commit messages in semantic commits style: short and detailed
- Read `.ai/rules/DocEditing.md` only when editing documentation, markdown documents
- Read `.ai/conventions.md` when modifying Dagger framework behavior, `dagger.json`, release/version preparation, or AI-facing project conventions.
- Create a task file under `tasks` before implementation when the request is more than a small local fix, needs multiple design decisions, or changes public project contracts. Task files are required by default for module public API changes, metadata or JSON schema changes, behavior changes across `workflow`/`validate`/`deploy`, combined docs-and-implementation changes, and anything that needs version guidance.
- Read `.ai/rules/TasksFiles.md` when creating, managing, or modifying
  files under the `tasks` directory.
