import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FraudCheckRequest {
  order_id: string;
  device_fingerprint?: string;
  ip_address?: string;
}

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

    const { order_id, device_fingerprint, ip_address }: FraudCheckRequest = await req.json();

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'order_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch order details
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select(`
        *,
        order_items (
          quantity,
          unit_price,
          subtotal
        )
      `)
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let riskScore = 0;
    const flags = [];

    // Rule 1: Check order velocity (multiple orders in short time)
    const { data: recentOrders } = await supabaseClient
      .from('orders')
      .select('id')
      .eq('user_id', order.user_id)
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

    if (recentOrders && recentOrders.length > 3) {
      riskScore += 25;
      flags.push('high_order_velocity');
    }

    // Rule 2: Check for unusually large discount usage
    if (order.discount_amount && order.discount_amount > order.total_amount * 0.5) {
      riskScore += 20;
      flags.push('excessive_discount');
    }

    // Rule 3: Check for high-value first order
    const { data: orderHistory } = await supabaseClient
      .from('orders')
      .select('id')
      .eq('user_id', order.user_id)
      .eq('payment_status', 'completed');

    if ((!orderHistory || orderHistory.length === 0) && order.total_amount > 100000) {
      riskScore += 30;
      flags.push('high_value_first_order');
    }

    // Rule 4: Check for mismatched shipping address (if we had previous orders)
    if (orderHistory && orderHistory.length > 0) {
      const { data: previousOrders } = await supabaseClient
        .from('orders')
        .select('shipping_address')
        .eq('user_id', order.user_id)
        .eq('payment_status', 'completed')
        .limit(5);

      const currentAddress = JSON.stringify(order.shipping_address);
      const hasMatchingAddress = previousOrders?.some(
        (prevOrder: any) => JSON.stringify(prevOrder.shipping_address) === currentAddress
      );

      if (!hasMatchingAddress) {
        riskScore += 15;
        flags.push('new_shipping_address');
      }
    }

    // Rule 5: Check for bulk quantity orders
    const totalQuantity = order.order_items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0;
    if (totalQuantity > 10) {
      riskScore += 10;
      flags.push('bulk_order');
    }

    // Determine risk level and recommendation
    let riskLevel = 'low';
    let recommendation = 'approve';

    if (riskScore >= 50) {
      riskLevel = 'high';
      recommendation = 'block';
    } else if (riskScore >= 30) {
      riskLevel = 'medium';
      recommendation = 'manual_review';
    }

    // Update order with fraud score
    await supabaseClient
      .from('orders')
      .update({
        fraud_risk_score: riskScore,
        fraud_flags: flags,
      })
      .eq('id', order_id);

    // Log fraud check
    await supabaseClient.from('audit_logs').insert({
      action: 'fraud_check_performed',
      entity_type: 'order',
      entity_id: order_id,
      changes: { riskScore, flags, recommendation },
    });

    return new Response(
      JSON.stringify({
        order_id,
        risk_score: riskScore,
        risk_level: riskLevel,
        flags,
        recommendation,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in ai-fraud-detection function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
