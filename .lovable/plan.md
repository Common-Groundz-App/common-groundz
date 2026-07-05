## Phase 3.4 — Final plan v3 (implementation-ready)

Only change vs v2: the invalid **nested PL/pgSQL helper** inside `create_brand_and_entity_atomic` is replaced with a real top-level helper function `public.validate_entity_http_url`. Everything else is identical to v2 (already approved by both reviewers).

Verified in repo:
- `parent_id` is the brand link on `entities` ✅
- `public.is_non_admin_entity_creation_enabled()` already exists (migration `20260629080245`) ✅
- No live callers of `check_entity_creation_quota` — only the auto-regenerated `src/integrations/supabase/types.ts` references it, so dropping it in Migration A is safe ✅

Rollout: **3.4A → 3.4B → 3.4C → 3.4D → 3.4E flag flip**.

---

## 3.4A — Migration (server rails), single file, in this order

### (i) Trigger — race-safe quota + forced pending

Extend `entities_enforce_creation` (BEFORE INSERT). Admin branch and the existing `created_by IS NOT NULL` raise stay as-is. Add for the non-admin branch:

```sql
IF NOT is_admin THEN
  PERFORM pg_advisory_xact_lock(hashtext('entity_quota:' || NEW.created_by::text));

  IF (SELECT count(*) FROM public.entities
       WHERE created_by = NEW.created_by
         AND is_deleted = false
         AND created_at > now() - interval '24 hours') >= 10 THEN
    RAISE EXCEPTION 'entity_creation_quota_exceeded'
      USING ERRCODE = '23514',
            HINT = 'Non-admin users can create up to 10 entities per 24h.';
  END IF;

  NEW.approval_status := 'pending';
END IF;
```

xact-scoped advisory lock, namespaced. Trigger is the sole quota authority.

### (ii) Drop old quota RPC, add new one under a new name

```sql
DROP FUNCTION IF EXISTS public.check_entity_creation_quota(uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.get_entity_creation_quota_status(
  _user_id        uuid,
  _max_entities   integer default 10,
  _window_hours   integer default 24,
  _required_count integer default 1
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE used_count integer;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() <> _user_id
         AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO used_count FROM public.entities
   WHERE created_by = _user_id
     AND is_deleted = false
     AND created_at > now() - make_interval(hours => _window_hours);

  RETURN jsonb_build_object(
    'used', used_count, 'max', _max_entities,
    'remaining', greatest(_max_entities - used_count, 0),
    'required', _required_count,
    'allowed', (_max_entities - used_count) >= _required_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_entity_creation_quota_status(uuid,integer,integer,integer)
  TO authenticated, service_role;
```

### (iii) URL validation helper — top-level (fixes the v2 blocker)

Standalone `IMMUTABLE` function so it can be inlined by the planner and called from the atomic RPC without nesting. Not `SECURITY DEFINER` — pure value validation, no elevated privileges.

```sql
CREATE OR REPLACE FUNCTION public.validate_entity_http_url(
  _url        text,
  _field_name text
) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE t text;
BEGIN
  IF _url IS NULL THEN RETURN NULL; END IF;
  t := btrim(_url);
  IF t = '' THEN RETURN NULL; END IF;
  IF length(t) > 2048 THEN
    RAISE EXCEPTION 'invalid_url_%_too_long', _field_name USING ERRCODE = '22023';
  END IF;
  IF t !~* '^https?://[^ \t\r\n]+$' THEN
    RAISE EXCEPTION 'invalid_url_%', _field_name USING ERRCODE = '22023';
  END IF;
  RETURN t;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_entity_http_url(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.validate_entity_http_url(text, text) TO authenticated, service_role;
```

Executable by `authenticated` since the atomic RPC (SECURITY DEFINER) calls it; that's fine — it's a pure validator with no side effects.

### (iv) Atomic brand + entity RPC — hardened

Applied (from v2): required params first, feature-flag check inside RPC, base-slug loop that raises on exhaustion, whitelist inserts, in-tx duplicate re-check with active-brand reuse, soft-delete / website-conflict → admin-only errors, metadata key-strip + 32KB cap, `parent_id`, forced `created_by = auth.uid()`, `entity_type='brand'` rejected, advisory lock on brand name.

**Only change vs v2:** the nested `FUNCTION _safe_url` is deleted. URL normalization now calls the top-level `public.validate_entity_http_url` helper.

```sql
CREATE OR REPLACE FUNCTION public.create_brand_and_entity_atomic(
  -- required first
  _brand_name         text,
  _entity_name        text,
  _entity_type        public.entity_type,
  -- optional after
  _brand_website_url  text  default null,
  _brand_image_url    text  default null,
  _brand_description  text  default null,
  _entity_category_id uuid  default null,
  _entity_description text  default null,
  _entity_website_url text  default null,
  _entity_image_url   text  default null,
  _entity_metadata    jsonb default '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid              uuid := auth.uid();
  is_admin         boolean;
  normalized_brand text;
  normalized_web   text;
  existing_brand   public.entities%ROWTYPE;
  soft_deleted     public.entities%ROWTYPE;
  website_owner    public.entities%ROWTYPE;
  brand_base_slug  text;
  brand_slug       text;
  entity_base_slug text;
  entity_slug      text;
  candidate_slug   text;
  new_brand        public.entities%ROWTYPE;
  new_entity       public.entities%ROWTYPE;
  safe_meta        jsonb;
  found_slot       boolean;
BEGIN
  -- 1. Auth
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  is_admin := public.has_role(uid, 'admin'::public.app_role);

  -- 2. Feature flag (non-admins only). Safe even before 3.4E flag flip.
  IF NOT is_admin AND NOT public.is_non_admin_entity_creation_enabled() THEN
    RAISE EXCEPTION 'non_admin_entity_creation_disabled' USING ERRCODE = '42501';
  END IF;

  -- 3. Payload validation
  IF _brand_name IS NULL OR length(btrim(_brand_name)) < 2 OR length(_brand_name) > 200 THEN
    RAISE EXCEPTION 'invalid_brand_name' USING ERRCODE = '22023';
  END IF;
  IF _entity_name IS NULL OR length(btrim(_entity_name)) < 2 OR length(_entity_name) > 300 THEN
    RAISE EXCEPTION 'invalid_entity_name' USING ERRCODE = '22023';
  END IF;
  IF _entity_type = 'brand'::public.entity_type THEN
    RAISE EXCEPTION 'entity_type_cannot_be_brand' USING ERRCODE = '22023';
  END IF;

  -- 4. URL normalization — top-level helper, no nested function
  _brand_website_url  := public.validate_entity_http_url(_brand_website_url,  'brand_website');
  _brand_image_url    := public.validate_entity_http_url(_brand_image_url,    'brand_image');
  _entity_website_url := public.validate_entity_http_url(_entity_website_url, 'entity_website');
  _entity_image_url   := public.validate_entity_http_url(_entity_image_url,   'entity_image');

  -- 5. Metadata sanitize + cap
  IF _entity_metadata IS NULL THEN
    safe_meta := '{}'::jsonb;
  ELSIF pg_column_size(_entity_metadata) > 32000 THEN
    RAISE EXCEPTION 'metadata_too_large' USING ERRCODE = '22023';
  ELSE
    safe_meta := _entity_metadata
      - 'approval_status' - 'approved_by' - 'approved_at'
      - 'rejected_by' - 'rejected_at' - 'is_deleted'
      - 'created_by' - 'restored' - 'restored_by' - 'restored_at';
  END IF;

  normalized_brand := lower(btrim(_brand_name));
  normalized_web   := _brand_website_url;  -- already normalized

  -- 6. Serialize concurrent inserts for the same brand name
  PERFORM pg_advisory_xact_lock(hashtext('brand_create:' || normalized_brand));

  -- 7. In-transaction duplicate re-check (independent of preflight)
  SELECT * INTO existing_brand FROM public.entities
   WHERE type = 'brand' AND is_deleted = false
     AND lower(name) = normalized_brand
   LIMIT 1;

  IF existing_brand.id IS NOT NULL THEN
    new_brand := existing_brand;  -- reuse
  ELSE
    SELECT * INTO soft_deleted FROM public.entities
     WHERE type = 'brand' AND is_deleted = true
       AND lower(name) = normalized_brand
     LIMIT 1;
    IF soft_deleted.id IS NOT NULL THEN
      RAISE EXCEPTION 'conflict_requires_admin_soft_deleted_brand' USING ERRCODE = 'P0001';
    END IF;

    IF normalized_web IS NOT NULL THEN
      SELECT * INTO website_owner FROM public.entities
       WHERE type = 'brand' AND website_url = normalized_web
       LIMIT 1;
      IF website_owner.id IS NOT NULL THEN
        RAISE EXCEPTION 'conflict_requires_admin_website_owned' USING ERRCODE = 'P0001';
      END IF;
    END IF;

    -- 8. Brand slug — base-slug loop
    brand_base_slug := btrim(regexp_replace(lower(_brand_name), '[^a-z0-9]+', '-', 'g'), '-');
    IF brand_base_slug = '' THEN brand_base_slug := 'brand'; END IF;
    found_slot := false;
    FOR i IN 0..20 LOOP
      candidate_slug := CASE WHEN i = 0 THEN brand_base_slug
                             ELSE brand_base_slug || '-' || i::text END;
      IF NOT EXISTS (SELECT 1 FROM public.entities
                      WHERE slug = candidate_slug AND is_deleted = false) THEN
        brand_slug := candidate_slug; found_slot := true; EXIT;
      END IF;
    END LOOP;
    IF NOT found_slot THEN
      RAISE EXCEPTION 'slug_generation_failed_brand' USING ERRCODE = 'P0001';
    END IF;

    -- 9. Insert brand — whitelist. Trigger enforces pending + quota.
    INSERT INTO public.entities (
      name, type, slug, image_url, website_url, description,
      created_by, user_created, metadata
    ) VALUES (
      _brand_name, 'brand'::public.entity_type, brand_slug,
      _brand_image_url, normalized_web,
      coalesce(_brand_description, _brand_name || ' brand'),
      uid, true,
      jsonb_build_object('auto_created', true, 'creation_method', 'atomic_brand_plus_entity')
    ) RETURNING * INTO new_brand;
  END IF;

  -- 10. Entity slug — base-slug loop
  entity_base_slug := btrim(regexp_replace(lower(_entity_name), '[^a-z0-9]+', '-', 'g'), '-');
  IF entity_base_slug = '' THEN entity_base_slug := 'entity'; END IF;
  found_slot := false;
  FOR i IN 0..20 LOOP
    candidate_slug := CASE WHEN i = 0 THEN entity_base_slug
                           ELSE entity_base_slug || '-' || i::text END;
    IF NOT EXISTS (SELECT 1 FROM public.entities
                    WHERE slug = candidate_slug AND is_deleted = false) THEN
      entity_slug := candidate_slug; found_slot := true; EXIT;
    END IF;
  END LOOP;
  IF NOT found_slot THEN
    RAISE EXCEPTION 'slug_generation_failed_entity' USING ERRCODE = 'P0001';
  END IF;

  -- 11. Insert main entity — whitelist. parent_id links to brand.
  INSERT INTO public.entities (
    name, type, slug, category_id, description, website_url, image_url,
    parent_id, created_by, user_created, metadata
  ) VALUES (
    _entity_name, _entity_type, entity_slug, _entity_category_id,
    _entity_description, _entity_website_url, _entity_image_url,
    new_brand.id, uid, true, safe_meta
  ) RETURNING * INTO new_entity;

  RETURN jsonb_build_object('brand', to_jsonb(new_brand), 'entity', to_jsonb(new_entity));
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_brand_and_entity_atomic(
  text, text, public.entity_type,
  text, text, text, uuid, text, text, text, jsonb
) TO authenticated;
```

Later-not-blockers: normalized brand match server-side (AXIS-Y ≡ axis y — client already normalizes via `normalizeBrandName`); website URL scheme/trailing-slash canonicalization.

## 3.4B — Edge function gates

Applies to `analyze-entity-url-v2`, `create-brand-entity`, `check-entity-duplicates`.

- Keep JWT verification, SSRF/DNS guards, Zod, sanitized errors.
- Replace `if (!isAdmin) 403` with: `if (!isAdmin && !(await isNonAdminEntityCreationEnabled())) return 403 NON_ADMIN_DISABLED`. Flag lookup uses the service-role client (no `auth.uid()` needed).
- **All quota / atomic RPC calls** use a Supabase client constructed with the caller's `Authorization` header so `auth.uid()` resolves inside the RPC. Never call these RPCs from the pure service-role client.

**`analyze-entity-url-v2`**: per-user in-memory sliding window, **20 / 5 min keyed on authenticated user id** (not IP). Source comment: *"Best-effort per-instance limiter; not durable across cold starts or instances. Move to DB-backed limiter if abuse appears."* Admins bypass.

**`create-brand-entity` non-admin surface** (preflight only):

- Allowed: `confirmCreate !== true` → `existing_found` or `confirm_required { kind: 'create_new' }`.
- `confirmCreate === true` for non-admin → `409 USE_ATOMIC_RPC`.
- Soft-deleted-restore / website-conflict-mutation for non-admin → `409 CONFLICT_REQUIRES_ADMIN`.
- Admin branch: keep passing `created_by = userId` explicitly (defense-in-depth).

**Legacy `analyze-entity-url`** unchanged — stays admin-only, in-source comment.

**Audit sweep**: grep every service-role INSERT into `public.entities` and confirm each passes `created_by`; the trigger's raise is the backstop.

## 3.4C — Client

`src/components/admin/CreateEntityDialog.tsx` — when non-admin (or `variant === 'user'`):

- Force V2 Draft Review path locally; ignore `useEntityReviewUsesDraft` (admin-only flag).
- Never render legacy Analyze tab or any code path calling `analyze-entity-url` v1.

**Preflight** in `BrandPicker` / DraftReviewBody:

- On mount of "Create new brand" sub-option: call `get_entity_creation_quota_status(uid, _required_count: 2)`.
  - `remaining >= 2` → enable.
  - `remaining === 1` → disable, inline note: *"You have 1 slot left in the next 24h. Create the product without a brand for now — an admin will attach it later."*, auto-select "Not sure".
  - `remaining === 0` → block + toast.
- Just before final single-insert entity: fresh preflight `_required_count: 1` (multi-tab guard).
- "Create new brand + entity" submit calls the RPC with named args matching the new signature:

  ```ts
  const { data, error } = await supabase.rpc('create_brand_and_entity_atomic', {
    _brand_name: brand.name,
    _entity_name: entity.name,
    _entity_type: entity.type,
    _brand_website_url: brand.website_url ?? null,
    _brand_image_url: brand.image_url ?? null,
    _brand_description: brand.description ?? null,
    _entity_category_id: entity.category_id ?? null,
    _entity_description: entity.description ?? null,
    _entity_website_url: entity.website_url ?? null,
    _entity_image_url: entity.image_url ?? null,
    _entity_metadata: entity.metadata ?? {},
  });
  ```

- Error mapping:
  - `entity_creation_quota_exceeded` → quota toast.
  - `conflict_requires_admin_*` → toast + auto-switch to "Not sure".
  - `non_admin_entity_creation_disabled` → "Entity creation isn't available for your account right now."
  - `invalid_*` / `metadata_too_large` / `slug_generation_failed_*` → form error.
  - `forbidden` on quota RPC → hard error toast.

Copy everywhere: **"You can create up to 10 new entities per day."**

Media/photos: unchanged — continue through the existing post-create client path (best-effort). In-code comment on the success handler documents this.

## 3.4D — Post-create continuation

Verify in repo before wiring:
- Does `/entity/:slug` accept router state / query param to auto-open the review composer?
- Does `/create?entity=:id` (or equivalent) pre-tag the entity?

Ship the verified subset via new `src/components/admin/entity-create/PostCreateContinuation.tsx`, replacing the current toast+close tail:

- **Always:** "View entity", "Just save".
- **Only if verified:** "Write a review", "Post about this".
- Non-admin creators see: *"Your entity is under review — visible with a Pending badge until an admin approves it."*

## 3.4E — Flag flip (separate migration, LAST)

Only after 3.4A–3.4D are merged and validation is green:

```sql
INSERT INTO public.app_config (key, value, description)
VALUES ('entity_creation.non_admin_enabled',
        jsonb_build_object('enabled', true),
        'Phase 3.4: non-admin entity creation enabled.')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description,
      updated_at = now();
```

## Validation checklist

1. Non-admin analyzes URL → V2 Draft Review only.
2. Non-admin single-insert → `approval_status='pending'`, `created_by=auth.uid()`.
3. Admin creates → still `approved`.
4. Non-admin at 10/24h → 11th blocked by trigger even from devtools.
5. Non-admin at 9/10 in brand+product → client blocks + steers to "Not sure"; product still creatable with `parent_id = null`.
6. **Race:** two parallel inserts at 9/10 → exactly one succeeds, other raises `entity_creation_quota_exceeded`.
7. **Atomic rollback:** intentionally break the second insert → zero rows in `entities`.
8. **Duplicate re-check:** create "X" between preflight and atomic call → RPC reuses existing.
9. **Field smuggling:** `_entity_metadata = {"approval_status":"approved","created_by":"<other>"}` → row lands pending, correct `created_by`, metadata cleaned.
10. **Type smuggling:** `_entity_type='brand'` → `entity_type_cannot_be_brand`.
11. **URL validation:** `_brand_website_url='javascript:alert(1)'` → `invalid_url_brand_website`, zero rows.
12. **Slug loop:** artificially collide 21 candidates → `slug_generation_failed_*`, zero rows.
13. **Quota RPC guard:** user A calling for user_B_id → `42501 forbidden`.
14. **RPC context:** confirm edge function calls RPC with user JWT (smoke test logs `auth.uid()`).
15. Non-admin `create-brand-entity` `confirmCreate:true` → `409 USE_ATOMIC_RPC`.
16. Non-admin soft-delete restore / website conflict → `409 CONFLICT_REQUIRES_ADMIN`.
17. `analyze-entity-url-v2` 21 calls/5 min per-user → 429.
18. **Flag OFF — direct RPC:** non-admin calling `create_brand_and_entity_atomic` directly → `42501 non_admin_entity_creation_disabled`, zero rows.
19. **Flag OFF — edge:** three functions → `403 NON_ADMIN_DISABLED`; direct entity INSERT blocked by RLS.
20. **Flag ON:** end-to-end V2 Draft Review creates pending entity + shows continuation with only verified actions.
21. Overload gone: `supabase.rpc('check_entity_creation_quota', …)` no longer resolves in generated types.
22. **NEW — helper isolation:** direct call `select public.validate_entity_http_url('javascript:x','brand_website')` raises `invalid_url_brand_website`; valid `https://x.com/y` returns trimmed value.

## Files touched

- **Migration A** (rails): trigger update + drop old quota RPC + `get_entity_creation_quota_status` + `validate_entity_http_url` helper + `create_brand_and_entity_atomic`.
- **Migration B** (flag flip): `app_config` upsert.
- **Edge functions**: `analyze-entity-url-v2`, `create-brand-entity`, `check-entity-duplicates`.
- **Client**: `CreateEntityDialog.tsx`, new `entity-create/PostCreateContinuation.tsx`, copy updates.

## Explicitly out of scope

Search / Lens / Barcode (3.5–3.7), reputation-based auto-approve, per-field provenance, DB-backed durable rate limiter, media atomicity, admin "attach brand later" moderation UI, server-side normalized brand matching, website URL canonicalization.
