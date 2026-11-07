'use strict';

(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!reduceMotion && 'IntersectionObserver' in window) {
        document.documentElement.classList.add('js');
        // The root reaches far above the viewport, so items a fast scroll jumps past still count as seen.
        const observer = new IntersectionObserver((entries) => {
            entries.filter((entry) => entry.isIntersecting).forEach((entry, index) => {
                // Items entering together reveal in sequence.
                entry.target.style.transitionDelay = `${index * 90}ms`;
                entry.target.classList.add('is-in');
                observer.unobserve(entry.target);
            });
        }, { rootMargin: '100000px 0px -8% 0px' });
        document.querySelectorAll('.reveal').forEach((item) => observer.observe(item));
    }

    const hero = document.querySelector('.hero');
    if (hero) {
        const loadMosaic = () => import('./mosaic.js').catch((error) => console.error(error));
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    observer.disconnect();
                    loadMosaic();
                }
            });
            observer.observe(hero);
        } else {
            loadMosaic();
        }
    }
})();
