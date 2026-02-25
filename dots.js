'use strict';

(function() {
    document.addEventListener('DOMContentLoaded', function() {
        const canvas = document.getElementById('dots-canvas');
        if (!canvas) {
            console.warn('Canvas element not found');
            return;
        }

        const hero = document.querySelector('.hero');
        if (!hero) {
            console.warn('Hero element not found');
            return;
        }

        let dotColor = getComputedStyle(document.documentElement).getPropertyValue('--dot').trim();
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const isMobile = window.matchMedia('(hover: none)').matches;
        const IDLE_TIMEOUT_MS = 2000;
        let lastMouseMove = Date.now();
        let isIdle = false;
        let idleCheckInterval = null;
        let resizeTimeout = null;

        function getMousePosition(e) {
            const rect = hero.getBoundingClientRect();
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        }

        function isWorkerRetryStale() {
            const retry = sessionStorage.getItem('dotsWorkerRetry');
            if (!retry) return true;
            const timestamp = parseInt(retry, 10);
            if (isNaN(timestamp)) return true;
            return Date.now() - timestamp > 60000;
        }

        // Check for OffscreenCanvas support
        const supportsOffscreenCanvas = 'OffscreenCanvas' in window;

        if (supportsOffscreenCanvas && canvas.transferControlToOffscreen) {
            // Use Web Worker with OffscreenCanvas
            initWithWorker();
        } else {
            // Fallback to main thread
            initMainThread();
        }

        function initWithWorker() {
            let worker = null;
            let offscreen = null;

            try {
                offscreen = canvas.transferControlToOffscreen();
                worker = new Worker('./dots-worker.js', { type: 'module' });
            } catch (e) {
                console.warn('Worker initialization failed, falling back to main thread:', e);
                if (offscreen) {
                    if (isWorkerRetryStale()) {
                        sessionStorage.setItem('dotsWorkerRetry', Date.now().toString());
                        console.warn('Canvas already transferred to offscreen, reloading page once');
                        location.reload();
                        return;
                    }
                    console.warn('Worker failed after retry, using main thread fallback');
                    sessionStorage.removeItem('dotsWorkerRetry');
                }
                initMainThread();
                return;
            }

            // Initialize worker
            const rect = hero.getBoundingClientRect();
            worker.postMessage({
                type: 'init',
                data: {
                    canvas: offscreen,
                    width: rect.width,
                    height: rect.height,
                    dotColor: dotColor,
                    isMobile: isMobile,
                    prefersReducedMotion: prefersReducedMotion.matches
                }
            }, [offscreen]);

            // Mouse events
            hero.addEventListener('mousemove', (e) => {
                const pos = getMousePosition(e);
                worker.postMessage({
                    type: 'mousemove',
                    data: {
                        x: pos.x,
                        y: pos.y,
                        prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                    }
                });
                lastMouseMove = Date.now();
            });

            hero.addEventListener('mouseleave', () => {
                worker.postMessage({
                    type: 'mouseleave',
                    data: {}
                });
            });

            // Idle detection
            function checkIdle() {
                if (!isMobile && Date.now() - lastMouseMove > IDLE_TIMEOUT_MS && !isIdle) {
                    isIdle = true;
                    worker.postMessage({
                        type: 'setIdle',
                        data: {
                            prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                        }
                    });
                }
            }

            function startIdleCheck() {
                if (!isMobile && !idleCheckInterval) {
                    idleCheckInterval = setInterval(checkIdle, 100);
                }
            }

            function stopIdleCheck() {
                if (idleCheckInterval) {
                    clearInterval(idleCheckInterval);
                    idleCheckInterval = null;
                }
            }

            // Resize with debounce
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    const rect = hero.getBoundingClientRect();
                    worker.postMessage({
                        type: 'resize',
                        data: {
                            width: rect.width,
                            height: rect.height
                        }
                    });
                }, 150);
            });

            // Visibility change
            document.addEventListener('visibilitychange', () => {
                worker.postMessage({
                    type: 'visibilitychange',
                    data: {
                        hidden: document.hidden,
                        prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                    }
                });
            });

            // Color scheme change
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
                dotColor = getComputedStyle(document.documentElement).getPropertyValue('--dot').trim();
                worker.postMessage({
                    type: 'updateColor',
                    data: {
                        color: dotColor
                    }
                });
            });

            // Reduced motion change
            window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
                worker.postMessage({
                    type: 'setReducedMotion',
                    data: {
                        value: e.matches
                    }
                });
            });

            // Start idle check
            startIdleCheck();

            // Cleanup on page unload
            window.addEventListener('beforeunload', () => {
                if (worker) {
                    worker.terminate();
                }
                stopIdleCheck();
            });
        }

        function initMainThread() {
            console.log('Using main thread fallback for dots animation');
            
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.warn('Canvas 2D context not supported');
                return;
            }

            let dots = [];
            let mouse = { x: -1000, y: -1000 };
            let time = 0;
            let animationId = null;
            let lastFrameTime = 0;

            const SPACING = 24;
            const DOT_RADIUS = 1;
            const INFLUENCE_RADIUS = 100;
            const RESIZE_DEBOUNCE_MS = 150;

            const TARGET_FPS = isMobile ? 30 : 60;
            const FRAME_INTERVAL = 1000 / TARGET_FPS;

            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
                dotColor = getComputedStyle(document.documentElement).getPropertyValue('--dot').trim();
            });

            function initDots() {
                dots = [];
                const cols = Math.ceil(canvas.width / SPACING) + 1;
                const rows = Math.ceil(canvas.height / SPACING) + 1;

                for (let i = 0; i < cols; i++) {
                    for (let j = 0; j < rows; j++) {
                        dots.push({
                            originX: i * SPACING,
                            originY: j * SPACING,
                            x: i * SPACING,
                            y: j * SPACING
                        });
                    }
                }
            }

            function resize() {
                const rect = hero.getBoundingClientRect();
                canvas.width = rect.width;
                canvas.height = rect.height;
                initDots();
                if (prefersReducedMotion.matches || isIdle) {
                    drawStatic();
                }
            }

            function drawStatic() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                dots.forEach(dot => {
                    ctx.beginPath();
                    ctx.arc(dot.originX, dot.originY, DOT_RADIUS, 0, Math.PI * 2);
                    ctx.fillStyle = dotColor;
                    ctx.fill();
                });
            }

            function checkIdle() {
                if (!isMobile && Date.now() - lastMouseMove > IDLE_TIMEOUT_MS && !isIdle) {
                    isIdle = true;
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    dots.forEach(dot => {
                        ctx.beginPath();
                        ctx.arc(dot.originX, dot.originY, DOT_RADIUS, 0, Math.PI * 2);
                        ctx.fillStyle = dotColor;
                        ctx.fill();
                    });
                    stopAnimation();
                }
            }

            function draw(timestamp) {
                if (timestamp - lastFrameTime < FRAME_INTERVAL) {
                    animationId = requestAnimationFrame(draw);
                    return;
                }
                lastFrameTime = timestamp;

                try {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                } catch (e) {
                    console.error('Canvas clearRect failed:', e);
                    stopAnimation();
                    return;
                }
                time += 0.02;

                if (isMobile) {
                    const centerX = canvas.width / 2;
                    const centerY = canvas.height / 2;
                    const radiusX = canvas.width * 0.3;
                    const radiusY = canvas.height * 0.25;
                    mouse.x = centerX + Math.cos(time * 0.5) * radiusX;
                    mouse.y = centerY + Math.sin(time * 0.7) * radiusY;
                }

                try {
                    dots.forEach(dot => {
                        const dx = mouse.x - dot.originX;
                        const dy = mouse.y - dot.originY;
                        const dist = Math.sqrt(dx * dx + dy * dy);

                        if (dist < INFLUENCE_RADIUS) {
                            const force = (INFLUENCE_RADIUS - dist) / INFLUENCE_RADIUS;
                            const angle = Math.atan2(dy, dx);
                            const pushX = Math.cos(angle) * force * 20;
                            const pushY = Math.sin(angle) * force * 20;
                            dot.x = dot.originX - pushX;
                            dot.y = dot.originY - pushY;
                        } else {
                            dot.x += (dot.originX - dot.x) * 0.1;
                            dot.y += (dot.originY - dot.y) * 0.1;
                        }

                        if (!Number.isFinite(dot.x) || !Number.isFinite(dot.y)) {
                            dot.x = dot.originX;
                            dot.y = dot.originY;
                            return;
                        }

                        ctx.beginPath();
                        ctx.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2);
                        ctx.fillStyle = dotColor;
                        ctx.fill();
                    });
                } catch (e) {
                    console.error('Canvas drawing failed:', e);
                    stopAnimation();
                    return;
                }

                if (!document.hidden && !isIdle) {
                    animationId = requestAnimationFrame(draw);
                }
            }

            function startAnimation() {
                if (animationId === null && !isIdle) {
                    animationId = requestAnimationFrame(draw);
                }
            }

            function stopAnimation() {
                if (animationId !== null) {
                    cancelAnimationFrame(animationId);
                    animationId = null;
                }
            }

            function startIdleCheck() {
                if (!isMobile && !idleCheckInterval) {
                    idleCheckInterval = setInterval(checkIdle, 100);
                }
            }

            function stopIdleCheck() {
                if (idleCheckInterval) {
                    clearInterval(idleCheckInterval);
                    idleCheckInterval = null;
                }
            }

            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    stopAnimation();
                } else if (!prefersReducedMotion.matches && !isIdle) {
                    startAnimation();
                }
            });

            hero.addEventListener('mousemove', (e) => {
                const pos = getMousePosition(e);
                mouse.x = pos.x;
                mouse.y = pos.y;
                lastMouseMove = Date.now();
                
                if (isIdle && !prefersReducedMotion.matches) {
                    isIdle = false;
                    startAnimation();
                }
            });

            hero.addEventListener('mouseleave', () => {
                mouse.x = -1000;
                mouse.y = -1000;
            });

            window.addEventListener('resize', () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(resize, RESIZE_DEBOUNCE_MS);
            });

            resize();
            startIdleCheck();

            prefersReducedMotion.addEventListener('change', () => {
                if (prefersReducedMotion.matches) {
                    stopAnimation();
                    stopIdleCheck();
                    drawStatic();
                } else {
                    isIdle = false;
                    startIdleCheck();
                    startAnimation();
                }
            });

            if (prefersReducedMotion.matches) {
                drawStatic();
            } else {
                startAnimation();
            }
        }
    });
})();
