-- Phase 6: Smart Discovery System - Database Migrations

-- 1. Create saved_insights table for bookmarking insights
CREATE TABLE public.saved_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('journey', 'recommendation', 'comparison')),
  entity_from_id UUID REFERENCES public.entities(id) ON DELETE SET NULL,
  entity_to_id UUID REFERENCES public.entities(id) ON DELETE SET NULL,
  insight_data JSONB NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for user queries
CREATE INDEX idx_saved_insights_user_id ON public.saved_insights(user_id);
CREATE INDEX idx_saved_insights_created_at ON public.saved_insights(created_at DESC);

-- Enable RLS
ALTER TABLE public.saved_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies for saved_insights
CREATE POLICY "Users can view their own saved insights"
  ON public.saved_insights
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own saved insights"
  ON public.saved_insights
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved insights"
  ON public.saved_insights
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved insights"
  ON public.saved_insights
  FOR DELETE
  USING (auth.uid() = user_id);

-- 2. Create notification_preferences table
CREATE TABLE public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  weekly_digest_enabled BOOLEAN NOT NULL DEFAULT false,
  journey_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification_preferences
CREATE POLICY "Users can view their own notification preferences"
  ON public.notification_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notification preferences"
  ON public.notification_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences"
  ON public.notification_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 3. Add watch_for_upgrades column to user_stuff table
ALTER TABLE public.user_stuff 
ADD COLUMN IF NOT EXISTS watch_for_upgrades BOOLEAN NOT NULL DEFAULT false;

-- Index for watched items
CREATE INDEX IF NOT EXISTS idx_user_stuff_watch ON public.user_stuff(user_id, watch_for_upgrades) WHERE watch_for_upgrades = true;

-- 4. Update trigger for saved_insights
CREATE TRIGGER update_saved_insights_updated_at
  BEFORE UPDATE ON public.saved_insights
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- 5. Update trigger for notification_preferences
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();