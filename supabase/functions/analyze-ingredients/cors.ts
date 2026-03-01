// CORS headers for the analyze-ingredients edge function.
// Allow calls from the Next.js frontend (any localhost port in dev, production domain in prod).

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
