# Gym Management Client

The client is a React/Vite application using standard CSS and Firebase's
browser SDK.

## Environment

Copy `.env.example` to `.env` and provide the Firebase web app configuration:

| Variable | Firebase console value |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Web app ID |

These `VITE_` values are public Firebase web configuration and are safe to
ship in the browser bundle. Firebase Admin credentials and other private
integration secrets belong only in the server environment.

The authentication screens use Firebase email/password methods. New accounts
receive a verification email and are signed out until verification is
complete; login rejects unverified accounts. Public registration creates a
member identity only and does not accept a role from the browser.

## Commands

```bash
npm run dev
npm run lint
npm test
npm run build
```
