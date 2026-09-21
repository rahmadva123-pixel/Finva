Finva — Design Spec (inspired by thsexcex.online)

Summary
- Source inspected: https://thsexcex.online — mobile-first crypto exchange layout, prominent hero, clear CTAs, icon-driven tab bar.
- Plan: recreate the professional visual language (layout, spacing, CTA prominence) while using original copy and royalty-free assets.

Goals
- Mobile-first responsive header + hero, then adapt to larger viewports.
- Preserve Firebase auth flows; only UI/markup changes.
- Avoid copying logos/text/images verbatim; use "inspired by" approach.

Palette (proposed)
- Primary: #0F172A (navy/near-black)
- Accent 1: #0EA5A4 (teal)
- Accent 2: #7C3AED (purple)
- Surface / Card: #0B1220
- Muted / Text: #9AA4B2
- Light background: #F8FAFC

Typography
- Headline: Inter / Poppins (bold, large scale on mobile)
- Body: Inter (400)
- Scale example: H1 28-32px (mobile), H2 20-24px, body 14-16px

Components to implement (priority)
1. Header: left logo (text placeholder), right actions (Sign in, Sign up, Theme toggle, hamburger on small screens)
2. Hero: stacked mobile-first layout — H1, one-line subheadline, primary CTA, secondary CTA, illustrative image on right (hidden on smallest screens)
3. Tab bar / nav (mobile): icon-driven bottom nav for authenticated area (later)
4. Buttons: primary (solid accent), secondary (outlined/ghost)
5. Cards: dark surface with subtle borders and float animation option

Accessibility
- Contrast ratio >=4.5 for body text on background.
- CTAs large enough for touch (min 44px height recommended).

Assets / Icons
- Use `lucide-react` for icons (already in repo).
- Replace any copyrighted images with royalty-free placeholders (Unsplash / local SVGs).

Implementation notes
- Add theme toggle persisting to `localStorage` (already present in `theme-provider`).
- Avoid DOM reads during server render; use `useEffect` for `document` access.
- Implement header + hero in `src/components/layout/` and include in `src/app/layout.tsx`.

Next steps
1. Implement `Header` and `Hero` components (mobile-first) and add to the root layout.
2. Iterate visuals and copy with the user, then adapt `login` and `signup` to match.

File: e:\Finva\source-code-fixed\docs\finva-design-spec.md
