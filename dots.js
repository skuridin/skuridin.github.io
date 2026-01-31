const canvas = document.getElementById('dots-canvas');
const ctx = canvas.getContext('2d');
const hero = document.querySelector('.hero');

let dots = [];
let mouse = { x: -1000, y: -1000 };
let time = 0;
let animationId = null;
let resizeTimeout = null;
let dotColor = getComputedStyle(document.documentElement).getPropertyValue('--dot').trim();
const SPACING = 24;
const DOT_RADIUS = 1;
const INFLUENCE_RADIUS = 100;
const RESIZE_DEBOUNCE_MS = 150;

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    dotColor = getComputedStyle(document.documentElement).getPropertyValue('--dot').trim();
});

const isMobile = window.matchMedia('(hover: none)').matches;
const TARGET_FPS = isMobile ? 30 : 60;
const FRAME_INTERVAL = 1000 / TARGET_FPS;
let lastFrameTime = 0;
let lastMouseMove = Date.now();
const IDLE_TIMEOUT_MS = 2000;
let isIdle = false;

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

function draw(timestamp) {
    if (timestamp - lastFrameTime < FRAME_INTERVAL) {
        animationId = requestAnimationFrame(draw);
        return;
    }
    lastFrameTime = timestamp;

    // Check for idle on desktop (not mobile)
    if (!isMobile && Date.now() - lastMouseMove > IDLE_TIMEOUT_MS) {
        isIdle = true;
        // Draw one final frame with dots settled
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        dots.forEach(dot => {
            ctx.beginPath();
            ctx.arc(dot.originX, dot.originY, DOT_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = dotColor;
            ctx.fill();
        });
        stopAnimation();
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    time += 0.02;

    if (isMobile) {
        // Animate virtual cursor in a smooth path
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radiusX = canvas.width * 0.3;
        const radiusY = canvas.height * 0.25;
        mouse.x = centerX + Math.cos(time * 0.5) * radiusX;
        mouse.y = centerY + Math.sin(time * 0.7) * radiusY;
    }

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

        ctx.beginPath();
        ctx.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.fill();
    });

    if (!document.hidden) {
        animationId = requestAnimationFrame(draw);
    }
}

function startAnimation() {
    if (animationId === null) {
        animationId = requestAnimationFrame(draw);
    }
}

function stopAnimation() {
    if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopAnimation();
    } else if (!prefersReducedMotion.matches) {
        startAnimation();
    }
});

hero.addEventListener('mousemove', (e) => {
    const rect = hero.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    lastMouseMove = Date.now();
    
    // Restart animation if was idle
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

prefersReducedMotion.addEventListener('change', () => {
    if (prefersReducedMotion.matches) {
        stopAnimation();
        drawStatic();
    } else {
        startAnimation();
    }
});

if (prefersReducedMotion.matches) {
    drawStatic();
} else {
    startAnimation();
}
