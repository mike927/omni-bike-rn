## Git Branching Constraints
The Developer Agent MUST adhere to these branch naming conventions:
* `feature/<name>` for new features.
* `bugfix/<name>` for non-critical fixes.
* `hotfix/<issue>` for urgent fixes.

## Feature Completion Pipeline
Every feature, bugfix, or task MUST follow this exact pipeline:
1.  **Write Tests:** Write comprehensive Jest unit tests covering success, failure, and edge cases.
2.  **Pass CI Gate:** Run and pass `npm run lint && npm run typecheck && npm test`.
3.  **Internal Review Loop:** The Developer Agent spawns the Code Review Agent to analyze the `git diff main...HEAD`. Apply feedback until the Reviewer approves.
4.  **Final CI Check:** Re-run the CI Gate after review changes are applied.
5.  **User Notification:** Notify the human user to manually create the GitHub Pull Request.

## CI/CD & Distribution Execution
* **PR Checks:** Handled via GitHub Actions. A failing CI Gate blocks merges.
* **Development Builds:** Executed via `eas build --profile development`.
* **Production Builds:** Executed via `eas build --profile production`.
