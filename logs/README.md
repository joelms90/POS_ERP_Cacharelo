# Session Transcripts & Logs (logs/)

This directory stores historical logs and session summaries of major AI brainstorms, heavy code refactorings, or complex feature implementations. It helps developer agents recover context from previous sessions and keeps the active files size compact.

## 📁 Naming Convention

Create dated markdown files in this folder for significant sessions:
`YYYY-MM-DD-<topic>.md` (e.g., `2026-05-30-llm-tracker-setup.md`)

## 📝 Session Log Template

Use the following template when creating a new session log:

```markdown
# Session Log: YYYY-MM-DD - [Short Description]

## 📅 Session Info
- **Date**: YYYY-MM-DD
- **Agent/Model**: Gemini 3.5 Flash / Claude 3.5 Sonnet
- **Primary Files Modified**:
  - `file:///path/to/file1`
  - `file:///path/to/file2`

## 🎯 Goals & Scope
[Describe the goals of this session]

## 🛠️ Key Decisions & Implementations
1. **[Decision/Feature 1]**: [Details and rationale]
2. **[Decision/Feature 2]**: [Details and rationale]

## ⚠️ Challenges & Discovered Edge Cases
- [Describe any blockers or edge cases handled]

## ⏩ Next Steps & Backlog Tasks
- [x] Completed task during this session
- [ ] Task to be addressed in the next session (#todo)
```

## 🚀 Best Practices for LLM Compatibility
- **Summarize Context**: When a development phase is completed, summarize its final architecture and archive the raw transcripts here.
- **Hierarchical Headings**: Use Markdown headings logically (`#`, `##`, `###`) to help the LLM parse historical context during subsequent prompts.
- **Tag consistently**: Use status tags (`#todo`, `#blocked`, `#waiting-for-llm`) in the logs as well.
