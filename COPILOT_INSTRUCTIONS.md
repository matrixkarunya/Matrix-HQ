# Matrix Web App: Step 1 Build Instructions

You are building step 1 of "Matrix", a web app for managing an organisation's board. This step covers **Google login, role-based access, and a superadmin screen to manage users**. Nothing else. Follow this document exactly. Where something is not specified, choose the simplest option and do not add extra features.

## 1. Tech stack

- Next.js (App Router, JavaScript, not TypeScript)
- Tailwind CSS for styling
- Firebase Authentication (Google provider only)
- Cloud Firestore (database)
- No other libraries. Do not add a UI kit, state library or form library.

Project setup: `create-next-app` with JavaScript, Tailwind, App Router, **no `src/` directory**, import alias `@/*`. Then `npm install firebase`.

## 2. Roles

| Role | Count | Can do in step 1 |
|---|---|---|
| `superadmin` | exactly 1 | Sees the superadmin dashboard, manages users |
| `admin` | many | Sees a dummy admin page |
| `member` | many | Sees a dummy member page |
| `guest` | many | Sees a dummy guest page |

Rules:
- Roles are stored in Firestore, never in code or in security rules.
- The superadmin is created **once, by hand, in the Firebase console** (seeding). The app must never be able to create, edit or delete a superadmin.
- The superadmin can assign only `admin`, `member` or `guest` to other users.

## 3. Data model

One collection: `users`.

- **Document ID:** the user's email, **lowercase** (example: `name@gmail.com`).
- **Fields:**
  - `email` (string, lowercase, same as the document ID)
  - `role` (string: `superadmin` | `admin` | `member` | `guest`)
  - `addedAt` (server timestamp; not present on the seeded superadmin)

Always lowercase and trim emails before reading or writing.

## 4. Authentication flow

1. The user opens the site and is sent to `/login` if not signed in.
2. They click **Continue with Google**. Use `signInWithPopup` with `GoogleAuthProvider`, with `prompt: "select_account"`.
3. After sign-in, take the Google email (lowercased) and read `users/{email}` from Firestore.
4. If the document **exists**: store the user and their `role`, then redirect to the role's home page.
5. If it does **not exist**: sign the user out immediately and show on the login page: `"<email> has not been given access. Ask the superadmin to add you."`
6. If the read fails for any other reason: sign out and show `"Could not check your access. Try again."`
7. If the user closes the Google popup (`auth/popup-closed-by-user`), show no error.

Role-to-route mapping:

| Role | Home route |
|---|---|
| superadmin | `/superadmin` |
| admin | `/admin` |
| member | `/member` |
| guest | `/guest` |

## 5. Pages

### `/` (root)
Shows "Loading…" while auth is resolving. Then redirects: signed in with a role goes to that role's home route; otherwise goes to `/login`.

### `/login`
- Title: "Sign in to Matrix"
- One line of help text: "Use the Google account the superadmin added."
- One button: **Continue with Google**. While loading, the button is disabled and reads "Checking…".
- Shows the error message from section 4 when there is one.
- If the user is already signed in with a role, redirect to their home route.

### `/superadmin` (superadmin only)
- Heading "Superadmin dashboard", the signed-in email under it, and a **Sign out** button.
- One card/button: **Manage users** (subtitle: "Add people and set their role") linking to `/superadmin/users`.

### `/superadmin/users` (superadmin only)
- "Back to dashboard" link to `/superadmin`.
- Heading "Manage users" and an **Add new user** button at the top right.
- A table with exactly two columns: **Email** and **Role**. It lists every document in `users` (including the superadmin), sorted by email, and updates live using `onSnapshot`.
- Empty state text when there are no users: "No users yet. Add the first one with the button above."
- Clicking **Add new user** opens a modal (centered card over a dark overlay, `role="dialog"`, `aria-modal="true"`) containing:
  - Email input (type email, placeholder `name@gmail.com`, autofocus)
  - Role dropdown with options `admin`, `member`, `guest` (default `member`)
  - **Cancel** and **Add** buttons
- On **Add**:
  - Trim and lowercase the email.
  - If it is not a valid email: show "Enter a valid email address." in the modal.
  - If that email already belongs to the superadmin: show "This is the superadmin account."
  - Otherwise write `users/{email}` with `{ email, role, addedAt: serverTimestamp() }` using `setDoc`. (If the email already exists with another role, this updates its role.)
  - On success: close the modal, clear the form, and show a small toast "User added" for about 2.5 seconds. Stay on the same page. The table updates automatically.
  - On failure: show "Could not add the user. Try again." inside the modal.
  - While saving, the Add button is disabled and reads "Adding…".
- All of this happens on this one page. No page navigation for adding a user.

### `/admin`, `/member`, `/guest`
Dummy pages. Each shows a heading "Hi Admin" / "Hi Member" / "Hi Guest", the text "Signed in as <email>", and a **Sign out** button. Each page is accessible only to its own role. Build them from one shared `RolePortal` component that takes `role` and `label` props.

## 6. Access control in the app

Create a `RoleGuard` client component: `<RoleGuard allow={["admin"]}>...</RoleGuard>`.

- While auth is loading, or the user is not allowed yet: render "Loading…" and nothing else.
- Not signed in: redirect to `/login`.
- Signed in but the role is not in `allow`: redirect to that user's own home route.
- Otherwise render the children.

Wrap every protected page in `RoleGuard`. A guest typing `/superadmin` in the address bar must end up on `/guest`.

Create an `AuthContext` (client component, `AuthProvider` + `useAuth()` hook) exposing: `user`, `role`, `loading`, `error`, `loginWithGoogle()`, `logout()`. Use `onAuthStateChanged` to keep it in sync. Wrap the app in `AuthProvider` in `app/layout.js`.

## 7. File structure

```
app/
  layout.js                     AuthProvider wrapper, imports globals.css
  page.js                       root redirect
  login/page.js
  superadmin/page.js
  superadmin/users/page.js
  admin/page.js
  member/page.js
  guest/page.js
components/
  RoleGuard.js
  RolePortal.js
context/
  AuthContext.js
lib/
  firebase.js                   initialises app, exports auth, db, googleProvider
  config.js                     ASSIGNABLE_ROLES = ["admin","member","guest"]; ROLE_HOME map
firestore.rules
.env.local.example
SETUP.md
```

All files that use hooks start with `"use client";`.

`lib/firebase.js` must reuse an existing app (`getApps().length ? getApp() : initializeApp(...)`) so hot reload does not break it. Read config from `NEXT_PUBLIC_FIREBASE_*` environment variables:

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

Do not commit `.env.local`. Add it to `.gitignore` (create-next-app already does this).

## 8. Firestore security rules (`firestore.rules`)

Use these rules as written. The superadmin is identified by their `users` document, **not by a hardcoded email**.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSuperadmin() {
      return request.auth != null
        && request.auth.token.email_verified == true
        && get(/databases/$(database)/documents/users/$(request.auth.token.email)).data.role == 'superadmin';
    }

    match /users/{email} {
      allow read: if request.auth != null
        && (request.auth.token.email == email || isSuperadmin());

      allow create, update: if isSuperadmin()
        && request.resource.data.role in ['admin', 'member', 'guest']
        && (resource == null || resource.data.role != 'superadmin');

      allow delete: if isSuperadmin() && resource.data.role != 'superadmin';
    }
  }
}
```

What this guarantees: everyone can read only their own record; only the superadmin can read all records or write any; the app can never create a second superadmin or modify/delete the existing one.

## 9. Manual setup (the developer does this, not Copilot)

Write these steps into `SETUP.md`:

1. Create a Firebase project and add a Web app. Copy its config into `.env.local`.
2. Authentication → Sign-in method → enable **Google**.
3. Create a Firestore database.
4. Paste `firestore.rules` into the Rules tab and publish.
5. **Seed the superadmin (one time):** Firestore → Start collection `users` → Document ID = the superadmin's Google email in lowercase → fields `email` (string, same email) and `role` (string, `superadmin`).
6. Authentication → Settings → Authorized domains: `localhost` is included by default. Add the production domain when deploying.
7. `npm run dev` and open `http://localhost:3000`.

## 10. UI guidelines

- Keep the design plain and clean: white background, black primary buttons, thin borders, rounded corners, readable text sizes. Tailwind utility classes only.
- Use plain, specific wording on buttons and messages (for example "Add new user", "User added", not "Submit").
- Errors say what went wrong and what to do next.
- Must work on mobile widths. Modal should fit small screens (`w-full max-w-sm`, with padding on the overlay).
- Labels linked to inputs (`htmlFor` / `id`), visible keyboard focus, buttons are real `<button>` elements.

## 11. Acceptance checklist

Verify each of these before finishing:

- [ ] Signing in with the seeded superadmin Google account lands on `/superadmin`.
- [ ] **Manage users** opens `/superadmin/users` and shows a table with Email and Role columns, including the superadmin row.
- [ ] **Add new user** opens the modal; adding a valid email with a role closes the modal, shows "User added", and the new row appears in the table without a refresh.
- [ ] Invalid email shows "Enter a valid email address."; the superadmin's email shows "This is the superadmin account."
- [ ] The role dropdown offers only admin, member, guest.
- [ ] A user added as admin lands on `/admin` showing "Hi Admin"; same for member and guest.
- [ ] A Google account that is not in `users` is signed out and sees the "has not been given access" message.
- [ ] A signed-out visitor opening any protected route is redirected to `/login`.
- [ ] An admin/member/guest opening `/superadmin` or `/superadmin/users` is redirected to their own home page.
- [ ] Sign out returns to `/login`.
- [ ] No email address appears anywhere in the code or in `firestore.rules`.
- [ ] No console errors on normal use; no redirect loops.

## 12. Out of scope for step 1 (do not build)

Board member profiles, attendance, events, todo/task tracking, editing or deleting users from the UI, email invitations, password login, Firebase Admin SDK, API routes, analytics. These come in later steps, so keep the code organised (routes per role, shared components) so they can be added without rewrites.
