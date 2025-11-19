import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Key, Save } from "lucide-react";

export default function AdminSettings() {
  const { toast } = useToast();
  const [showPaystackKey, setShowPaystackKey] = useState(false);
  const [paystackKey, setPaystackKey] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSavePaystackKey = () => {
    setSaving(true);
    
    // Show instruction to user
    toast({
      title: "Update Paystack Key",
      description: "To update your Paystack secret key, please go to Settings > Secrets in the Lovable Cloud dashboard and update the PAYSTACK_SECRET_KEY value.",
      duration: 8000,
    });
    
    setTimeout(() => {
      setSaving(false);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading-lg">Settings</h1>
        <p className="text-muted-foreground">Manage API keys and integration settings</p>
      </div>

      {/* Paystack Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Paystack Integration
          </CardTitle>
          <CardDescription>
            Configure your Paystack payment gateway. Your secret key is stored securely in Lovable Cloud.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="paystack-secret">Paystack Secret Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="paystack-secret"
                  type={showPaystackKey ? "text" : "password"}
                  value={paystackKey}
                  onChange={(e) => setPaystackKey(e.target.value)}
                  placeholder="sk_live_..."
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPaystackKey(!showPaystackKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPaystackKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <Button onClick={handleSavePaystackKey} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Your Paystack secret key is used to process payments. It's stored securely and never exposed to the client.
            </p>
          </div>

          <div className="pt-4 border-t space-y-2">
            <h4 className="font-medium">How to update your Paystack key:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Go to your Lovable Cloud dashboard</li>
              <li>Navigate to Settings → Secrets</li>
              <li>Update the PAYSTACK_SECRET_KEY value</li>
              <li>Your changes will be applied automatically</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Test Mode Information */}
      <Card>
        <CardHeader>
          <CardTitle>Test vs Live Mode</CardTitle>
          <CardDescription>Understanding Paystack test and live keys</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="flex-1">
                <h4 className="font-medium mb-1">Test Mode</h4>
                <p className="text-sm text-muted-foreground">
                  Use test keys (sk_test_...) for development. Test transactions won't charge real money.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="flex-1">
                <h4 className="font-medium mb-1">Live Mode</h4>
                <p className="text-sm text-muted-foreground">
                  Use live keys (sk_live_...) for production. Real transactions will be processed.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <a
              href="https://dashboard.paystack.com/#/settings/developers"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              Get your Paystack API keys →
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook Configuration</CardTitle>
          <CardDescription>Configure Paystack webhook for payment notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                value={`${window.location.origin}/functions/v1/paystack-webhook`}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/functions/v1/paystack-webhook`);
                  toast({
                    title: "Copied!",
                    description: "Webhook URL copied to clipboard",
                  });
                }}
              >
                Copy
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Add this URL to your Paystack webhook settings to receive payment notifications.
            </p>
          </div>

          <div className="pt-4 border-t">
            <a
              href="https://dashboard.paystack.com/#/settings/webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              Configure webhooks in Paystack →
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
