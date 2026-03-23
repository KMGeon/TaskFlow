# Git Conventions

## Branch Naming
```
feat/{description}      # New feature
fix/{description}       # Bug fix
refactor/{description}  # Refactoring
docs/{description}      # Documentation
chore/{description}     # Maintenance
```

## Commit Messages
Follow Conventional Commits:
```
type(scope): description

feat(kanban): add drag-and-drop task reordering
fix(cli): handle missing config file gracefully
refactor(core): extract task validation logic
test(prd): add parser edge case coverage
```

### Types
- `feat` — new feature
- `fix` — bug fix
- `refactor` — code restructuring (no behavior change)
- `test` — adding/updating tests
- `docs` — documentation only
- `chore` — build, deps, config changes
- `style` — formatting (no logic change)

## Rules
- Commit small, atomic changes
- Never commit secrets, `.env` files, or credentials
- Keep commits buildable — don't break the build mid-branch
- Squash WIP commits before PR
