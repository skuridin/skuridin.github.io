'use strict';

(() => {
    const lines = Array.from(document.querySelectorAll('h1 .name-line'));
    if (!lines.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    const glyphs = [',', '-', '·', '+', ':', '.', "'", '*', '~'];
    const characters = lines.map((line) => Array.from(line.textContent));
    const starts = characters.map((_, line) => line * 120);
    // Jitter stays below one character slot, so letters resolve left to right.
    const deadlines = characters.map((chars, line) => chars.map((_, index) =>
        starts[line] + (index / chars.length) * 850 + Math.random() * 70
    ));
    const endAt = Math.max(...deadlines.flat());
    let startAt;

    const step = (now) => {
        // Anchor to the first painted frame; 1300ms clears the 0.35s + 0.9s reveal.
        if (startAt === undefined) {
            startAt = now + 1300;
        }
        characters.forEach((chars, line) => {
            if (now < startAt + starts[line]) {
                return;
            }
            let output = '';
            chars.forEach((char, index) => {
                output += now >= startAt + deadlines[line][index]
                    ? char
                    : glyphs[Math.floor(now / 50 + index * 3) % glyphs.length];
            });
            lines[line].textContent = output;
        });
        if (now < startAt + endAt) {
            requestAnimationFrame(step);
        }
    };

    requestAnimationFrame(step);
})();
