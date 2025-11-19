import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const { query, limit = 10, category, minPrice, maxPrice } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate embedding for search query using Lovable AI
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query,
      }),
    });

    if (!embeddingResponse.ok) {
      console.error('Failed to generate embedding');
      // Fallback to text search
      let textQuery = supabaseClient
        .from('products')
        .select('*')
        .eq('is_active', true)
        .or(`name.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%`)
        .limit(limit);

      if (category) {
        textQuery = textQuery.eq('category', category);
      }
      if (minPrice) {
        textQuery = textQuery.gte('price', minPrice);
      }
      if (maxPrice) {
        textQuery = textQuery.lte('price', maxPrice);
      }

      const { data, error } = await textQuery;

      if (error) {
        throw error;
      }

      return new Response(
        JSON.stringify({ products: data, method: 'text_search' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // Perform vector similarity search
    const { data: products, error } = await supabaseClient.rpc('match_products', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: limit,
    });

    if (error) {
      console.error('Vector search error:', error);
      throw error;
    }

    // Apply additional filters
    let filteredProducts = products;
    if (category) {
      filteredProducts = filteredProducts.filter((p: any) => p.category === category);
    }
    if (minPrice) {
      filteredProducts = filteredProducts.filter((p: any) => p.price >= minPrice);
    }
    if (maxPrice) {
      filteredProducts = filteredProducts.filter((p: any) => p.price <= maxPrice);
    }

    return new Response(
      JSON.stringify({ products: filteredProducts, method: 'semantic_search' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in ai-semantic-search function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
