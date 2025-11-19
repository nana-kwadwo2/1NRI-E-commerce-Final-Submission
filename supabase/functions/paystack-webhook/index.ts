import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!PAYSTACK_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: 'Paystack secret key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Verify Paystack signature
    const signature = req.headers.get('x-paystack-signature');
    const body = await req.text();
    
    const hash = createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(body)
      .digest('hex');

    if (hash !== signature) {
      console.error('Invalid signature');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const event = JSON.parse(body);

    // Check for duplicate webhook (idempotency)
    const { data: existingEvent } = await supabaseClient
      .from('webhook_events')
      .select('id')
      .eq('event_id', event.id)
      .single();

    if (existingEvent) {
      console.log('Duplicate webhook event, skipping');
      return new Response(
        JSON.stringify({ message: 'Event already processed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store webhook event
    await supabaseClient.from('webhook_events').insert({
      event_id: event.id,
      event_type: event.event,
      payload: event,
    });

    if (event.event === 'charge.success') {
      const reference = event.data.reference;

      // Verify transaction with Paystack
      const verifyResponse = await fetch(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          },
        }
      );

      const verifyData = await verifyResponse.json();

      if (!verifyData.status || verifyData.data.status !== 'success') {
        console.error('Transaction verification failed');
        return new Response(
          JSON.stringify({ error: 'Verification failed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update order
      const { data: order, error: orderError } = await supabaseClient
        .from('orders')
        .update({
          payment_status: 'completed',
          payment_reference: reference,
          status: 'processing',
        })
        .eq('order_number', reference)
        .select()
        .single();

      if (orderError) {
        console.error('Error updating order:', orderError);
        return new Response(
          JSON.stringify({ error: 'Failed to update order' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update discount code usage
      if (order.discount_code_used) {
        const { data: currentDiscount } = await supabaseClient
          .from('discount_codes')
          .select('used_count')
          .eq('code', order.discount_code_used)
          .single();

        if (currentDiscount) {
          await supabaseClient
            .from('discount_codes')
            .update({ used_count: currentDiscount.used_count + 1 })
            .eq('code', order.discount_code_used);
        }
      }

      // Confirm stock reservations and reduce stock
      const { data: reservations } = await supabaseClient
        .from('stock_reservations')
        .select('product_id, quantity')
        .eq('order_id', order.id);

      if (reservations) {
        for (const reservation of reservations) {
          const { data: currentProduct } = await supabaseClient
            .from('products')
            .select('stock_quantity')
            .eq('id', reservation.product_id)
            .single();

          if (currentProduct) {
            await supabaseClient
              .from('products')
              .update({
                stock_quantity: currentProduct.stock_quantity - reservation.quantity,
              })
              .eq('id', reservation.product_id);
          }
        }

        // Delete reservations after confirming stock deduction
        await supabaseClient
          .from('stock_reservations')
          .delete()
          .eq('order_id', order.id);
      }

      // Clear user's cart
      await supabaseClient
        .from('shopping_cart')
        .delete()
        .eq('user_id', order.user_id);

      // Generate invoice
      const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      await supabaseClient.from('invoices').insert({
        order_id: order.id,
        invoice_number: invoiceNumber,
        due_date: dueDate.toISOString(),
        status: 'paid',
      });

      console.log('Payment processed successfully for order:', order.order_number);
    }

    return new Response(
      JSON.stringify({ message: 'Webhook processed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in paystack-webhook function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
