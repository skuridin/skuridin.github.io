# AGENTS.md for skuridin.github.io

## Build Commands
- No build process; static HTML/CSS/JS site.
- To serve locally: `python -m http.server 8000` or `npx serve .`

## Lint Commands
- HTML: `npx htmlhint index.html`
- JS: `node --check motion.js && node --check mosaic.js && node --check mosaic-pattern.js && node --check mosaic-shaders.js`
- No existing lint setup or configuration files.

## Test Commands
- Regression checks: `node --test mosaic.test.mjs` (uses Node built-ins and the vendored three.js bundle; the renderer is a test double).
- Check the hero in a real browser; headless Chromium needs `--use-angle=swiftshader --enable-unsafe-swiftshader` for WebGL.

## Code Style Guidelines
- Use semantic HTML5 elements (main, header, section, footer).
- External CSS linked in head; no inline styles.
- Naming: Kebab-case for classes/IDs (e.g., header-info, prompt, terminal-section).
- Formatting: 4-space indentation for HTML and CSS properties; selectors unindented in CSS.
- Consistent line breaks and spacing.
- Progressive-enhancement JS: ES6+, strict mode. `motion.js` is a dependency-free IIFE. `mosaic.js` is an ES module that renders the hero with three.js; without WebGL the CSS gradient on `.hero-art` stays.
- Error handling: N/A for static site.
- Imports: three.js is the only dependency. It is vendored, because the CSP allows scripts from `'self'` only.
- `vendor/three.min.js` is a tree-shaken bundle of the exports in `vendor/three-entry.js`. After you change that list or bump the version, rebuild it:
  ```bash
  docker run --rm -v "$PWD/vendor":/vendor -w /tmp node:24-alpine sh -c "npm i --silent three@0.187.0 esbuild@0.25.12 && cp node_modules/three/LICENSE /vendor/three.LICENSE && cp /vendor/three-entry.js . && npx esbuild three-entry.js --bundle --format=esm --minify --legal-comments=inline --outfile=/vendor/three.min.js"
  ```
- Types: N/A.
- Follow accessibility best practices (alt attributes for images, semantic structure, ARIA where needed).

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
