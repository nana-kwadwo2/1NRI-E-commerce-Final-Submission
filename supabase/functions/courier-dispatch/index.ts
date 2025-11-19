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

    const { action, order_id, courier_id, latitude, longitude, radius_km = 20, auto_assign = false } = await req.json();

    if (action === 'find_couriers') {
      if (!latitude || !longitude) {
        return new Response(
          JSON.stringify({ error: 'latitude and longitude are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch available couriers
      const { data: couriers, error } = await supabaseClient
        .from('courier_riders')
        .select('*')
        .eq('is_available', true);

      if (error) {
        throw error;
      }

      // Calculate distances and score couriers
      const scoredCouriers = couriers
        ?.map((courier: any) => {
          const location = courier.current_location;
          if (!location || !location.lat || !location.lng) {
            return null;
          }

          // Calculate distance using Haversine formula (implemented in DB function)
          const distance = calculateDistanceJS(
            latitude,
            longitude,
            location.lat,
            location.lng
          );

          if (distance > radius_km) {
            return null;
          }

          // Calculate score (lower is better)
          const distanceWeight = 0.5;
          const ratingWeight = 0.3;
          const loadWeight = 0.2;
          const avgSpeed = 30; // km/h

          const score =
            distance * distanceWeight +
            (5 - (courier.rating || 5)) * ratingWeight +
            (courier.total_deliveries % 10) * loadWeight;

          const eta = Math.ceil((distance / avgSpeed) * 60); // minutes

          return {
            ...courier,
            distance_km: parseFloat(distance.toFixed(2)),
            eta_minutes: eta,
            score: parseFloat(score.toFixed(2)),
          };
        })
        .filter((c: any) => c !== null)
        .sort((a: any, b: any) => a.score - b.score)
        .slice(0, 5);

      return new Response(
        JSON.stringify({ couriers: scoredCouriers }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'assign_courier') {
      if (!order_id || !courier_id) {
        return new Response(
          JSON.stringify({ error: 'order_id and courier_id are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update order with assigned courier
      const { data: order, error: orderError } = await supabaseClient
        .from('orders')
        .update({
          assigned_courier_id: courier_id,
          status: 'dispatched',
        })
        .eq('id', order_id)
        .select()
        .single();

      if (orderError) {
        throw orderError;
      }

      // Mark courier as unavailable
      await supabaseClient
        .from('courier_riders')
        .update({ is_available: false })
        .eq('id', courier_id);

      // Log assignment
      await supabaseClient.from('audit_logs').insert({
        user_id: user.id,
        action: 'courier_assigned',
        entity_type: 'order',
        entity_id: order_id,
        changes: { courier_id },
      });

      return new Response(
        JSON.stringify({ message: 'Courier assigned successfully', order }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'complete_delivery') {
      if (!order_id) {
        return new Response(
          JSON.stringify({ error: 'order_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: order } = await supabaseClient
        .from('orders')
        .select('assigned_courier_id')
        .eq('id', order_id)
        .single();

      // Update order status
      await supabaseClient
        .from('orders')
        .update({ status: 'delivered' })
        .eq('id', order_id);

      // Mark courier as available and increment deliveries
      if (order?.assigned_courier_id) {
        const { data: courier } = await supabaseClient
          .from('courier_riders')
          .select('total_deliveries')
          .eq('id', order.assigned_courier_id)
          .single();

        if (courier) {
          await supabaseClient
            .from('courier_riders')
            .update({
              is_available: true,
              total_deliveries: courier.total_deliveries + 1,
            })
            .eq('id', order.assigned_courier_id);
        }
      }

      return new Response(
        JSON.stringify({ message: 'Delivery completed successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in courier-dispatch function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function for distance calculation (Haversine formula)
function calculateDistanceJS(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
