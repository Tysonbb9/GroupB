# Coding Standards

**Purpose:** Keep code readable, consistent, and easy to maintain across a team. These standards apply regardless of programming language; follow the project’s established conventions when they differ.

## 1. General Principles

- Prefer clear, descriptive names over abbreviations or clever wording.
- Avoid duplication; extract shared logic when it makes the code easier to understand.
- Handle errors explicitly. Don’t silently ignore failures.
- Remove dead code, temporary debugging statements, and unused imports before committing.
- Comments should explain *why* something is done, not repeat what the code says.
- Keep changes focused. Don’t reformat unrelated files as part of a feature or bug fix.

## 2. Formatting and Style

- Use consistent indentation, line endings, quotes, and spacing within a project.
- Keep lines and functions short enough to read comfortably; split complex logic into named steps.
- Format curly braces as follows:

  ```text
  if statement() {
      print()
  }
  ```

- Files appear to use two-space indentation. However, consistency within each file is more important to avoid merge conflicts.

## 3. Project Structure and Dependencies

- Follow the existing folder structure. Put new code where similar code already lives.
- Add only dependencies that are needed. Prefer existing project utilities when they are suitable.
- Don’t commit generated files, build output, local environment files, or editor state unless the project explicitly requires them or will override them.

## 4. Tests and Validation

- Add or update tests when changing behavior.
- Include tests for important edge cases and failure conditions, not just the expected path.
- Before committing, run the relevant checks, such as tests, linting, type checking, and builds.
- Fix new warnings and errors introduced by your changes. Don’t hide failures by weakening tests or disabling checks.
- When a check cannot be run, state which one and why in the pull request.

## 5. Git and Pull Requests

- Make small, focused commits with clear messages, such as `Fix empty search results`.
- Don’t commit unrelated edits, credentials, private data, or machine-specific configuration.
- Pull requests should explain the change and note how it was tested.
- Keep review discussions respectful and focused on improving the code.

## 6. Before Submitting a Change

- [ ] The change follows the project’s existing patterns.
- [ ] Names and structure are clear.
- [ ] Formatting and linting pass.
- [ ] Relevant tests pass or any limitation is explained.
- [ ] No debugging code, unused imports, secrets, or unrelated changes remain.
- [ ] The diff and pull request description accurately reflect the change.

**When in doubt:** Prefer the project’s documented conventions and existing code over personal editor settings.

**Signed:**

- Tyson B
- Gabby Odhiambo
- Bithiah Botsha
- Nhyira Mante
- Colin Redder
- TJ French
