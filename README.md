Finva

Finva is a rebranded Next.js web application prepared for further visual and feature development.

Quick start

1. Install dependencies:

```bash
cd source-code-fixed
npm install
```

2. Run development server:

```bash
npm run dev
```

Notes

- Firebase/auth integrations have been removed from `src/lib/firebase.ts` and `src/lib/firebase-admin.ts` and replaced with safe stubs. If you plan to re-enable backend services, add environment variables and configuration carefully.
- Build artifacts (`.next`) are excluded from the repository. Ensure no local secrets remain before making the repo public.
- See `LICENSE` for project licensing.

Next steps

- Review the codebase and supply new branding assets (logo, colors) in `public/` and `src/lib/branding.ts`.
- I recommend running a secret scan and then revoking any temporary PATs used during setup.
