# Group 6D — admin pictures, classified by role

| Where (Admin) | File | Role | Source kept |
|---|---|---|---|
| Entities tab table | AdminEntityManagementPanel | A | optimal (whole entity) |
| Content → Entity AI Summaries | AdminEntitiesPanel | A | optimal |
| Moderation → pending list | PendingEntitiesQueue | A | raw image_url |
| Suggestions → Entity column | AdminSuggestionsPanel | A | optimal |
| Claims table | AdminClaimsPanel | A | raw |
| Claims → review window | ClaimReviewModal | A | optimal |
| New Entity / Edit → "Part of" | ParentEntitySelector | A (fixed 32/40px wrappers) | raw |
| Relationships cards | AdminProductRelationshipsPanel | A, optional slot preserved | raw |
| New Entity → "Did you mean one of these?" | DuplicateConfirmDialog | C (EvidenceImage; box always existed) | raw |
| Edit → Image URL → Preview | AdminEntityEdit | C (EvidenceImage; guard unchanged) | raw image_url (was optimal) |

Group B untouched: ImageCandidateGrid, CreateEntityDialog/EntityImageUploader previews, AutoFillPreviewModal, SearchEntryPanel rows, AdminPhotoModerationPanel, AdminImageHealthPanel, user avatars.

Unchanged globally: ImageWithFallback, getOptimalEntityImageUrl, stock helpers, DB, schema.

Verification: src/components/admin/group6dAdminImages.test.tsx (15); full suite; tsgo clean. Authenticated admin runtime capture not available.
