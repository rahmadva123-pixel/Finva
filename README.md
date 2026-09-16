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
 - Firebase/auth integrations were temporarily stubbed. To re-enable Firebase, add the environment variables below (do NOT commit keys).

Environment variables required
- Server (admin) secrets — store in Vercel/GitHub Secrets, **do not commit**:
	- `FIREBASE_ADMIN_PROJECT_ID`
	- `FIREBASE_ADMIN_CLIENT_EMAIL`
	- `FIREBASE_ADMIN_PRIVATE_KEY` (PEM; paste full multi-line PEM in Vercel UI or escape newlines as `\n` if necessary)

- Client (public) keys — safe to expose only in client config but do not commit private keys:
	- `NEXT_PUBLIC_FIREBASE_API_KEY`
	- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
	- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
	- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (optional)
	- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` (optional)
	- `NEXT_PUBLIC_FIREBASE_APP_ID` (optional)

I will prepare the code to read these values from the environment and initialize Firebase when they are present. After you add the secrets to your hosting provider, tell me and I'll finish the revert and test the auth flows.
- Build artifacts (`.next`) are excluded from the repository. Ensure no local secrets remain before making the repo public.
- See `LICENSE` for project licensing.

Next steps

- Review the codebase and supply new branding assets (logo, colors) in `public/` and `src/lib/branding.ts`.
- I recommend running a secret scan and then revoking any temporary PATs used during setup.
