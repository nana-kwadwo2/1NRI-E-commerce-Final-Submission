import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface LogoUploadProps {
  currentLogoUrl?: string | null;
  onLogoUpdate: (url: string) => void;
}

export const LogoUpload = ({ currentLogoUrl, onLogoUpdate }: LogoUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `logo.${fileExt}`;

      // Delete old logo if exists
      if (currentLogoUrl) {
        const oldPath = currentLogoUrl.split("/logos/")[1];
        if (oldPath) {
          await supabase.storage.from("logos").remove([oldPath]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("logos").getPublicUrl(fileName);

      // Update site settings
      const { error: updateError } = await supabase
        .from("site_settings")
        .update({ logo_url: publicUrl })
        .eq("brand_name", "1NRI");

      if (updateError) throw updateError;

      onLogoUpdate(publicUrl);
      setOpen(false);

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
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="hover:opacity-80 transition-opacity">
          {currentLogoUrl ? (
            <img src={currentLogoUrl} alt="1NRI Logo" className="h-8" />
          ) : (
            <span className="text-heading font-bold">1NRI</span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Logo</DialogTitle>
          <DialogDescription>
            Upload your brand logo. Recommended size: 200x50px (PNG, JPG, SVG)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {currentLogoUrl && (
            <div className="flex justify-center p-4 border rounded-lg">
              <img
                src={currentLogoUrl}
                alt="Current Logo"
                className="max-h-20"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              disabled={uploading}
              className="cursor-pointer"
            />
            <Button type="button" disabled={uploading} variant="outline">
              {uploading ? (
                "Uploading..."
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
