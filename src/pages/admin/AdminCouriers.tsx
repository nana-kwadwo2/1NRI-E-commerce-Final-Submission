import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface Courier {
  id: string;
  name: string;
  email: string;
  phone_number: string;
  vehicle_type: string;
  is_available: boolean;
  rating: number;
  total_deliveries: number;
}

export default function AdminCouriers() {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchCouriers();
  }, []);

  const fetchCouriers = async () => {
    try {
      const { data, error } = await supabase
        .from("courier_riders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCouriers(data || []);
    } catch (error) {
      console.error("Error fetching couriers:", error);
      toast({
        title: "Error",
        description: "Failed to load couriers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading couriers...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Couriers</h1>
          <p className="text-muted-foreground mt-1">
            Manage delivery riders and assignments
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Courier
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {couriers.map((courier) => (
          <Card key={courier.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{courier.name}</CardTitle>
                <Badge
                  variant={courier.is_available ? "default" : "secondary"}
                >
                  {courier.is_available ? "Available" : "Busy"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {courier.vehicle_type}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium truncate ml-2">
                    {courier.email}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="font-medium">{courier.phone_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rating:</span>
                  <span className="font-medium">
                    ⭐ {courier.rating.toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deliveries:</span>
                  <span className="font-medium">{courier.total_deliveries}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
