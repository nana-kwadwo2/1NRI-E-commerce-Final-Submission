import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const { product_id, user_id, type = 'similar', limit = 5 } = await req.json();

    if (type === 'similar' && !product_id) {
      return new Response(
        JSON.stringify({ error: 'product_id is required for similar recommendations' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (type === 'similar') {
      // Content-based recommendations using embeddings
      const { data: product } = await supabaseClient
        .from('products')
        .select('embedding, category')
        .eq('id', product_id)
        .single();

      if (!product || !product.embedding) {
        // Fallback to category-based recommendations
        const { data: categoryProducts } = await supabaseClient
          .from('products')
          .select('*')
          .eq('category', product?.category || '')
          .eq('is_active', true)
          .neq('id', product_id)
          .limit(limit);

        return new Response(
          JSON.stringify({ recommendations: categoryProducts || [], method: 'category_based' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Vector similarity search
      const { data: similarProducts, error } = await supabaseClient.rpc('match_products', {
        query_embedding: product.embedding,
        match_threshold: 0.75,
        match_count: limit + 1,
      });

      if (error) {
        throw error;
      }

      // Filter out the original product
      const filtered = similarProducts?.filter((p: any) => p.id !== product_id).slice(0, limit);

      return new Response(
        JSON.stringify({ recommendations: filtered || [], method: 'embedding_similarity' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (type === 'personalized' && user_id) {
      // Collaborative filtering based on order history
      const { data: orderHistory } = await supabaseClient
        .from('order_items')
        .select(`
          product_id,
          orders!inner (
            user_id,
            status
          )
        `)
        .eq('orders.user_id', user_id)
        .in('orders.status', ['processing', 'dispatched', 'delivered'])
        .limit(20);

      if (!orderHistory || orderHistory.length === 0) {
        // No history, return bestsellers
        const { data: bestsellers } = await supabaseClient
          .from('products')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(limit);

        return new Response(
          JSON.stringify({ recommendations: bestsellers || [], method: 'bestsellers_fallback' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const purchasedProductIds = orderHistory.map((item: any) => item.product_id);

      // Find products frequently bought together
      const { data: relatedOrders } = await supabaseClient
        .from('order_items')
        .select(`
          product_id,
          products (*)
        `)
        .in('order_id', orderHistory.map((item: any) => item.order_id))
        .not('product_id', 'in', `(${purchasedProductIds.join(',')})`)
        .limit(limit * 2);

      // Count frequency and sort
      const productCounts: { [key: string]: { count: number; product: any } } = {};
      relatedOrders?.forEach((item: any) => {
        const id = item.product_id;
        if (!productCounts[id]) {
          productCounts[id] = { count: 0, product: item.products };
        }
        productCounts[id].count++;
      });

      const recommendations = Object.values(productCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
        .map(item => item.product);

      return new Response(
        JSON.stringify({ recommendations, method: 'collaborative_filtering' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default: bestsellers
    const { data: bestsellers } = await supabaseClient
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    return new Response(
      JSON.stringify({ recommendations: bestsellers || [], method: 'bestsellers' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in ai-recommendations function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
