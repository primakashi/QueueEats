# Output Format Reference

Rules and patterns per output format. Read the relevant section based on the user's chosen framework.

---

## React + Tailwind

### When to use
- User says "React", "React + Tailwind", or no preference when building a SPA or component

### Rules
- Use functional components with hooks
- **Exact px values**: Use inline styles when Tailwind classes can't match exactly (e.g. `style={{ fontSize: '56px', paddingTop: '72px' }}`)
- **Tailwind for structure**: Use Tailwind for layout, flexbox, grid, responsive breakpoints
- **CSS variables**: Define design tokens in a `<style>` tag or `index.css` for colors, fonts
- Import Google Fonts via `@import` in CSS or `<link>` in the HTML template
- Use `framer-motion` for animations when available
- Use `lucide-react` for icons
- **Single file**: Export default component, include all subcomponents in same file unless user says split

### Template
```jsx
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=...');
  :root {
    --color-primary: #...;
    --color-bg: #...;
  }
`;

export default function Page() {
  return (
    <>
      <style>{styles}</style>
      <main>...</main>
    </>
  );
}
```

### Responsive breakpoints
Use Tailwind responsive prefixes matching the reference:
- `sm:` → 640px
- `md:` → 768px
- `lg:` → 1024px
- `xl:` → 1280px
- `2xl:` → 1536px

---

## Next.js

### When to use
- User says "Next.js" explicitly
- Project involves routing, SSR, or multi-page structure

### Rules
- Use App Router (`app/`) by default unless user specifies Pages Router
- Components go in `components/` unless single-file requested
- Use `next/font` for font loading (not `@import`)
- Use `next/image` for images
- Use `'use client'` directive for interactive components
- CSS Modules for component-scoped styles, or Tailwind for utilities
- **Exact values**: Use inline styles or CSS Modules for pixel-perfect values

### File structure (if split)
```
app/
  page.tsx          ← main page
  layout.tsx        ← root layout + fonts
  globals.css       ← CSS variables, resets
components/
  Nav.tsx
  Hero.tsx
  [Section].tsx
```

### Single file output
When user requests single file, output as a single `page.tsx` with `'use client'` and all components inlined.

---

## HTML + CSS (Vanilla)

### When to use
- User says "HTML", "vanilla", "no framework", or "HTML + CSS"
- Quick prototype or static delivery

### Rules
- Semantic HTML5 elements (`<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`)
- CSS custom properties for all design tokens
- No external CSS frameworks unless specified
- Use `<link rel="stylesheet">` or `<style>` block for Google Fonts
- All JS inline in `<script>` tag at bottom, or separate `.js` file if split
- **Exact values**: Always use exact px values from reference — no shorthand approximations
- Use CSS Grid and Flexbox for layout
- Animations via `@keyframes` + Intersection Observer

### Template
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Title</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=...&display=swap" rel="stylesheet">
  <style>
    :root {
      --color-primary: #...;
      --font-heading: '...', sans-serif;
      --font-body: '...', sans-serif;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    /* ... */
  </style>
</head>
<body>
  <!-- content -->
  <script>
    // JS interactions
  </script>
</body>
</html>
```

---

## Format Selection Logic

```
User specifies format → use it
User gives no preference + cloning → match reference's framework if identifiable
User gives no preference + building → ask (see Step 2 in SKILL.md)
User says "Next.js only" or "React only" → override everything, use that
```

---

## Multi-file vs Single File

### Single file
- All CSS in `<style>` or template literal
- All components in one file
- All JS in `<script>` or inline
- Best for: quick delivery, copy-paste, prototypes

### Split into components
Suggest this structure if user agrees:
```
src/
  components/
    Nav/
      Nav.jsx
      Nav.module.css (if CSS Modules)
    Hero/
    [Section]/
  styles/
    globals.css
    variables.css
  pages/ or app/
    index.jsx or page.jsx
```

Always confirm structure with user before generating split output.
