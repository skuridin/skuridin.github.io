'use strict';

(() => {
    const lines = document.querySelectorAll('.name-line');
    if (!lines.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    const glyphs = [',', '-', '·', '+', ':', '.', "'", '*', '~'];
    const original = Array.from(lines, (line) => line.textContent);
    const startAt = performance.now() + 1300;
    // 1300ms lets the h1's 0.35s-delayed, 0.9s reveal finish first.
    // Jitter stays below one character slot, so letters resolve left to right.
    const deadlines = original.map((value, line) => Array.from(value, (_, index) =>
        startAt + line * 120 + (index / value.length) * 850 + Math.random() * 70
    ));

    const step = (now) => {
        let active = false;
        original.forEach((value, line) => {
            if (now < startAt + line * 120) {
                active = true;
                return;
            }
            let output = '';
            for (let index = 0; index < value.length; index += 1) {
                if (now >= deadlines[line][index]) {
                    output += value[index];
                } else {
                    output += glyphs[Math.floor(now / 50 + index * 3) % glyphs.length];
                    active = true;
                }
            }
            lines[line].textContent = output;
        });
        if (active) {
            requestAnimationFrame(step);
        }
    };

    requestAnimationFrame(step);
})();
