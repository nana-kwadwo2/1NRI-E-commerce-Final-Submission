import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Header from "@/components/layout/Header";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

const OrderSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reference = searchParams.get("reference");

    console.log("OrderSuccess mounted with reference:", reference);

    if (!reference) {
      console.error("No reference provided in URL");
      setError("Invalid payment reference");
      setLoading(false);
      return;
    }

    verifyPayment(reference);
  }, [searchParams]);

  const verifyPayment = async (reference: string, retryCount = 0) => {
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    try {
      console.log(`Fetching order with reference: ${reference} (attempt ${retryCount + 1}/${maxRetries + 1})`);

      // Fetch order by reference
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (
            *,
            products (*)
          )
        `)
        .eq("order_number", reference)
        .single();

      if (orderError) {
        console.error("Error fetching order:", orderError);

        // If not found and we haven't exceeded retries, try again
        if (orderError.code === 'PGRST116' && retryCount < maxRetries) {
          console.log(`Order not found yet, retrying in ${retryDelay}ms...`);
          setTimeout(() => {
            verifyPayment(reference, retryCount + 1);
          }, retryDelay);
          return;
        }

        setError("Order not found. Please check your orders page or contact support.");
        setLoading(false);
        return;
      }

      if (!orderData) {
        console.error("No order data returned");

        // Retry if we haven't exceeded max attempts
        if (retryCount < maxRetries) {
          console.log(`No data returned, retrying in ${retryDelay}ms...`);
          setTimeout(() => {
            verifyPayment(reference, retryCount + 1);
          }, retryDelay);
          return;
        }

        setError("Order not found. Please check your orders page or contact support.");
        setLoading(false);
        return;
      }

      console.log("Order found successfully:", orderData);
      setOrder(orderData);
      setLoading(false);
      // Cart is already cleared in Checkout.tsx

    } catch (err) {
      console.error("Unexpected error verifying payment:", err);
      setError("Failed to verify payment. Please check your orders page.");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container-custom py-12">
          <div className="max-w-2xl mx-auto text-center">
            <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h1 className="text-heading-lg mb-4">Payment Failed</h1>
            <p className="text-muted-foreground mb-8">{error}</p>
            <Button onClick={() => navigate("/products")}>
              Continue Shopping
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container-custom py-12">
        <div className="max-w-3xl mx-auto">
          {/* Success Header */}
          <div className="text-center mb-8">
            <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-4" />
            <h1 className="text-heading-lg mb-2">Payment Complete!</h1>
            <p className="text-muted-foreground">
              Thank you for your purchase. Your payment has been processed successfully.
            </p>
          </div>

          {/* Order Details */}
          <div className="border border-border rounded-lg p-6 mb-6">
            <h2 className="text-heading mb-4">Order Details</h2>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-muted-foreground">Order Number</p>
                <p className="font-semibold">{order?.order_number}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="font-semibold">GH₵ {order?.total_amount?.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Payment Status</p>
                <p className="font-semibold capitalize">{order?.payment_status}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Order Status</p>
                <p className="font-semibold capitalize">{order?.status}</p>
              </div>
            </div>

            {/* Order Items */}
            <div className="border-t border-border pt-6">
              <h3 className="font-semibold mb-4">Items Ordered</h3>
              <div className="space-y-4">
                {order?.order_items?.map((item: any) => (
                  <div key={item.id} className="flex gap-4">
                    <div className="w-16 h-16 bg-secondary rounded overflow-hidden flex-shrink-0">
                      {item.products?.images?.[0] && (
                        <img
                          src={item.products.images[0]}
                          alt={item.products.name}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{item.products?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Qty: {item.quantity} × GH₵ {item.unit_price?.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        GH₵ {item.subtotal?.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Shipping Address */}
            {order?.shipping_address && (
              <div className="border-t border-border pt-6 mt-6">
                <h3 className="font-semibold mb-2">Shipping Address</h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>{order.shipping_address.full_name}</p>
                  <p>{order.shipping_address.address}</p>
                  <p>
                    {order.shipping_address.city}, {order.shipping_address.state}
                  </p>
                  {order.shipping_address.postal_code && (
                    <p>{order.shipping_address.postal_code}</p>
                  )}
                  <p>{order.shipping_address.phone}</p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-4 justify-center">
            <Button variant="outline" onClick={() => navigate("/orders")}>
              View Orders
            </Button>
            <Button onClick={() => navigate("/products")}>
              Continue Shopping
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccess;
