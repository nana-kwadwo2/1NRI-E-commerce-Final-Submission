import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Loader2 } from "lucide-react";

export default function AdminCustomization() {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [aboutText, setAboutText] = useState("");
  const [socialLinks, setSocialLinks] = useState({
    facebook: "",
    instagram: "",
    twitter: "",
    tiktok: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .single();

      if (error) throw error;

      setLogoUrl(data.logo_url);
      setHeroImageUrl(data.hero_image_url);
      setAboutText(data.about_text || "");
      if (data.social_links && typeof data.social_links === 'object' && !Array.isArray(data.social_links)) {
        const links = data.social_links as Record<string, string>;
        setSocialLinks({
          facebook: links.facebook || "",
          instagram: links.instagram || "",
          twitter: links.twitter || "",
          tiktok: links.tiktok || "",
        });
      }
    } catch (error: any) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading("logo");

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `logo.${fileExt}`;

      if (logoUrl) {
        const oldPath = logoUrl.split("/logos/")[1];
        if (oldPath) {
          await supabase.storage.from("logos").remove([oldPath]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("logos")
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("site_settings")
        .update({ logo_url: publicUrl })
        .eq("brand_name", "1NRI");

      if (updateError) throw updateError;

      setLogoUrl(publicUrl);

      toast({
        title: "Success",
        description: "Logo updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(null);
    }
  };

  const handleHeroImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading("hero");

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `hero-${Date.now()}.${fileExt}`;

      if (heroImageUrl) {
        const oldPath = heroImageUrl.split("/logos/")[1];
        if (oldPath) {
          await supabase.storage.from("logos").remove([oldPath]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("logos")
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("site_settings")
        .update({ hero_image_url: publicUrl })
        .eq("brand_name", "1NRI");

      if (updateError) throw updateError;

      setHeroImageUrl(publicUrl);

      toast({
        title: "Success",
        description: "Hero image updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(null);
    }
  };

  const handleSaveContent = async () => {
    try {
      const { error } = await supabase
        .from("site_settings")
        .update({ 
          about_text: aboutText,
          social_links: socialLinks,
        })
        .eq("brand_name", "1NRI");

      if (error) throw error;

      toast({
        title: "Success",
        description: "Content updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Store Customization</h1>
        <p className="text-muted-foreground">Customize your store's appearance and branding</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Logo</CardTitle>
            <CardDescription>Upload your store logo (recommended: 200x50px)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {logoUrl && (
              <div className="flex justify-center p-4 border rounded-lg bg-muted/30">
                <img src={logoUrl} alt="Store Logo" className="max-h-20" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                disabled={uploading === "logo"}
                className="cursor-pointer"
              />
              <Button type="button" disabled={uploading === "logo"} variant="outline">
                {uploading === "logo" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hero Image</CardTitle>
            <CardDescription>Upload your homepage hero background image (recommended: 1920x800px)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {heroImageUrl && (
              <div className="flex justify-center p-4 border rounded-lg bg-muted/30">
                <img src={heroImageUrl} alt="Hero Background" className="max-h-40 w-full object-cover rounded" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/*"
                onChange={handleHeroImageUpload}
                disabled={uploading === "hero"}
                className="cursor-pointer"
              />
              <Button type="button" disabled={uploading === "hero"} variant="outline">
                {uploading === "hero" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>About the Brand</CardTitle>
            <CardDescription>Share your brand story on the homepage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={aboutText}
              onChange={(e) => setAboutText(e.target.value)}
              placeholder="Tell your brand story here..."
              rows={6}
              className="resize-none"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Social Media Links</CardTitle>
            <CardDescription>Add links to your social media profiles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="facebook">Facebook</Label>
                <Input
                  id="facebook"
                  type="url"
                  placeholder="https://facebook.com/yourbrand"
                  value={socialLinks.facebook}
                  onChange={(e) => setSocialLinks({...socialLinks, facebook: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram</Label>
                <Input
                  id="instagram"
                  type="url"
                  placeholder="https://instagram.com/yourbrand"
                  value={socialLinks.instagram}
                  onChange={(e) => setSocialLinks({...socialLinks, instagram: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="twitter">Twitter</Label>
                <Input
                  id="twitter"
                  type="url"
                  placeholder="https://twitter.com/yourbrand"
                  value={socialLinks.twitter}
                  onChange={(e) => setSocialLinks({...socialLinks, twitter: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tiktok">TikTok</Label>
                <Input
                  id="tiktok"
                  type="url"
                  placeholder="https://tiktok.com/@yourbrand"
                  value={socialLinks.tiktok}
                  onChange={(e) => setSocialLinks({...socialLinks, tiktok: e.target.value})}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSaveContent} size="lg">
            Save Content Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
