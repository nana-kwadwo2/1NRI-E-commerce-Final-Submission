import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');

interface CheckoutRequest {
  cartItems: Array<{
    product_id: string;
    quantity: number;
  }>;
  shipping_address: {
    full_name: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    country: string;
    postal_code?: string;
  };
  discount_code?: string;
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

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { cartItems, shipping_address, discount_code }: CheckoutRequest = await req.json();

    console.log('Received checkout request:', { 
      cartItemsCount: cartItems?.length,
      cartItems: cartItems,
      hasShippingAddress: !!shipping_address 
    });

    // Validate cart items and check stock
    let totalAmount = 0;
    const orderItems = [];

    for (const item of cartItems) {
      console.log('Processing item:', { product_id: item.product_id, quantity: item.quantity });
      
      const { data: product, error } = await supabaseClient
        .from('products')
        .select('*')
        .eq('id', item.product_id)
        .eq('is_active', true)
        .single();

      if (error || !product) {
        console.error('Product lookup failed:', { item, error });
        return new Response(
          JSON.stringify({ error: `Product ${item.product_id || 'undefined'} not found or inactive` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (product.stock_quantity < item.quantity) {
        return new Response(
          JSON.stringify({ error: `Insufficient stock for ${product.name}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const unitPrice = product.discount_price || product.price;
      const subtotal = unitPrice * item.quantity;
      totalAmount += subtotal;

      orderItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal,
      });
    }

    // Apply discount code if provided
    let discountAmount = 0;
    if (discount_code) {
      const { data: discount, error: discountError } = await supabaseClient
        .from('discount_codes')
        .select('*')
        .eq('code', discount_code)
        .eq('is_active', true)
        .single();

      if (discount && !discountError) {
        const now = new Date();
        const validFrom = new Date(discount.valid_from);
        const validUntil = new Date(discount.valid_until);

        if (now >= validFrom && now <= validUntil) {
          if (!discount.max_uses || discount.used_count < discount.max_uses) {
            if (!discount.min_purchase_amount || totalAmount >= discount.min_purchase_amount) {
              if (discount.discount_type === 'percentage') {
                discountAmount = (totalAmount * discount.discount_value) / 100;
              } else {
                discountAmount = discount.discount_value;
              }
            }
          }
        }
      }
    }

    const finalAmount = totalAmount - discountAmount;

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create order
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .insert({
        user_id: user.id,
        order_number: orderNumber,
        total_amount: finalAmount,
        discount_amount: discountAmount,
        discount_code_used: discount_code || null,
        shipping_address,
        status: 'pending',
        payment_status: 'pending',
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      return new Response(
        JSON.stringify({ error: 'Failed to create order' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create order items
    const orderItemsWithOrderId = orderItems.map(item => ({
      ...item,
      order_id: order.id,
    }));

    const { error: itemsError } = await supabaseClient
      .from('order_items')
      .insert(orderItemsWithOrderId);

    if (itemsError) {
      console.error('Error creating order items:', itemsError);
      return new Response(
        JSON.stringify({ error: 'Failed to create order items' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create stock reservations (15-minute hold)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const reservations = cartItems.map(item => ({
      product_id: item.product_id,
      user_id: user.id,
      quantity: item.quantity,
      expires_at: expiresAt,
      order_id: order.id,
    }));

    await supabaseClient.from('stock_reservations').insert(reservations);

    // Initialize Paystack payment
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .single();

    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: profile?.email || user.email,
        amount: Math.round(finalAmount * 100), // Convert to kobo
        reference: order.order_number,
        callback_url: `${req.headers.get('origin') || Deno.env.get('SITE_URL')}/orders/success`,
        metadata: {
          order_id: order.id,
          user_id: user.id,
        },
      }),
    });

    const paystackData = await paystackResponse.json();

    if (!paystackResponse.ok) {
      console.error('Paystack error:', paystackData);
      return new Response(
        JSON.stringify({ error: 'Payment initialization failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        order,
        payment: paystackData.data,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in paystack-checkout function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
