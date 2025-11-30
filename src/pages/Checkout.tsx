import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

const Checkout = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [shippingAddress, setShippingAddress] = useState({
    full_name: "",
    phone: "",
    street: "",
    city: "",
    region: "",
    postal_code: "",
  });

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;

    if (!user) {
      navigate("/auth");
      return;
    }
    fetchData();
  }, [user, authLoading, navigate]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch cart items
      const { data: cartData, error: cartError } = await supabase
        .from("shopping_cart")
        .select("*")
        .eq("user_id", user.id);

      if (cartError) throw cartError;

      if (!cartData || cartData.length === 0) {
        navigate("/cart");
        return;
      }

      // Fetch product details for all cart items
      const productIds = cartData.map(item => item.product_id);
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("*")
        .in("id", productIds);

      if (productsError) throw productsError;

      // Merge cart items with product details
      const mergedData = cartData.map(cartItem => ({
        ...cartItem,
        products: productsData?.find(p => p.id === cartItem.product_id) || null
      })).filter(item => item.products !== null);

      setCartItems(mergedData);

      // Fetch profile for prefill
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        setShippingAddress((prev) => ({
          ...prev,
          full_name: profile.full_name || "",
          phone: profile.phone_number || "",
        }));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load checkout data",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => {
      const price = item.products.discount_price || item.products.price;
      return sum + price * item.quantity;
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Get user email
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Please sign in to continue",
        });
        navigate("/auth");
        return;
      }

      // Calculate total
      const totalAmount = calculateTotal();

      // Generate order number
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Prepare cart items for order
      const orderItems = cartItems.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.products.discount_price || item.products.price,
        subtotal: (item.products.discount_price || item.products.price) * item.quantity,
      }));

      // Create order in database
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: currentUser.id,
          order_number: orderNumber,
          total_amount: totalAmount,
          discount_amount: 0,
          shipping_address: {
            full_name: shippingAddress.full_name,
            phone: shippingAddress.phone,
            address: shippingAddress.street,
            city: shippingAddress.city,
            state: shippingAddress.region,
            country: "Ghana",
            postal_code: shippingAddress.postal_code,
          },
          status: "pending",
          payment_status: "pending",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItemsWithOrderId = orderItems.map(item => ({
        ...item,
        order_id: order.id,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItemsWithOrderId);

      if (itemsError) throw itemsError;

      // Initialize Paystack payment
      const paystackConfig = {
        email: currentUser.email || "",
        amount: Math.round(totalAmount * 100), // Convert to kobo
        reference: orderNumber,
        metadata: {
          order_id: order.id,
          user_id: currentUser.id,
        },
      };

      // Import and use PaystackButton dynamically
      const { usePaystackPayment } = await import('react-paystack');
      const initializePayment = usePaystackPayment({
        ...paystackConfig,
        publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '',
      });

      const onSuccess = async (reference: any) => {
        try {
          // Update order status
          await supabase
            .from("orders")
            .update({
              payment_status: "completed",
              payment_reference: reference.reference,
              status: "processing",
            })
            .eq("id", order.id);

          // Reduce stock
          for (const item of cartItems) {
            const { data: product } = await supabase
              .from("products")
              .select("stock_quantity")
              .eq("id", item.product_id)
              .single();

            if (product) {
              await supabase
                .from("products")
                .update({
                  stock_quantity: product.stock_quantity - item.quantity,
                })
                .eq("id", item.product_id);
            }
          }

          // Clear cart
          await supabase
            .from("shopping_cart")
            .delete()
            .eq("user_id", currentUser.id);

          toast({
            title: "Payment Successful",
            description: "Your order has been placed successfully",
          });

          navigate(`/orders/success?reference=${orderNumber}`);
        } catch (error: any) {
          console.error("Error processing payment:", error);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Payment successful but order update failed. Please contact support.",
          });
        }
      };

      const onClose = () => {
        setSubmitting(false);
        toast({
          title: "Payment Cancelled",
          description: "You can retry payment from your orders page",
        });
      };

      // Trigger payment popup
      initializePayment(onSuccess, onClose);

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to initialize payment",
      });
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  const total = calculateTotal();

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container-custom py-8">
        <h1 className="text-heading-lg mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Shipping Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="border border-border rounded-lg p-6 space-y-4">
                <h2 className="text-heading">Shipping Information</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name *</Label>
                    <Input
                      id="full_name"
                      value={shippingAddress.full_name}
                      onChange={(e) =>
                        setShippingAddress({
                          ...shippingAddress,
                          full_name: e.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={shippingAddress.phone}
                      onChange={(e) =>
                        setShippingAddress({
                          ...shippingAddress,
                          phone: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="street">Street Address *</Label>
                  <Input
                    id="street"
                    value={shippingAddress.street}
                    onChange={(e) =>
                      setShippingAddress({
                        ...shippingAddress,
                        street: e.target.value,
                      })
                    }
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      value={shippingAddress.city}
                      onChange={(e) =>
                        setShippingAddress({
                          ...shippingAddress,
                          city: e.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="region">Region *</Label>
                    <Input
                      id="region"
                      value={shippingAddress.region}
                      onChange={(e) =>
                        setShippingAddress({
                          ...shippingAddress,
                          region: e.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="postal_code">Postal Code</Label>
                    <Input
                      id="postal_code"
                      value={shippingAddress.postal_code}
                      onChange={(e) =>
                        setShippingAddress({
                          ...shippingAddress,
                          postal_code: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                Place Order
              </Button>
            </form>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="border border-border rounded-lg p-6 space-y-4 sticky top-24">
              <h2 className="text-heading">Order Summary</h2>

              <div className="space-y-3">
                {cartItems.map((item) => {
                  const product = item.products;
                  const price = product.discount_price || product.price;

                  return (
                    <div key={item.id} className="flex gap-3 text-sm">
                      <div className="w-12 h-12 bg-secondary rounded overflow-hidden flex-shrink-0">
                        {product.images[0] && (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{product.name}</p>
                        <p className="text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          GH₵ {(price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-border space-y-2">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>GH₵ {total.toFixed(2)}</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                By placing this order, you agree to our terms and conditions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
