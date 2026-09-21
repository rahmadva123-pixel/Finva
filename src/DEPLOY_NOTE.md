# Vercel deployment checklist

Set the Vercel Project **Root Directory** to `source-code-fixed` before deploying.

## Required environment variables
Add these in **Vercel → Project Settings → Environment Variables**:

- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY`
- `RESEND_FROM`
- `GEMINI_API_KEY` *(optional; only needed for AI recommendations)*

## Important notes
- Do **not** store secrets in `vercel.json`.
- Store the Firebase private key securely (e.g., Vercel UI or a secrets manager). Do NOT commit private keys or service-account JSON files to the repository.
- The app already normalizes wrapped quotes and `\\n` line breaks for Vercel.

## Firebase setup
In **Firebase Console → Authentication → Settings → Authorized domains**, add:

- your `*.vercel.app` domain
- your custom production domain (if you have one)

## Deploy
After saving the environment variables, trigger a fresh redeploy in Vercel.