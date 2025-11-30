import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Minus, Plus, Trash2, ShoppingBag, RefreshCw } from "lucide-react";

const Cart = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<any>(null);

  const fetchCart = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("shopping_cart")
        .select(`
          *,
          products (*)
        `)
        .eq("user_id", user.id);

      if (error) throw error;
      setCartItems(data || []);
    } catch (error) {
      console.error("Error fetching cart:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load cart items",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;
    
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchCart();
  }, [user, authLoading, navigate, fetchCart]);

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;

    try {
      const { error } = await supabase
        .from("shopping_cart")
        .update({ quantity: newQuantity })
        .eq("id", itemId);

      if (error) throw error;
      fetchCart();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("shopping_cart")
        .delete()
        .eq("id", itemId);

      if (error) throw error;
      fetchCart();
      toast({
        title: "Removed from cart",
        description: "Item has been removed from your cart",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const applyDiscount = async () => {
    try {
      const { data, error } = await supabase
        .from("discount_codes")
        .select("*")
        .eq("code", discountCode.toUpperCase())
        .eq("is_active", true)
        .single();

      if (error) throw error;

      // Check validity
      const now = new Date();
      if (new Date(data.valid_until) < now) {
        toast({
          variant: "destructive",
          title: "Invalid code",
          description: "This discount code has expired",
        });
        return;
      }

      if (data.max_uses && data.used_count >= data.max_uses) {
        toast({
          variant: "destructive",
          title: "Invalid code",
          description: "This discount code has reached its usage limit",
        });
        return;
      }

      setAppliedDiscount(data);
      toast({
        title: "Discount applied",
        description: `${data.discount_type === "percentage" ? data.discount_value + "%" : "GH₵ " + data.discount_value} off your order`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Invalid code",
        description: "This discount code is not valid",
      });
    }
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((sum, item) => {
      const price = item.products.discount_price || item.products.price;
      return sum + price * item.quantity;
    }, 0);
  };

  const calculateDiscount = () => {
    if (!appliedDiscount) return 0;

    const subtotal = calculateSubtotal();
    
    if (appliedDiscount.min_purchase_amount && subtotal < appliedDiscount.min_purchase_amount) {
      return 0;
    }

    if (appliedDiscount.discount_type === "percentage") {
      return (subtotal * appliedDiscount.discount_value) / 100;
    } else {
      return appliedDiscount.discount_value;
    }
  };

  const subtotal = calculateSubtotal();
  const discount = calculateDiscount();
  const total = subtotal - discount;

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

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container-custom py-20">
          <div className="max-w-md mx-auto text-center space-y-6">
            <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground" />
            <h2 className="text-heading">Your cart is empty</h2>
            <p className="text-muted-foreground">
              Add some products to get started
            </p>
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

      <div className="container-custom py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-heading-lg">Shopping Cart</h1>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchCart}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh Cart
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map((item) => {
              const product = item.products;
              const price = product.discount_price || product.price;

              return (
                <div
                  key={item.id}
                  className="flex gap-4 p-4 border border-border rounded-lg"
                >
                  <div className="w-24 h-24 bg-secondary rounded-lg overflow-hidden flex-shrink-0">
                    {product.images[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                        No Image
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold mb-1 truncate">
                      {product.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      {product.category}
                    </p>
                    <p className="font-bold">GH₵ {price.toFixed(2)}</p>
                  </div>

                  <div className="flex flex-col items-end justify-between">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>

                    <div className="flex items-center border border-border rounded-md">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-10 text-center text-sm">
                        {item.quantity}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        disabled={item.quantity >= product.stock_quantity}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="border border-border rounded-lg p-6 space-y-6 sticky top-24">
              <h2 className="text-heading">Order Summary</h2>

              {/* Discount Code */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Discount Code</label>
                <div className="flex gap-2">
                  <Input
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value)}
                    placeholder="Enter code"
                    disabled={!!appliedDiscount}
                  />
                  <Button
                    onClick={applyDiscount}
                    variant="outline"
                    disabled={!!appliedDiscount}
                  >
                    Apply
                  </Button>
                </div>
                {appliedDiscount && (
                  <p className="text-sm text-green-600">
                    Discount applied: {appliedDiscount.code}
                  </p>
                )}
              </div>

              <div className="space-y-2 pt-4 border-t border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>GH₵ {subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>-GH₵ {discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-border">
                  <span>Total</span>
                  <span>GH₵ {total.toFixed(2)}</span>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={() => navigate("/checkout")}
              >
                Proceed to Checkout
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/products")}
              >
                Continue Shopping
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
