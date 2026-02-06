

# Legal Pages Implementation — Final Plan

## Overview

Create Privacy Policy, Terms of Service, and Cookie Policy pages for Common Groundz, an India-based AI-powered recommendation and discovery platform.

---

## Files

### New (4)
- `src/config/legalConfig.ts` — Centralized legal metadata
- `src/pages/PrivacyPolicy.tsx` — Privacy policy page
- `src/pages/TermsOfService.tsx` — Terms of service page
- `src/pages/CookiePolicy.tsx` — Cookie policy page

### Modified (3)
- `src/App.tsx` — Add 3 public routes
- `src/components/Footer.tsx` — Replace placeholder `#` links with Router Links
- `public/_redirects` — Add 3 route entries

---

## Legal Config

`src/config/legalConfig.ts`:
- companyName: "Common Groundz"
- supportEmail: "support@commongroundz.co"
- websiteUrl: "https://commongroundz.co"
- jurisdiction: "India"
- lastUpdated: "February 6, 2026"

---

## Privacy Policy Sections

1. **Introduction**
2. **Information We Collect** — Account info (Google OAuth), user content, AI-learned preferences, usage data
3. **Automated Processing and AI** — "Recommendations are generated using automated systems and may be based on user-submitted content and behavioral data. We do not guarantee that recommendations will be accurate, complete, or suitable for any specific purpose. These should not be considered professional, medical, legal, or financial advice."
4. **How We Use Your Information**
5. **Data Sharing** — "We do not sell your personal data. We use third-party infrastructure providers such as cloud hosting, database services, and authentication services to operate the platform."
6. **Data Security** — "We implement reasonable technical and organizational measures to protect user data."
7. **Your Rights** — Access (/your-data), delete (settings), export, contact support
8. **Data Retention** — "We retain account data for up to 30 days after deletion to allow account recovery. After this period, data is scheduled for permanent deletion, subject to technical constraints and legal obligations."
9. **Data Deletion** — Clear instructions: delete from account settings or contact support@commongroundz.co
10. **International Users** — "If you access the platform from outside India, you understand that your information may be processed and stored in India or other countries where our service providers operate."
11. **Third-Party Links** — Not responsible for external content
12. **Children's Privacy** — "The platform is not intended for children under the age of 13. If you are under the age of 18, you should use the platform under the supervision of a parent or legal guardian."
13. **Changes to This Policy** — "We may update this policy from time to time. Continued use of the platform constitutes acceptance of the updated policy."
14. **Contact** — support@commongroundz.co

---

## Terms of Service Sections

1. **Acceptance of Terms**
2. **Eligibility** — 13+; under 18 requires parental supervision
3. **Account Registration**
4. **User Content** — Users own content; grant platform display license. "You are solely responsible for the content you post, including reviews, ratings, and recommendations. You represent that your content does not violate any laws or third-party rights."
5. **Prohibited Conduct**
6. **Content Moderation** — "We reserve the right to remove content or suspend accounts that violate our policies, at our sole discretion, with or without notice."
7. **No Professional Advice** — Informational only, no guarantee of accuracy or reliability
8. **User Responsibility for Decisions** — "You acknowledge that any decisions you make based on content or recommendations on the platform are made at your own risk."
9. **Platform Role** — "Common Groundz is a discovery and recommendation platform. We do not manufacture, sell, distribute, or control the products, services, or businesses listed on the platform. Any transaction or interaction with third parties is solely between you and the relevant third party."
10. **No Endorsement and Commercial Relationships** — "The inclusion of any product, service, place, or recommendation on the platform does not constitute an endorsement or guarantee by Common Groundz. Some listings, recommendations, or content may be influenced by partnerships, sponsorships, affiliate relationships, or commercial arrangements. Where applicable, such relationships will be disclosed in accordance with applicable law."
11. **Third-Party Links and Services**
12. **Intellectual Property**
13. **Indemnification** — "You agree to indemnify and hold harmless Common Groundz, its founders, and affiliates from any claims, damages, or expenses arising from your use of the platform, your content, or your violation of these Terms."
14. **Disclaimers** — "As is" and "as available" + "We do not guarantee that the platform will be uninterrupted, secure, or error-free."
15. **Limitation of Liability** — "To the fullest extent permitted by law, our maximum liability is limited to the amount paid by you (if any) in the last 12 months."
16. **Modification of Service** — "We reserve the right to modify, suspend, or discontinue any part of the platform at any time without liability."
17. **Termination**
18. **Changes to Terms** — "We may update these Terms from time to time. Continued use of the platform constitutes acceptance of the updated Terms."
19. **Governing Law** — Laws of India; courts in Bangalore, Karnataka
20. **Contact** — support@commongroundz.co

---

## Cookie Policy Sections (Updated)

1. **What Are Cookies**
2. **Strictly Necessary Cookies** — "These cookies are essential for the platform to function and cannot be disabled. They include authentication session cookies (via Supabase) and security cookies. These do not require your consent as they are necessary for the operation of the platform."
3. **Preference Cookies** — "These cookies remember your settings such as theme preferences. They enhance your experience but are not essential."
4. **Third-Party Cookies** — Google OAuth
5. **Future Changes** — "If advertising, analytics, or other optional cookie categories are introduced in the future, this policy will be updated accordingly and appropriate consent mechanisms will be provided before any optional cookies are set."
6. **Managing Cookies** — Browser settings instructions
7. **Updates to This Policy**
8. **Contact** — support@commongroundz.co

---

## Page Layout

Each page follows the existing app pattern:
- NavBarComponent at top
- Main content area: container, max-w-4xl, centered
- Page title (h1), last updated date, sections with h2 headings
- Footer at bottom
- Scroll to top on mount
- Public routes (no auth required)
- Mobile responsive

## Routing

Three public routes in App.tsx (alongside `/auth`, `/account-deleted`):
- `/privacy` — PrivacyPolicy
- `/terms` — TermsOfService
- `/cookies` — CookiePolicy

## Footer

Replace placeholder `#` links in the Legal section with Router Link components pointing to `/privacy`, `/terms`, `/cookies`. The "Cookie Policy" link replaces the current "Cookie Policy" placeholder. No other footer sections changed.

## Redirects

Add `/privacy`, `/terms`, `/cookies` to `public/_redirects` above the catch-all for clarity.

