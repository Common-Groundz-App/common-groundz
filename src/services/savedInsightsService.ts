import { supabase } from '@/integrations/supabase/client';

export interface SavedInsight {
  id: string;
  user_id: string;
  insight_type: 'journey' | 'recommendation' | 'comparison';
  entity_from_id: string | null;
  entity_to_id: string | null;
  insight_data: {
    from_entity_name?: string;
    to_entity_name?: string;
    transition_type?: string;
    story?: {
      headline: string;
      description: string;
    };
    confidence?: string;
    consensus_count?: number;
    [key: string]: any;
  };
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaveInsightParams {
  insight_type: 'journey' | 'recommendation' | 'comparison';
  entity_from_id?: string;
  entity_to_id?: string;
  insight_data: Record<string, any>;
  notes?: string;
}

class SavedInsightsService {
  async getSavedInsights(limit = 50): Promise<SavedInsight[]> {
    const { data, error } = await supabase
      .from('saved_insights')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[SavedInsightsService] Error fetching saved insights:', error);
      throw error;
    }

    return (data || []) as SavedInsight[];
  }

  async saveInsight(params: SaveInsightParams): Promise<SavedInsight | null> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('saved_insights')
      .insert({
        user_id: user.id,
        insight_type: params.insight_type,
        entity_from_id: params.entity_from_id || null,
        entity_to_id: params.entity_to_id || null,
        insight_data: params.insight_data,
        notes: params.notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[SavedInsightsService] Error saving insight:', error);
      throw error;
    }

    return data as SavedInsight;
  }

  async updateInsightNotes(id: string, notes: string): Promise<void> {
    const { error } = await supabase
      .from('saved_insights')
      .update({ notes })
      .eq('id', id);

    if (error) {
      console.error('[SavedInsightsService] Error updating insight notes:', error);
      throw error;
    }
  }

  async removeInsight(id: string): Promise<void> {
    const { error } = await supabase
      .from('saved_insights')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[SavedInsightsService] Error removing insight:', error);
      throw error;
    }
  }

  async isInsightSaved(entityFromId: string, entityToId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('saved_insights')
      .select('id')
      .eq('entity_from_id', entityFromId)
      .eq('entity_to_id', entityToId)
      .maybeSingle();

    if (error) {
      console.error('[SavedInsightsService] Error checking if insight is saved:', error);
      return false;
    }

    return !!data;
  }
}

export const savedInsightsService = new SavedInsightsService();
