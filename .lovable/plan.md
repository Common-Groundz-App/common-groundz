

# Legal Pages — Final Polish (3 Small Edits)

Three targeted text changes across two files. No new files, no structural changes.

---

## Changes

### 1. Legal Disclosure Clause (Privacy Policy)

**File:** `src/pages/PrivacyPolicy.tsx`

Add one sentence to the end of the **Data Sharing** section (Section 5):

> "We may also disclose personal information if required to do so by law, court order, or in response to valid legal requests by government authorities."

This is standard and protects against government/legal request scenarios.

---

### 2. Stronger Anti-Scraping Wording (Terms of Service)

**File:** `src/pages/TermsOfService.tsx`

In **Prohibited Conduct** (Section 5), replace:

> "Use automated tools to scrape or collect data from the platform without permission"

With:

> "Use bots, scrapers, crawlers, or automated means to access, collect, or index content from the platform without our prior written consent"

Important because Common Groundz is building structured taste/preference data that needs protection.

---

### 3. Expanded Limitation of Liability (Terms of Service)

**File:** `src/pages/TermsOfService.tsx`

In **Limitation of Liability** (Section 15), replace:

> "We are not liable for any indirect, incidental, consequential, or punitive damages."

With:

> "We are not liable for any indirect, incidental, consequential, or punitive damages, including loss of profits, data, goodwill, or business interruption."

Strengthens the liability shield with specific damage categories.

---

## Summary

| File | Section | Change |
|------|---------|--------|
| `PrivacyPolicy.tsx` | 5. Data Sharing | Add legal disclosure sentence |
| `TermsOfService.tsx` | 5. Prohibited Conduct | Stronger anti-scraping wording |
| `TermsOfService.tsx` | 15. Limitation of Liability | Expand damage categories |

Two files modified. Three single-line text edits. No layout, routing, or structural changes.

