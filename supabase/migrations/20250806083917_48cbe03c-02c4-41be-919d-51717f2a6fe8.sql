-- Fix the Isha Foundation entity's website URL that should have been applied from the approved suggestion
UPDATE public.entities 
SET website_url = 'https://essentialchapters.com/collections/all',
    updated_at = now()
WHERE id = '07b442e4-4294-4535-972c-d67622714341';