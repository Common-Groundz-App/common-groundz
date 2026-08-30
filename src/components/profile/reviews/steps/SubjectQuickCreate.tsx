import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CANONICAL_ENTITY_TYPES, type CanonicalEntityType } from '@/services/entityType';
import { createEntitySubject } from '@/services/enhancedEntityService';
import { getProviderTypesFor } from '@/services/entityRelationshipRegistry';
import type { EntityAdapter } from '@/components/profile/circles/types';

/**
 * Phase 2.3 — Safe Subject Creation drawer (lightweight, sibling to the review
 * form dialog; cancelling preserves the entire review draft untouched).
 *
 * Flow: pick a type → (offerings only) pick/search the provider → name it →
 * duplicate preflight (exact blocks, possible warns) → atomic create via the
 * `create_entity_subject` RPC. Exact duplicates the RPC resolves are simply
 * selected. Successful creation AUTO-SELECTS the entity as the review subject.
 */

const TYPE_LABELS: Record<CanonicalEntityType, string> = {
  place: 'Place', food: 'Dish', product: 'Product', brand: 'Brand',
  book: 'Book', movie: 'Movie', tv_show: 'TV Show', course: 'Course',
  app: 'App', game: 'Game', event: 'Event', experience: 'Experience',
  professional: 'Professional', service: 'Service', others: 'Other',
};

const PROVIDER_LABELS: Record<string, { singular: string; search: string; addNew: string }> = {
  place: { singular: 'place', search: 'Which place serves it?', addNew: 'Add a new place' },
  brand: { singular: 'brand', search: 'Which brand makes it?', addNew: 'Add a new brand' },
};

interface DuplicateCandidate {
  id: string;
  name: string;
  image_url: string | null;
  type: string;
  parent_name: string | null;
  reasons: string[];
  classification?: 'exact' | 'possible' | 'conflict';
}

interface ProviderRow {
  id: string;
  name: string;
  image_url: string | null;
  type: string;
}

type Step = 'type' | 'provider' | 'name';

interface SubjectQuickCreateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (entity: EntityAdapter) => void;
  logEvent?: (event: string, payload?: Record<string, unknown>) => void;
}

const SubjectQuickCreate: React.FC<SubjectQuickCreateProps> = ({
  open, onOpenChange, onCreated, logEvent,
}) => {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('type');
  const [subjectType, setSubjectType] = useState<CanonicalEntityType | null>(null);
  const [name, setName] = useState('');

  // Provider state (offerings only)
  const [providerType, setProviderType] = useState<CanonicalEntityType | null>(null);
  const [providerQuery, setProviderQuery] = useState('');
  const [providerResults, setProviderResults] = useState<ProviderRow[]>([]);
  const [providerSearching, setProviderSearching] = useState(false);
  const [provider, setProvider] = useState<ProviderRow | null>(null);
  const [newProviderName, setNewProviderName] = useState<string | null>(null);

  // Duplicates + submit
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = useCallback(() => {
    setStep('type');
    setSubjectType(null);
    setName('');
    setProviderType(null);
    setProviderQuery('');
    setProviderResults([]);
    setProvider(null);
    setNewProviderName(null);
    setDuplicates(null);
    setSubmitting(false);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  // Debounced provider search (existing rows only; creation is explicit below)
  useEffect(() => {
    if (step !== 'provider' || !providerType) return;
    const q = providerQuery.trim();
    if (q.length < 2) { setProviderResults([]); return; }
    setProviderSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('entities')
        .select('id, name, image_url, type')
        .eq('is_deleted', false)
        .eq('type', providerType)
        .ilike('name', `%${q.replace(/[%_]/g, '')}%`)
        .limit(8);
      setProviderResults((data as ProviderRow[] | null) ?? []);
      setProviderSearching(false);
    }, 300);
    return () => { clearTimeout(t); setProviderSearching(false); };
  }, [providerQuery, step, providerType]);

  const pickType = (t: CanonicalEntityType) => {
    setSubjectType(t);
    const providers = getProviderTypesFor(t);
    if (providers.length > 0) {
      setProviderType(providers[0]);
      setStep('provider');
    } else {
      setStep('name');
    }
  };

  const selectEntity = (row: { id: string; name: string; type: string; image_url?: string | null; parent_name?: string | null }) => {
    onCreated({
      id: row.id,
      name: row.name,
      type: row.type,
      image_url: row.image_url ?? undefined,
      venue: row.parent_name ?? undefined,
    });
    onOpenChange(false);
  };

  const runPreflight = async (): Promise<DuplicateCandidate[] | null> => {
    if (!subjectType) return null;
    try {
      const { data, error } = await supabase.functions.invoke('check-entity-duplicates', {
        body: { mode: 'full', name: name.trim(), type: subjectType, parentId: provider?.id ?? null },
      });
      if (error) return null; // advisory only — never block creation on preflight failure
      return (data?.candidates as DuplicateCandidate[] | undefined) ?? [];
    } catch {
      return null;
    }
  };

  const finish = async (candidates: DuplicateCandidate[]) => {
    if (!subjectType) return;
    const exact = candidates.filter((c) => c.classification === 'exact');
    const conflicts = candidates.filter((c) => c.classification === 'conflict');
    if (conflicts.length > 0) {
      toast({
        title: 'Data conflict detected',
        description: 'This matches an existing record of a different type. Please pick it from search instead.',
        variant: 'destructive',
      });
      setDuplicates(candidates);
      return;
    }
    if (exact.length > 0) {
      // Exact duplicates BLOCK creation with an escape hatch.
      logEvent?.('subject_create_duplicate_exact', { entity_type: subjectType });
      setDuplicates(candidates);
      return;
    }
    if (candidates.length > 0) {
      // Possible duplicates warn but never block.
      logEvent?.('subject_create_duplicate_possible', { entity_type: subjectType });
      setDuplicates(candidates);
      return;
    }
    await doCreate();
  };

  const doCreate = async () => {
    if (!subjectType) return;
    setSubmitting(true);
    try {
      // Create the typed provider first when the user added a new one inline.
      let parentId = provider?.id ?? null;
      if (!parentId && newProviderName && providerType) {
        const created = await createEntitySubject({
          name: newProviderName,
          type: providerType,
          metadata: { created_from: 'review_subject_quick_create' },
        });
        parentId = created.entity.id;
      }
      const result = await createEntitySubject({
        name: name.trim(),
        type: subjectType,
        parentId,
        metadata: { created_from: 'review_subject_quick_create' },
      });
      logEvent?.('subject_create_completed', {
        entity_type: subjectType,
        source: result.created ? 'search' : 'existing_match',
      });
      toast({
        title: result.created ? 'Subject added' : 'Using the existing entry',
        description: result.created
          ? `"${result.entity.name}" is now your review subject.`
          : `"${result.entity.name}" already existed, so we selected it for you.`,
      });
      onCreated({
        id: result.entity.id,
        name: result.entity.name,
        type: result.entity.type,
        image_url: (result.entity as any).image_url ?? undefined,
        venue: (result.entity as any).venue ?? undefined,
        api_source: (result.entity as any).api_source ?? undefined,
        api_ref: (result.entity as any).api_ref ?? undefined,
        metadata: (result.entity as any).metadata,
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: 'Could not create the subject',
        description: err?.message ?? 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!subjectType || !name.trim()) return;
    logEvent?.('subject_create_started', { entity_type: subjectType });
    setSubmitting(true);
    try {
      const candidates = await runPreflight();
      await finish(candidates ?? []);
    } finally {
      setSubmitting(false);
    }
  };

  const exactDupes = (duplicates ?? []).filter((c) => c.classification === 'exact');
  const possibleDupes = (duplicates ?? []).filter((c) => c.classification !== 'exact');
  const providerLabels = providerType ? PROVIDER_LABELS[providerType] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 'type' && 'What are you reviewing?'}
            {step === 'provider' && providerLabels?.search}
            {step === 'name' && `Name the ${subjectType ? TYPE_LABELS[subjectType].toLowerCase() : 'subject'}`}
          </DialogTitle>
        </DialogHeader>

        {step !== 'type' && (
          <Button
            variant="ghost" size="sm" className="self-start -mt-2"
            onClick={() => setStep(step === 'name' ? (providerType ? 'provider' : 'type') : 'type')}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        )}

        {step === 'type' && (
          <div className="grid grid-cols-3 gap-2">
            {CANONICAL_ENTITY_TYPES.map((t) => (
              <Button key={t} variant="outline" className="h-auto py-3" onClick={() => pickType(t)}>
                {TYPE_LABELS[t]}
              </Button>
            ))}
          </div>
        )}

        {step === 'provider' && providerType && providerLabels && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={`Search for a ${providerLabels.singular}...`}
                value={providerQuery}
                onChange={(e) => { setProviderQuery(e.target.value); setNewProviderName(null); }}
                autoFocus
              />
              {providerSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {providerResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto divide-y rounded-md border">
                {providerResults.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-accent ${provider?.id === row.id ? 'bg-accent' : ''}`}
                    onClick={() => { setProvider(row); setNewProviderName(null); }}
                  >
                    {row.name}
                  </button>
                ))}
              </div>
            )}

            {providerQuery.trim().length >= 2 && !providerSearching && (
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={() => { setNewProviderName(providerQuery.trim()); setProvider(null); }}
              >
                {providerLabels.addNew} “{providerQuery.trim()}”
              </button>
            )}

            {newProviderName && (
              <p className="text-xs text-muted-foreground">
                A new {providerLabels.singular} “{newProviderName}” will be created first.
              </p>
            )}

            <div className="flex items-center justify-between pt-1">
              {subjectType === 'product' ? (
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:underline"
                  onClick={() => { setProvider(null); setNewProviderName(null); setProviderType(null); setStep('name'); }}
                >
                  I don’t know the brand
                </button>
              ) : <span />}
              <Button
                disabled={!provider && !newProviderName}
                onClick={() => setStep('name')}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 'name' && subjectType && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="quick-create-name">Name</Label>
              <Input
                id="quick-create-name"
                placeholder={
                  subjectType === 'food'
                    ? 'e.g. Classic Burger'
                    : subjectType === 'service'
                    ? 'e.g. Haircut, plumbing repair, tax consultation'
                    : `e.g. ${TYPE_LABELS[subjectType]} name`
                }
                value={name}
                onChange={(e) => { setName(e.target.value); setDuplicates(null); }}
                autoFocus
                maxLength={200}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              />
            </div>

            {exactDupes.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                <p className="text-sm font-medium">This already exists</p>
                {exactDupes.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">
                      {c.name}{c.parent_name ? ` · ${c.parent_name}` : ''}
                      <span className="text-muted-foreground"> — {c.reasons[0]}</span>
                    </span>
                    <Button size="sm" variant="outline" onClick={() => selectEntity(c)}>
                      Review this
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {exactDupes.length === 0 && possibleDupes.length > 0 && (
              <div className="rounded-md border p-3 space-y-2">
                <p className="text-sm font-medium">Similar entries found</p>
                {possibleDupes.slice(0, 3).map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">
                      {c.name}{c.parent_name ? ` · ${c.parent_name}` : ''}
                      <span className="text-muted-foreground"> — {c.reasons[0]}</span>
                    </span>
                    <Button size="sm" variant="outline" onClick={() => selectEntity(c)}>
                      Use this
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              {duplicates && exactDupes.length === 0 && possibleDupes.length > 0 && (
                <Button variant="secondary" disabled={submitting} onClick={doCreate}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create anyway'}
                </Button>
              )}
              <Button
                disabled={!name.trim() || submitting || exactDupes.length > 0}
                onClick={handleSubmit}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SubjectQuickCreate;
