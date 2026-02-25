'use strict';

let canvas = null;
let ctx = null;
let dots = [];
let mouse = { x: -1000, y: -1000 };
let time = 0;
let animationId = null;
let dotColor = '#d4d4d4';

const SPACING = 24;
const DOT_RADIUS = 1;
const INFLUENCE_RADIUS = 100;

let isMobile = false;
let TARGET_FPS = 60;
let FRAME_INTERVAL = 1000 / 60;
let lastFrameTime = 0;
let isIdle = false;
let prefersReducedMotion = false;

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

function drawStatic() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dots.forEach(dot => {
        ctx.beginPath();
        ctx.arc(dot.originX, dot.originY, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.fill();
    });
}

function draw(timestamp) {
    if (!ctx) return;
    
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

    if (!isIdle) {
        animationId = requestAnimationFrame(draw);
    }
}

function stopAnimation() {
    if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

self.onmessage = function(e) {
    const { type, data } = e.data;

    switch (type) {
        case 'init':
            canvas = data.canvas;
            ctx = canvas.getContext('2d');
            canvas.width = data.width;
            canvas.height = data.height;
            dotColor = data.dotColor || '#d4d4d4';
            isMobile = data.isMobile || false;
            prefersReducedMotion = data.prefersReducedMotion || false;
            if (isMobile) {
                TARGET_FPS = 30;
                FRAME_INTERVAL = 1000 / 30;
            }
            initDots();
            if (prefersReducedMotion) {
                isIdle = true;
                drawStatic();
            } else {
                startAnimation();
            }
            break;

        case 'resize':
            if (canvas) {
                canvas.width = data.width;
                canvas.height = data.height;
                initDots();
                if (isIdle) {
                    drawStatic();
                }
            }
            break;

        case 'mousemove':
            mouse.x = data.x;
            mouse.y = data.y;
            if (isIdle && !data.prefersReducedMotion) {
                isIdle = false;
                startAnimation();
            }
            break;

        case 'mouseleave':
            mouse.x = -1000;
            mouse.y = -1000;
            break;

        case 'setIdle':
            isIdle = true;
            stopAnimation();
            if (ctx) {
                drawStatic();
            }
            break;

        case 'setReducedMotion':
            if (data.value) {
                isIdle = true;
                stopAnimation();
                if (ctx) {
                    drawStatic();
                }
            } else {
                isIdle = false;
                startAnimation();
            }
            break;

        case 'updateColor':
            dotColor = data.color;
            if (isIdle && ctx) {
                drawStatic();
            }
            break;

        case 'visibilitychange':
            if (data.hidden) {
                stopAnimation();
            } else if (!data.prefersReducedMotion && !isIdle) {
                startAnimation();
            }
            break;
    }
};

function startAnimation() {
    if (animationId === null && !isIdle) {
        animationId = requestAnimationFrame(draw);
    }
}
