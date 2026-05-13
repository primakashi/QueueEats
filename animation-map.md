# Animation Map Reference

When cloning animations from a reference site, identify the animation type and use the closest equivalent implementation below.

---

## Identification Guide

Look for these signals in the reference HTML/CSS/JS:
- `@keyframes` → CSS animation
- `transition:` → CSS transition
- `AOS`, `data-aos` → AOS scroll library
- `gsap`, `TweenMax`, `ScrollTrigger` → GSAP
- `framer-motion`, `motion.div` → Framer Motion
- `Swiper`, `Splide`, `Glide` → Slider/carousel
- `lottie` → Lottie JSON animation
- `canvas` → Canvas/WebGL animation
- `CountUp`, number counting → Counter animation
- `typed.js`, `typewriter` → Typewriter effect
- `parallax` → Parallax scrolling

---

## Mapping Table

| Reference Animation | Closest Equivalent | Notes |
|---|---|---|
| GSAP ScrollTrigger fade | CSS `@keyframes` + Intersection Observer | Match timing and easing |
| GSAP timeline | CSS animation with `animation-delay` stagger | Use same duration |
| AOS fade-up / fade-in | CSS `@keyframes` + Intersection Observer | Simple, no dependency needed |
| Framer Motion `initial/animate` | Keep Framer Motion (React) | Direct match |
| Framer Motion `whileInView` | Keep or use Intersection Observer | Keep if React |
| Lottie | Describe as placeholder, note original | Cannot replicate exactly |
| Canvas/WebGL | CSS gradient animation or SVG equivalent | Note downgrade |
| Parallax scroll | CSS `transform: translateY` on scroll event | Match parallax ratio |
| Typewriter effect | CSS `steps()` animation or typed.js | Match speed |
| Counter animation | JS `requestAnimationFrame` counter | Match duration |
| Hover scale | `transform: scale()` + `transition` | Match scale value |
| Hover color shift | `transition: background-color` | Match duration |
| Hover underline draw | `transform: scaleX()` on `::after` | Match easing |
| Slider/carousel (Swiper) | Embla Carousel (React) or CSS scroll snap (HTML) | Match slide behavior |
| Infinite scroll ticker | CSS `@keyframes` translate loop | Match speed |
| Stagger children | `animation-delay` increments or Framer `staggerChildren` | Match delay interval |
| Page transition | Next.js layout animation or CSS class swap | Match transition type |
| Sticky nav change | JS `scroll` event + class toggle | Match scroll threshold |
| Number odometer | JS counter with `requestAnimationFrame` | Match easing |
| SVG path draw | `stroke-dashoffset` animation | Match duration |
| Blur-in reveal | CSS `filter: blur()` + `opacity` transition | Match values |
| Clip-path reveal | CSS `clip-path` transition | Match shape and duration |

---

## Implementation Snippets

### Intersection Observer Fade-Up (HTML)
```css
.fade-up {
  opacity: 0;
  transform: translateY(40px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.fade-up.visible {
  opacity: 1;
  transform: translateY(0);
}
```
```js
const observer = new IntersectionObserver((entries) => {
  entries.forEach(el => {
    if (el.isIntersecting) el.target.classList.add('visible');
  });
}, { threshold: 0.1 });
document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));
```

### Framer Motion Fade-Up (React)
```jsx
import { motion } from 'framer-motion';
<motion.div
  initial={{ opacity: 0, y: 40 }}
  whileInView={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.6, ease: 'easeOut' }}
  viewport={{ once: true }}
>
```

### Stagger Children (Framer Motion)
```jsx
const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };
<motion.ul variants={container} initial="hidden" animate="show">
  {items.map(i => <motion.li variants={item} key={i}>{i}</motion.li>)}
</motion.ul>
```

### Sticky Nav with Scroll Class (HTML)
```js
window.addEventListener('scroll', () => {
  document.querySelector('nav').classList.toggle('scrolled', window.scrollY > 80);
});
```

### Counter Animation (JS)
```js
function animateCounter(el, target, duration = 2000) {
  let start = 0;
  const step = timestamp => {
    if (!start) start = timestamp;
    const progress = Math.min((timestamp - start) / duration, 1);
    el.textContent = Math.floor(progress * target);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
```

### Infinite Ticker (CSS)
```css
@keyframes ticker {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
.ticker-inner {
  display: flex;
  animation: ticker 20s linear infinite;
  width: 200%; /* duplicate content for seamless loop */
}
```

---

## Easing Reference

Match easing values from the original:

| Original | CSS Equivalent |
|---|---|
| `power2.out` (GSAP) | `cubic-bezier(0.215, 0.61, 0.355, 1)` |
| `power3.out` | `cubic-bezier(0.165, 0.84, 0.44, 1)` |
| `expo.out` | `cubic-bezier(0.19, 1, 0.22, 1)` |
| `elastic` | `cubic-bezier(0.68, -0.55, 0.265, 1.55)` |
| `easeOut` | `ease-out` |
| `easeInOut` | `ease-in-out` |
| `linear` | `linear` |
