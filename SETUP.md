# Matrix setup

1. Create a Firebase project and add a Web app. Copy its config into `.env.local`.
2. Authentication → Sign-in method → enable **Google**.
3. Create a Firestore database.
4. Paste `firestore.rules` into the Rules tab and publish.
5. **Seed the superadmin (one time):** Firestore → Start collection `users` → Document ID = the superadmin's Google email in lowercase → fields `email` (string, same email) and `role` (string, `superadmin`).
6. Authentication → Settings → Authorized domains: `localhost` is included by default. Add the production domain when deploying.
7. `npm run dev` and open `http://localhost:3000`.

## Existing event ownership backfill

New events store `createdBy` from the authenticated creator and the client cannot choose a different owner. Before publishing the new rules, update every existing event document once in Firestore by setting `createdBy` to the seeded superadmin's lowercased email. This is the sensible default for legacy data; after the backfill, admins can only manage events they create themselves.

## Completion workflow

Members use `/member/todo` and `/member/attendance`. Staff review requests at `/admin/requests` or `/superadmin/requests`. Publish the updated `firestore.rules` before testing so member assignment and event ownership checks are enforced server-side.

## Completion workflow manual test checklist

- Member submits a task or subtask request; the event creator sees it and approves it; the requester sees the completed tick.
- Member submits a request; the superadmin sees and approves it; the requester sees the completed tick and reviewer name.
- Admin submits on another admin's assigned event; the event creator and superadmin can review it.
- Admin submits on their own event; the admin cannot approve or reject it, and only the superadmin can decide it.
- Superadmin completing an assigned task completes it directly without creating an approval request.
- Clicking Completed and then Cancel, clicking the backdrop, or pressing Escape sends nothing.
- A second pending request for the same task/subtask is blocked; a rejected request can be submitted again.
- Approving all subtasks auto-completes the parent task; a parent task has its own independent request button.
- After either reviewer approves or rejects, the other reviewer cannot change the locked request.
