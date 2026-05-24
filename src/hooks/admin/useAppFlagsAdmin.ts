import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { __resetMuxConfigCache } from '@/services/mediaService';

export interface AppConfigRow {
  key: string;
  value: any;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
  updated_reason: string | null;
}

async function fetchRows(): Promise<AppConfigRow[]> {
  const { data, error } = await supabase
    .from('app_config')
    .select('key,value,description,updated_at,updated_by,updated_reason')
    .in('key', ['mux.uploads_enabled', 'mux.mode']);
  if (error) throw error;
  return (data ?? []) as AppConfigRow[];
}

export function useAppFlagRows() {
  return useQuery({
    queryKey: ['app_config', 'admin_rows'],
    queryFn: fetchRows,
    staleTime: 10_000,
  });
}

interface SetFlagInput {
  key: 'mux.uploads_enabled' | 'mux.mode';
  value: Record<string, unknown>;
  reason?: string;
}

export function useSetAppFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value, reason }: SetFlagInput) => {
      const { data, error } = await supabase.rpc('set_app_flag', {
        _key: key,
        _value: value as any,
        _reason: reason ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate both admin rows and the public flags readout
      qc.invalidateQueries({ queryKey: ['app_config'] });
      // Reset upload-time cache twice: now + 1.5s later to catch in-flight reads
      __resetMuxConfigCache();
      setTimeout(() => __resetMuxConfigCache(), 1500);
    },
  });
}
