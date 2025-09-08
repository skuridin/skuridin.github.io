# AGENTS.md for skuridin.github.io

## Build Commands
- No build process; static HTML/CSS site.
- To serve locally: `python -m http.server 8000` or `npx serve .`

## Lint Commands
- HTML: Install and run `npx htmlhint index.html`
- CSS: Install and run `npx stylelint *.css` (if CSS files added)
- No existing lint setup.

## Test Commands
- No tests present.
- For single test: N/A
- Suggest adding unit tests with Jest if expanding to JS.

## Code Style Guidelines
- Use semantic HTML5 elements.
- Inline CSS for simplicity; external if growing.
- Naming: Kebab-case for classes/IDs, descriptive names.
- Formatting: 2-space indent, consistent line breaks.
- No JS yet; if added, use ES6+, strict mode.
- Error handling: N/A for static site.
- Imports: N/A; avoid external deps unless necessary.
- Types: N/A.
- Follow accessibility best practices (alt tags, ARIA).

## Tools Integration
- No Cursor/Copilot rules found.
- Keep site minimal and performant.