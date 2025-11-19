import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { ArrowRight, Facebook, Instagram, Twitter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();
  const [heroImage, setHeroImage] = useState<string | null>(null);
  const [aboutText, setAboutText] = useState<string>("");
  const [socialLinks, setSocialLinks] = useState<any>({});
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    fetchSiteSettings();
    fetchCategories();
  }, []);

  const fetchSiteSettings = async () => {
    const { data } = await supabase
      .from("site_settings")
      .select("hero_image_url, about_text, social_links")
      .single();
    
    if (data) {
      if (data.hero_image_url) setHeroImage(data.hero_image_url);
      if (data.about_text) setAboutText(data.about_text);
      if (data.social_links) setSocialLinks(data.social_links);
    }
  };

  const fetchCategories = async () => {
    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("is_active", true);
    
    if (data) setCategories(data);
  };

  const scrollToCategories = () => {
    document.getElementById('categories')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section 
        className="relative h-[80vh] flex items-center justify-center"
        style={{
          backgroundImage: heroImage ? `url(${heroImage})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: heroImage ? 'transparent' : 'hsl(var(--muted))'
        }}
      >
        {heroImage && <div className="absolute inset-0 bg-black/40" />}
        <div className="relative z-10 text-center space-y-6">
          <Button 
            size="lg" 
            className="text-lg px-8 py-6" 
            onClick={() => navigate("/products")}
          >
            Shop Now
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <div>
            <Button 
              variant="outline" 
              size="lg"
              className="text-lg px-8 py-6 bg-background/80 backdrop-blur-sm"
              onClick={scrollToCategories}
            >
              Explore Categories
            </Button>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section id="categories" className="py-16 bg-muted/30">
        <div className="container-custom">
          <h2 className="text-heading-lg mb-8 text-center">Shop by Category</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => navigate(`/products?category=${category.name}`)}
                className="group p-6 bg-card border border-border rounded-lg hover:shadow-lg transition-all hover:scale-105"
              >
                <h3 className="text-heading text-center group-hover:text-primary transition-colors">
                  {category.name}
                </h3>
                {category.description && (
                  <p className="text-sm text-muted-foreground mt-2 text-center">
                    {category.description}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      {aboutText && (
        <section className="py-16">
          <div className="container-custom max-w-3xl text-center">
            <h2 className="text-heading-lg mb-6">About Our Brand</h2>
            <p className="text-body text-muted-foreground whitespace-pre-wrap">
              {aboutText}
            </p>
          </div>
        </section>
      )}

      {/* Social Links */}
      {(socialLinks.facebook || socialLinks.instagram || socialLinks.twitter || socialLinks.tiktok) && (
        <section className="py-12 bg-muted/30">
          <div className="container-custom">
            <h3 className="text-heading text-center mb-6">Follow Us</h3>
            <div className="flex justify-center gap-6">
              {socialLinks.facebook && (
                <a
                  href={socialLinks.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 bg-card border border-border rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <Facebook className="h-6 w-6" />
                </a>
              )}
              {socialLinks.instagram && (
                <a
                  href={socialLinks.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 bg-card border border-border rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <Instagram className="h-6 w-6" />
                </a>
              )}
              {socialLinks.twitter && (
                <a
                  href={socialLinks.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 bg-card border border-border rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <Twitter className="h-6 w-6" />
                </a>
              )}
              {socialLinks.tiktok && (
                <a
                  href={socialLinks.tiktok}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 bg-card border border-border rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                  </svg>
                </a>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default Index;
