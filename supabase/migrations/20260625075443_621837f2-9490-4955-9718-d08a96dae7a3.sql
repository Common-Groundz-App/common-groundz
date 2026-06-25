INSERT INTO public.app_config (key, value, description)
VALUES ('entity_extraction.review_uses_draft', '{"enabled": false}'::jsonb, 'Phase 3.2 admin-only flag: when enabled, the AutoFillPreviewModal renders the draft-driven review UI (BrandPicker + ImageCandidateGrid) instead of the legacy preview.')
ON CONFLICT (key) DO NOTHING;