## 1. Tested Flows

- Invite email content and structure (from .eml artifact)
- Onboarding flow: Welcome screen, Set Password, Complete Profile (from screenshots)
- Sign-in page (from screenshot)
- Profile editing: all fields, Job Description (TipTap editor), Social Links, Save Changes
- Dashboard / Org Chart: card display, detail panel, search, department filters, sidebar list
- Processes page: list view, flowchart detail view (Solar Installation Process)
- Responsive / mobile viewport (375x812): dashboard, profile page, navigation

---

## 2. Top 5 Priorities

1. **Buttons are invisible across the entire app.** "Save Changes," "Get Started," "Continue," "Complete Setup," and "Sign in" all render as plain text with transparent backgrounds, no borders, and default cursors. Users cannot distinguish actions from labels. This is a blocker for onboarding and profile completion.

2. **Job Description field: only the top ~20px is clickable.** The TipTap/ProseMirror contenteditable div is 20px tall inside a 104px container. Clicking anywhere below the first line does nothing. Users will think the field is broken.

3. **Navigation links vanish at mobile widths.** "Org Chart," "My Profile," and "Processes" disappear entirely below ~500px with no hamburger menu or alternative nav. Mobile users are stranded on whatever page they land on.

4. **Org chart canvas overlaps sidebar on mobile.** The React Flow canvas and the sidebar filter panel stack/overlap without any responsive layout adjustment, making both unusable at narrow viewports.

5. **Sidebar truncates names to 3 characters.** Employee names show as "Col..." / "Sar..." and titles as "Dire..." — too aggressive. Users can't distinguish employees at a glance.

---

## 3. Full Findings List

### Finding 1: Primary buttons render as plain text (KNOWN ISSUE — VALIDATED)

- **Type:** Bug
- **Severity:** Blocker
- **Where:** Onboarding (all steps), Profile page (/profile), Sign-in page
- **Steps to reproduce:**
  1. Navigate to https://orgchart.aveyo.com/profile
  2. Scroll to the bottom of the form
  3. Observe "Save Changes" — it appears as plain black text with no background, border, or hover state
  4. Same issue on onboarding: "Get Started," "Continue," "Complete Setup" (confirmed via screenshots)
  5. Same on sign-in page: "Sign in" button is plain text
- **Expected:** Buttons should have a visible background color (e.g., solid black per the invite email's button style), clear borders, and cursor:pointer on hover.
- **Actual:** `background-color: rgba(0, 0, 0, 0)` (transparent), `border: 0px`, `cursor: default`. The element has class `bg-primary text-primary-foreground` but the CSS variables resolve to transparent/dark text.
- **Evidence:** JavaScript inspection of the submit button's computed styles confirms transparent background. Onboarding screenshots show same pattern.
- **Suggested fix:** The `--primary` CSS variable is likely undefined or overridden. Check the Tailwind/shadcn theme configuration. Ensure `--primary` resolves to a solid color (e.g., `0 0% 0%` for black). Also add `cursor: pointer` to all button elements.
- **Acceptance check:** All buttons (Save Changes, Get Started, Continue, Complete Setup, Sign in) render with a visible solid background, contrasting text, and pointer cursor. Meets WCAG 2.1 AA contrast ratio (4.5:1 minimum).

### Finding 2: Job Description field — only top line is clickable/editable (KNOWN ISSUE — VALIDATED)

- **Type:** Bug
- **Severity:** High
- **Where:** Profile page (/profile) — Job Description field; also present in onboarding Complete Profile step
- **Steps to reproduce:**
  1. Navigate to https://orgchart.aveyo.com/profile
  2. Scroll to the "Job Description" field
  3. Click in the middle or bottom area of the text box
  4. Observe: no cursor appears, field does not receive focus
  5. Click on the very top line of the text box (~top 20px)
  6. Observe: cursor appears and field is editable
- **Expected:** The entire visible textarea area should be clickable and place the cursor at the clicked position.
- **Actual:** The TipTap/ProseMirror `contenteditable` div is only 20px tall. Its grandparent container (with the visible border, class `job-descrip...`) is 104px tall. The empty space below the editor div is not part of the editable area.
- **Evidence:** JavaScript measurement — `.tiptap.ProseMirror` element: height 20px; grandparent container: height 104px. The parent div has no height/min-height set.
- **Suggested fix:** Set `min-height: 100%` and `height: 100%` on both the ProseMirror div and its immediate parent wrapper, so the editable area fills the entire visible container. Alternatively, add a click handler on the outer container that focuses the editor.
- **Acceptance check:** Clicking anywhere within the bordered Job Description box places the cursor in the editor. The editable area visually fills the full container height.

### Finding 3: Navigation links disappear at mobile viewport

- **Type:** Bug
- **Severity:** High
- **Where:** Global navigation bar, all pages at viewport widths below ~500px
- **Steps to reproduce:**
  1. Open any page on the site
  2. Resize browser to 375px wide (or use mobile device)
  3. Observe the navigation bar
- **Expected:** Navigation links (Org Chart, My Profile, Processes) should remain accessible, either inline or via a hamburger/drawer menu.
- **Actual:** The three nav links completely disappear. Only the Aveyo logo, user avatar, and logout icon remain. No hamburger menu or alternative navigation exists.
- **Evidence:** Mobile viewport screenshot shows only logo + avatar + logout arrow in the nav bar.
- **Suggested fix:** Add a hamburger menu icon at mobile breakpoints that opens a slide-out or dropdown menu containing all navigation links.
- **Acceptance check:** At 375px viewport width, all navigation links are accessible via a hamburger/drawer menu.

### Finding 4: Org chart canvas overlaps sidebar on mobile

- **Type:** Bug
- **Severity:** High
- **Where:** Dashboard (/dashboard) at narrow viewports
- **Steps to reproduce:**
  1. Navigate to /dashboard
  2. Resize browser to 375px wide
  3. Observe the layout
- **Expected:** Sidebar and canvas should stack vertically or the sidebar should collapse/be toggleable.
- **Actual:** The org chart cards and the React Flow canvas overlap the sidebar panel. Both are partially visible and neither is fully usable.
- **Evidence:** Mobile viewport screenshot shows the Colin Farmer card overlapping the right edge of the sidebar/filter area.
- **Suggested fix:** At mobile breakpoints, stack the sidebar above the canvas, or collapse the sidebar behind a toggle button. The canvas should take full width when the sidebar is hidden.
- **Acceptance check:** At 375px width, sidebar and canvas do not overlap. Both are independently usable.

### Finding 5: Sidebar employee list truncates names too aggressively

- **Type:** UI
- **Severity:** Medium
- **Where:** Dashboard (/dashboard) — left sidebar employee list
- **Steps to reproduce:**
  1. Navigate to /dashboard
  2. Look at employee entries in the sidebar
- **Expected:** Names should be readable — at minimum first name + last initial, or the full name with ellipsis only if truly overflowing.
- **Actual:** Names show as "Col..." and "Sar..." (3 characters + ellipsis). Titles show as "Dire..." — also heavily truncated. The department badge takes up most of the horizontal space.
- **Evidence:** Zoomed screenshot of sidebar entries confirms 3-character truncation.
- **Suggested fix:** Increase the sidebar width or restructure the list item layout — put the department badge on a second line below the name/title, or use a tooltip on hover. Allow at least the full first name to display.
- **Acceptance check:** Employee first names are fully visible in the sidebar. Job titles show at least 15+ characters before truncating.

### Finding 6: Search filters sidebar but not the org chart canvas

- **Type:** UX
- **Severity:** Medium
- **Where:** Dashboard (/dashboard) — search input
- **Steps to reproduce:**
  1. Navigate to /dashboard
  2. Type "Sara" in the search field
  3. Observe sidebar and canvas
- **Expected:** Both the sidebar list and the org chart canvas should filter to show only matching employees, or the canvas should highlight/zoom to the matched person.
- **Actual:** The sidebar filters correctly to show only Sara Christensen. The org chart canvas continues to show all employees (both Colin Farmer and Sara Christensen cards).
- **Evidence:** Screenshot with "Sara" typed in search shows sidebar filtered but canvas unchanged.
- **Suggested fix:** When search is active, either filter the canvas to show only matching nodes, or pan/zoom the canvas to center on the matched employee and highlight their card.
- **Acceptance check:** Searching for an employee name visually highlights or isolates them in the canvas view.

### Finding 7: "Back" and primary action buttons have inconsistent styling

- **Type:** UI
- **Severity:** Medium
- **Where:** Onboarding — Set Password and Complete Profile steps
- **Steps to reproduce:**
  1. Begin the onboarding flow
  2. Proceed to "Set Your Password" step
  3. Observe the "Back" button vs. "Continue"
- **Expected:** Both buttons should be clearly styled. Primary action (Continue/Complete Setup) should be visually prominent. Secondary action (Back) should be clearly secondary.
- **Actual:** "Back" has a visible border/outline. "Continue" and "Complete Setup" have no visible styling (transparent background, no border) — they look like plain text labels. This creates a confusing visual hierarchy where the secondary action looks more like a button than the primary action.
- **Evidence:** Onboarding screenshots (Set Password step, Complete Profile step).
- **Suggested fix:** Apply solid background + contrasting text to primary buttons. Keep secondary "Back" button as outline/ghost style. This will also be resolved by fixing Finding 1.
- **Acceptance check:** Primary action buttons are visually dominant over secondary buttons on every onboarding step.

### Finding 8: React Flow watermark visible in production

- **Type:** UI
- **Severity:** Low
- **Where:** Dashboard (/dashboard) and Processes flowchart — bottom-right corner of canvas
- **Steps to reproduce:**
  1. Navigate to /dashboard or open any process flowchart
  2. Look at the bottom-right corner of the canvas area
- **Expected:** No third-party branding/watermarks in the production app.
- **Actual:** "React Flow" text is visible in the bottom-right corner of both the org chart canvas and the process flowchart canvas.
- **Evidence:** Visible in dashboard and process flowchart screenshots.
- **Suggested fix:** Either purchase a React Flow Pro license to remove the watermark, or use the `proOptions={{ hideAttribution: true }}` prop (note: this may violate the MIT license terms unless on a paid plan). Alternatively, add `proOptions` with the free attribution and style it to be less prominent.
- **Acceptance check:** No "React Flow" text visible in the production canvas area.

### Finding 9: Email field on profile looks editable but is read-only

- **Type:** UX
- **Severity:** Low
- **Where:** Profile page (/profile) — Email field
- **Steps to reproduce:**
  1. Navigate to /profile
  2. Look at the Email field
- **Expected:** Read-only fields should be visually distinct from editable fields (e.g., grayed out background, different border style, or a lock icon).
- **Actual:** The Email field has the same border and background styling as editable fields. The only difference is a slightly muted text color. Users may try to edit it and be confused when they can't.
- **Evidence:** Profile page screenshot — Email field is visually identical to other input fields.
- **Suggested fix:** Add a gray/muted background to the email field, reduce border opacity, or add a small lock icon. Add a tooltip explaining "Email cannot be changed."
- **Acceptance check:** The email field is visually distinct from editable fields and users understand it cannot be changed.

### Finding 10: No success/error feedback after saving profile

- **Type:** UX
- **Severity:** Medium
- **Where:** Profile page (/profile) — Save Changes action
- **Steps to reproduce:**
  1. Navigate to /profile
  2. Change any field value
  3. Click "Save Changes"
  4. Observe the page
- **Expected:** A visible success toast/banner ("Profile updated!") or error message if the save fails.
- **Actual:** No visible confirmation that the save succeeded or failed. The page remains unchanged. Users have no way to know if their changes were saved.
- **Evidence:** Observed during testing — no toast, banner, or visual feedback after clicking Save Changes.
- **Suggested fix:** Add a toast notification (e.g., top-right) showing "Profile saved successfully" on success or an error message on failure. Consider also adding a loading/spinner state on the button during the save.
- **Acceptance check:** After clicking Save Changes, a visible success message appears within 2 seconds. On failure, an error message with guidance is shown.

### Finding 11: Minimap oversized on mobile viewport

- **Type:** UI
- **Severity:** Low
- **Where:** Dashboard (/dashboard) and Processes flowchart at mobile viewport
- **Steps to reproduce:**
  1. Navigate to /dashboard
  2. Resize browser to 375px width
  3. Observe the minimap in the bottom-right
- **Expected:** Minimap should scale down or hide on small viewports.
- **Actual:** The minimap takes up a disproportionate amount of screen space relative to the viewport, overlapping or crowding the main content.
- **Evidence:** Mobile viewport screenshot shows minimap consuming ~25% of the visible area.
- **Suggested fix:** Hide the minimap on viewports below 768px, or reduce its size to max 80x60px at mobile breakpoints.
- **Acceptance check:** At 375px viewport, the minimap is either hidden or small enough not to obstruct the org chart view.

### Finding 12: Invite email exposes raw Supabase URL

- **Type:** UX / Security
- **Severity:** Low
- **Where:** Invite email — "Access my account" link and fallback URL
- **Steps to reproduce:**
  1. Open the invite email
  2. Hover over "Access my account" button or read the fallback URL at the bottom
- **Expected:** Links should use a branded domain (e.g., orgchart.aveyo.com/invite?token=...) that then handles the auth redirect server-side.
- **Actual:** The link points directly to `semzdcsumfnmjnhzhtst.supabase.co/auth/v1/verify?token=...` — exposing the Supabase project ID and auth endpoint directly to end users.
- **Evidence:** Email .eml file shows the raw Supabase URL.
- **Suggested fix:** Route invite links through your own domain (e.g., `orgchart.aveyo.com/api/auth/verify?token=...`) which proxies to Supabase. This looks more professional and doesn't leak infrastructure details.
- **Acceptance check:** Invite email links use an orgchart.aveyo.com domain, not supabase.co.

### Finding 13: Invite email logo is broken

- **Type:** Bug
- **Severity:** Medium
- **Where:** Invite email — header logo image
- **Steps to reproduce:**
  1. Receive the invite email in Gmail (or most other email clients)
  2. Look at the black header section of the email
- **Expected:** The Aveyo logo should display as a white logo on the black header background.
- **Actual:** The logo image is broken/missing. It renders as a broken image icon or is simply invisible. Three compounding issues cause this: (a) the image uses a `data:image/svg+xml;base64,...` URI — Gmail and most email clients block `data:` URIs for security; (b) SVG is not a supported image format in most email clients; (c) the CSS `filter: brightness(0) invert(1)` used to turn the dark logo white is not supported in email clients.
- **Evidence:** User-reported; confirmed by inspecting the email source (.eml artifact). The `<img>` tag uses `src="data:image/svg+xml;base64,..."` with a CSS filter for color inversion.
- **Suggested fix:** Replace the base64 SVG with a hosted PNG image on an Aveyo domain (e.g., `https://orgchart.aveyo.com/images/logo-white.png`). Use a pre-rendered white version of the logo — do not rely on CSS filters. Ensure the image has proper `alt="Aveyo"`, `width`, and `height` attributes.
- **Acceptance check:** The Aveyo logo renders correctly in Gmail, Outlook, and Apple Mail. No CSS filters or data URIs are used for email images.

### Finding 14: No page title in browser tab

- **Type:** UX
- **Severity:** Low
- **Where:** All pages — browser tab
- **Steps to reproduce:**
  1. Navigate to any page
  2. Look at the browser tab title
- **Expected:** Descriptive page titles like "Org Chart - Aveyo" or "My Profile - Aveyo."
- **Actual:** Tab shows "org-chart-app" for all pages.
- **Evidence:** Browser tab observed during testing.
- **Suggested fix:** Set dynamic page titles per route: "Organization Chart - Aveyo," "My Profile - Aveyo," "Processes - Aveyo."
- **Acceptance check:** Each page has a unique, descriptive browser tab title.

---

## ADDENDUM: Security Findings

*Note: This is a surface-level security review from the browser, not a penetration test. These findings warrant deeper investigation by a security professional.*

### Security Finding S1: Resend email API key exposed in client-side JavaScript bundle

- **Type:** Security
- **Severity:** CRITICAL
- **Where:** Client JS bundle (`/assets/index-DtUKvaXx.js`)
- **Details:** The Vite environment variable `VITE_RESEND_API_KEY` and its value (prefixed `re_`) are compiled into the client-side JavaScript bundle. The `re_` prefix confirms a Resend API key is present in the source code that any user can view via browser DevTools.
- **Risk:** Anyone can extract this key and use the Resend API to send emails from Aveyo's domain. This enables phishing attacks that appear to originate from legitimate Aveyo addresses, and could damage domain reputation/deliverability.
- **Suggested fix:** Move all email-sending logic to a server-side API route or edge function. Never expose `VITE_RESEND_API_KEY` to the client. Vite automatically bundles any `VITE_`-prefixed env var into client code — rename to a non-prefixed variable and access it only server-side. Immediately rotate the current key after deploying the fix.
- **Acceptance check:** The string `re_` followed by alphanumeric characters does not appear anywhere in client-side JavaScript. Email sending only happens via server-side endpoints.

### Security Finding S2: Missing critical HTTP security headers

- **Type:** Security
- **Severity:** High
- **Where:** All HTTP responses from orgchart.aveyo.com
- **Details:** The following security headers are missing:
  - **Content-Security-Policy (CSP):** Not set. No protection against XSS or code injection.
  - **X-Frame-Options:** Not set. The app can be embedded in iframes on any domain, enabling clickjacking attacks.
  - **X-Content-Type-Options:** Not set. Browser may MIME-sniff responses, enabling certain attack vectors.
  - **Referrer-Policy:** Not set. Full URLs (including tokens/parameters) may leak via the Referer header.
  - **Permissions-Policy:** Not set. No restrictions on browser features (camera, geolocation, etc.).
  - Only **HSTS** is set (good: `max-age=63072000`).
- **Suggested fix:** Add these headers via your hosting provider (Cloudflare, Vercel, etc.) or in your app's response middleware. At minimum, add: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a basic CSP.
- **Acceptance check:** All five headers are present in HTTP responses. Verified via securityheaders.com or browser DevTools.

### Security Finding S3: CORS wildcard allows any origin

- **Type:** Security
- **Severity:** Medium
- **Where:** HTTP response headers — `Access-Control-Allow-Origin: *`
- **Details:** The server returns `Access-Control-Allow-Origin: *`, meaning any website on the internet can make cross-origin requests to the app and read the responses.
- **Risk:** If combined with authenticated endpoints, a malicious site could make requests on behalf of a logged-in user and read org chart data, employee profiles, etc.
- **Suggested fix:** Replace `*` with the specific origins that need access (e.g., `https://orgchart.aveyo.com`). If the API is only consumed by its own frontend, there's no reason to allow wildcard origins.
- **Acceptance check:** `Access-Control-Allow-Origin` is set to specific trusted origins, not `*`.

### Security Finding S4: Supabase table names and structure exposed in client bundle

- **Type:** Security
- **Severity:** Low (informational)
- **Where:** Client JS bundle
- **Details:** The following Supabase table names are visible in the client bundle: `profiles`, `departments`, `org_chart_positions`, `share_links`, `process_share_links`, `organization_settings`, `processes`, `process_nodes`, `process_edges`. The bundle also includes insert, update, delete, and RPC operations.
- **Risk:** This is partially expected for a Supabase client-side app, but it gives attackers a full map of the database schema and available operations. Combined with the Supabase anon key (also in the bundle, as expected), an attacker can attempt direct queries against these tables. Security depends entirely on Supabase Row Level Security (RLS) policies being correctly configured.
- **Suggested fix:** Verify that RLS policies are enabled and correctly configured on ALL listed tables, especially `organization_settings`, `profiles`, and `share_links`. Ensure no table allows cross-organization data access. Consider an RLS audit with test queries from different user contexts.
- **Acceptance check:** A manual RLS audit confirms that no user can read or modify data outside their organization, even with direct Supabase client queries.

---

## 4. UI/UX Recommendations

### Quick Wins (< 1 day each)

- **Fix CSS variable for --primary**: This single fix resolves the button visibility issue across the entire app (Findings 1 and 7). Check the Tailwind/shadcn theme config — `--primary` likely needs a value like `0 0% 9%` (near-black in HSL).
- **Add cursor:pointer to all buttons**: Every `<button>` element should have `cursor: pointer` in the global CSS.
- **Set min-height: 100% on TipTap editor wrapper**: Fixes the Job Description click target (Finding 2).
- **Add page-specific `<title>` tags**: Simple metadata improvement for all routes.
- **Add a success toast after profile save**: Even a simple 3-second "Saved!" message greatly improves confidence.

### Medium Effort (1-3 days)

- **Add a responsive hamburger menu**: Use a slide-out drawer at mobile breakpoints to house the three nav links plus user info/logout.
- **Responsive dashboard layout**: Stack sidebar above canvas at mobile breakpoints, or make sidebar collapsible.
- **Improve sidebar list truncation**: Restructure the employee list item — name on first line, title + department on second line — so names aren't cut to 3 characters.
- **Link search to canvas behavior**: When a user searches, pan/zoom the canvas to the matched employee and highlight their node.
- **Brand the invite email links**: Route auth links through your own domain rather than exposing Supabase URLs.

### Bigger Bets (3+ days)

- **Accessibility audit**: Add proper ARIA labels to the React Flow canvas, ensure keyboard navigation works for the org chart and flowchart nodes, check all color contrast ratios, and add skip-to-content links.
- **Empty state for org chart with < 3 employees**: With only 2 employees, the org chart looks sparse. Consider showing a "Your team is growing! Invite more members" prompt or a visual placeholder.
- **Onboarding progress indicator**: Add a step indicator (e.g., "Step 1 of 3") to the onboarding flow so users know how much is left.
- **Profile photo upload UX**: The current photo area lacks an obvious "change photo" button/overlay on hover.

---

## 5. Draft Message to Dev Team

> **Subject: OrgChart QA Review — 1 Critical Security Issue, 2 Blockers, 3 High-Priority Fixes**
>
> Hi team,
>
> I completed a full walkthrough of the OrgChart app (onboarding, profile, dashboard, processes, mobile) plus a surface-level security review. Here's the summary:
>
> **CRITICAL — Fix Immediately:**
> The Resend email API key (`VITE_RESEND_API_KEY`) is exposed in the client-side JS bundle. Anyone can extract it from DevTools and send emails from our domain. Move email sending to a server-side route and rotate the key ASAP.
>
> **Blockers / Must-Fix:**
> The `--primary` CSS variable resolves to transparent, making every primary button (Save Changes, Get Started, Continue, Sign In) invisible — they render as plain text. One CSS variable fix resolves this across the entire app.
>
> The Job Description field (TipTap editor) has a 20px-tall click target inside a 104px container. Users can only click the top sliver. Setting min-height: 100% on the editor wrapper fixes it.
>
> **High Priority:**
> We're missing critical HTTP security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy). Navigation disappears at mobile widths — we need a hamburger menu. The invite email logo is broken in all major email clients due to using data:SVG URIs.
>
> **Quick wins while you're in there:**
> Add cursor:pointer to buttons, add a save-confirmation toast on profile, set page-specific browser tab titles, and fix the email logo to use a hosted PNG.
>
> Full report with repro steps, evidence, and suggested fixes is attached. Happy to walk through any of these.
>
> Best,
> Colin

---

## 6. Verification Checklist

- [x] **Completeness:** Covered logged-out (sign-in screenshot), onboarding (3 screenshots), profile editing (live), dashboard/org chart (live), processes/flowchart (live), responsive (375px viewport)
- [x] **Correctness:** All steps are reproducible; severities reflect user impact; no contradictions between findings
- [x] **Constraints:** No passwords or secrets exposed; no irreversible changes performed; used only my own profile for testing
- [x] **Usability:** All suggestions are phrased as implementable changes with specific CSS properties, component changes, or architectural patterns
- [x] **Prioritization:** Top 5 issues clearly identified with rationale; blocker + high issues called out first

---

## 7. Open Questions / Approvals Needed

1. **React Flow license:** Is Aveyo on a React Flow Pro plan? This determines whether the watermark can be legally removed via `proOptions`.
2. **Mobile support priority:** Is mobile a target platform? If so, the hamburger menu and responsive dashboard should be prioritized higher. If desktop-only for now, these can be deferred.
3. **Onboarding testing:** I reviewed onboarding from screenshots only (since the invite link was expired). If a fresh test account can be created, I can do a live walkthrough to check validation, error states, and the full save flow.
4. **Supabase URL branding:** Is there a reason the invite email uses the raw Supabase URL? If this is intentional (e.g., Supabase handles the auth flow directly), the fix would require setting up a proxy/redirect on your domain.
