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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = roles?.some(r => r.role === 'admin' || r.role === 'super_admin');
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { type, keywords, productName, category, brand, tone = 'professional', length = 'medium' } = await req.json();

    let systemPrompt = '';
    let userPrompt = '';

    if (type === 'description') {
      systemPrompt = `You are an expert e-commerce copywriter specializing in creating compelling product descriptions. Generate SEO-friendly content that is ${tone} in tone and ${length} in length (short: 50-100 words, medium: 100-200 words, long: 200-400 words).`;
      userPrompt = `Create a product description for: ${productName}\nCategory: ${category}\nBrand: ${brand}\nKeywords: ${keywords}\n\nInclude benefits, features, and a call-to-action.`;
    } else if (type === 'title') {
      systemPrompt = 'You are an expert at creating catchy, SEO-optimized product titles. Keep titles concise and impactful (under 70 characters).';
      userPrompt = `Generate 3 product title options for:\nProduct: ${productName}\nCategory: ${category}\nKeywords: ${keywords}`;
    } else if (type === 'meta') {
      systemPrompt = 'You are an SEO expert. Create compelling meta descriptions that encourage clicks while staying under 160 characters.';
      userPrompt = `Generate a meta description for:\nProduct: ${productName}\nCategory: ${category}\nKeywords: ${keywords}`;
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid type. Must be: description, title, or meta' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'AI generation failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const generatedContent = aiData.choices[0].message.content;

    // Log generation in audit log
    await supabaseClient.from('audit_logs').insert({
      user_id: user.id,
      action: 'ai_content_generated',
      entity_type: 'product',
      changes: { type, generatedContent },
    });

    return new Response(
      JSON.stringify({ content: generatedContent }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in ai-content-generator function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
