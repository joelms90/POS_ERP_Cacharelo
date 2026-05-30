# Feature Specification: LLM Work Tracking & Documentation System

**Status**: Approved / Ready for Porting
**Created**: 2026-05-30
**Scope**: Repository-wide documentation and workflow standards for AI-assisted coding.

---

## 🎯 Summary

This specification outlines the standard structure, templates, and best practices for implementing an **LLM Work Tracking System** in any software repository. The system provides a Git-friendly, token-efficient, and hierarchical format for keeping AI coding assistants aligned with project roadmaps, active tasks, session histories, and developer prompts.

---

## 📁 Directory & File Structure

An implementation of this system MUST establish the following files and folders at the repository root:

```text
├── README.md             # Master Dashboard & Tech Summary
├── PLAN.md               # Living Roadmap (Phases & Checkboxes)
├── TRACKER.md            # Active Task Tracker (Detailed Table)
├── prompts/              # Reusable prompts folder
│   ├── README.md         # Prompts guide
│   └── *.md              # Role/task specific prompts
└── logs/                 # dated session transcripts/summaries
    ├── README.md         # Logs guide
    └── YYYY-MM-DD-*.md   # Dated chat logs
```

---

## 📋 Requirements

### Functional Requirements
- **FR-001**: The system MUST contain a master dashboard in `README.md` containing links to active documents, tech stack, and high-level status.
- **FR-002**: The system MUST provide a living roadmap in `PLAN.md` breaking down the project into hierarchical phases and tasks using Markdown checkboxes (`- [ ]` and `- [x]`).
- **FR-003**: The system MUST track current tasks in `TRACKER.md` using a table structure containing columns: `Task`, `Assigned To`, `Status`, `Last Updated`, and `Notes`.
- **FR-004**: The system MUST define a standard set of status tags in `TRACKER.md` to communicate progress state to the LLM.
- **FR-005**: Reusable complex prompts MUST be stored in `prompts/` in individual `.md` files to preserve system instructions and developer personas across sessions.
- **FR-006**: Summaries of complex LLM sessions, brainstorms, or code changes MUST be saved in the `logs/` directory using a dated file name convention (`YYYY-MM-DD-chat.md`).

---

## 📊 System Templates

### 1. Living Roadmap Template (`PLAN.md`)
```markdown
# Living Roadmap (PLAN.md)

This roadmap tracks high-level phases and milestones of the project.

## 🗺️ Phases

### Phase 1: Setup & Foundations
- [ ] **T001** Setup project configuration files
- [ ] **T002** Design initial domain model
- [ ] **T003** Initialize Git repository

### Phase 2: Core Implementation
- [ ] **T004** Implement database schema and models
- [ ] **T005** Build core API endpoints
```

### 2. Task Tracker Template (`TRACKER.md`)
```markdown
# Active Task Tracker (TRACKER.md)

| Task ID / Description | Assigned To | Status | Last Updated | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **T001** Setup config | Developer | `#todo` | YYYY-MM-DD | Initial setup |
| **T002** Domain design | Antigravity | `#in-progress` | YYYY-MM-DD | Drafting entities |

### 🚦 Status Tags
- `#todo` - Planned, not started.
- `#in-progress` - Active development.
- `#blocked` - Stalled by dependency.
- `#waiting-for-llm` - Waiting for AI response or code generation.
- `#completed` - Statically validated and tested.
```

### 3. Session Log Template (`logs/YYYY-MM-DD-chat.md`)
```markdown
# Session Log: YYYY-MM-DD - [Session Name]

## 📅 Session Info
- **Date**: YYYY-MM-DD
- **Agent/Model**: [Model Name]
- **Primary Files Modified**:
  - `file:///path/to/modified_file.dart`

## 🎯 Goals & Scope
- [Summary of what was planned for the session]

## 🛠️ Key Decisions & Implementations
1. **[Decision 1]**: [Details of choices and implementation]
2. **[Decision 2]**: [Details of choices and implementation]

## ⏩ Next Steps
- [ ] Remaining task 1 (#todo)
- [ ] Remaining task 2 (#todo)
```

---

## 🚀 Best Practices for LLM Compatibility

1. **Context Window Optimization**: Keep `PLAN.md` and `TRACKER.md` concise. Archive historical logs in `logs/` so they are not loaded into every LLM session unless explicitly requested.
2. **Markdown Hyperlinking**: Always use absolute or relative file links using standard markdown format `[filename](file:///path/to/file)` to enable agents to instantly access related files.
3. **Structured Headings**: Organize plans and specs with strict hierarchical header tags (`#`, `##`, `###`) to assist LLM context parsers.
