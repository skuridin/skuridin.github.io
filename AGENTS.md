# AGENTS.md for skuridin.github.io

## Build Commands
- No build process; static HTML/CSS site.
- To serve locally: `python -m http.server 8000` or `npx serve .`

## Lint Commands
- HTML: `npx htmlhint index.html`
- No existing lint setup or configuration files.

## Test Commands
- No tests present.
- For single test: N/A
- Suggest adding unit tests with Jest if expanding to JS.

## Code Style Guidelines
- Use semantic HTML5 elements (main, header, section, footer).
- External CSS linked in head; no inline styles.
- Naming: Kebab-case for classes/IDs (e.g., header-info, prompt, terminal-section).
- Formatting: 4-space indentation for HTML and CSS properties; selectors unindented in CSS.
- Consistent line breaks and spacing.
- No JS yet; if added, use ES6+, strict mode.
- Error handling: N/A for static site.
- Imports: N/A; avoid external dependencies unless necessary.
- Types: N/A.
- Follow accessibility best practices (alt attributes for images, semantic structure; ARIA not yet needed).

## Git Guidelines
- Use conventional commits for commit messages.
- PR titles must follow the same conventional commit standard.
- Interact with GitHub using gh CLI for viewing, creating, and managing PRs, diffs, etc.
- **Workflow**: Always create feature branches for changes, never commit directly to master:
  ```bash
  git checkout -b <type>/<short-description>
  # Make changes and commit
  git push -u origin <branch-name>
  gh pr create --title "type: description" --body "Details..."
  ```
- Branch naming: Use conventional commit prefixes (feat/, fix/, refactor/, docs/, etc.)
- Never push directly to master - branch protection rules are enabled

## Tools Integration
- No Cursor/Copilot rules found.
- Keep site minimal and performant.