# Client Portal — Human QA Script

Run this locally (`npm run dev`) before trusting the client portal with a real client. No code reading required. Check off each line as you go; anything that doesn't match "expected" is a bug, not a nitpick.

## Setup

1. In the CRM, open a client that has an email on file. If it doesn't have one, add one first — portal login needs it.
2. On that client's page, find "Client Portal Access" and click "Enable portal login." Copy the password shown — it's only shown once.
3. Create a second client with a different email, for the isolation checks below.

## Auth

- [ ] Go to `/client/login`. Log in with the email + password from setup. **Expected:** lands on `/client/dashboard`, greets you by the client's name.
- [ ] Log out. **Expected:** back at `/client/login`, and re-visiting `/client/dashboard` directly redirects you to login (no access without a session).
- [ ] Try logging in with the right email and a wrong password. **Expected:** generic "Incorrect email or password" — not a hint about which part was wrong.
- [ ] Try logging in with an email that doesn't exist. **Expected:** same generic error.
- [ ] Log in as client A. In a different browser (or incognito window), log in as client B. **Expected:** each sees only their own videos — client A's projects never appear for client B, and vice versa.
- [ ] Back in the CRM, click "Revoke" on client A's portal access. **Expected:** client A's already-open dashboard session stops working on the next page load/refresh — they're kicked back to login, not left with lingering access.
- [ ] Go to `/client/reset`, submit client A's email. **Expected:** generic "if that email has access, we've sent instructions" message either way — try it once with a real client email and once with a made-up one, the message should look identical both times. In dev, a direct reset link is also shown — use it to set a new password, then confirm you can log in with the new one.

## Dashboard

- [ ] For a client with zero videos: dashboard shows one friendly "no videos yet" message, not a grid of empty sections.
- [ ] For a client with videos in different states: totals (active projects / in production / ready for review / completed) match what's actually in the CRM for that client.
- [ ] Mark a video `READY_FOR_REVIEW` in the CRM. **Expected:** it now appears under "Needs your attention" on the client's dashboard, with Approve / Request changes buttons.
- [ ] Click Approve. **Expected:** video moves to Delivered/DONE, disappears from "needs attention," appears under "Recent deliveries." Check the CRM activity log for that client — the event should show as client-initiated, not attributed to you.
- [ ] Mark another video `READY_FOR_REVIEW`, click "Request changes" instead. **Expected:** video returns to an in-progress-style state and shows up under "Current work," not "Recent deliveries."
- [ ] Complete a video today. **Expected:** "N completed this week" banner appears and the count is right. Then reopen that same video (`CHANGES_REQUESTED`). **Expected:** the "this week" count drops — a video currently back in production should not still be claimed as completed.

## Visual

- [ ] Give one video a cover image and set orientation to Landscape. **Expected:** wide thumbnail, no stretching or cropping that cuts off the subject badly.
- [ ] Give another video a cover image and set orientation to Vertical. **Expected:** a tall-but-bounded thumbnail — it should not blow up the card to nearly full screen height on mobile.
- [ ] Leave one video with no cover image at all. **Expected:** a clean placeholder, never a broken-image icon or blank box.
- [ ] Give a video a very long title. **Expected:** it truncates cleanly on the card, doesn't break the layout.
- [ ] Open the dashboard on your phone (or narrow the browser window to phone width). **Expected:** everything is readable, buttons are easy to tap, nothing requires horizontal scrolling.
- [ ] Open it on a tablet-width window, then full desktop width. **Expected:** the card grid adds columns as the screen grows; nothing looks stretched or cramped at any size.

## Privacy

- [ ] With the client portal open, search the rendered page for anything that shouldn't be there: work session hours, internal notes, revenue figures, health data, another client's name. **Expected:** none of it appears anywhere, including in page source/dev tools network tab.
- [ ] Confirm the client's own internal CRM notes (`qualificationNotes`, `notes`) never show up on their dashboard.

## Sign-off

If every box above is checked and matches "expected," the portal is ready to hand to a real client. If anything didn't match, note exactly which line failed and what you saw instead — that's specific enough to hand back for a fix.
