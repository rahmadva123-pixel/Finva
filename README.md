Finva

Finva is a Next.js application using Firebase Authentication, Firestore, and Firebase Admin APIs.

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

Environment variables

Copy `.env.example` to `.env.local` for local development. Never commit `.env.local`, service-account JSON files, or private keys.

Production server variables:

- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`
- `RESEND_API_KEY` and `RESEND_FROM` for action emails

Production client variables:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_APP_URL`

Optional variables:

- `GEMINI_API_KEY` for AI recommendations
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, and `FROM_EMAIL` for email-change mail delivery

Deployment

For Vercel, set the project root directory to `source-code-fixed`, add the variables above to the required environments, and use:

```bash
npm install
npm run build
```

Then deploy with Vercel. Add the deployed domain to Firebase Authentication authorized domains and verify Firestore rules/indexes before enabling production traffic.

Build artifacts and secrets are excluded from the repository. See `src/DEPLOY_NOTE.md` for the short Vercel checklist.

Next steps

- Review the codebase and supply new branding assets (logo, colors) in `public/` and `src/lib/branding.ts`.
- I recommend running a secret scan and then revoking any temporary PATs used during setup.
