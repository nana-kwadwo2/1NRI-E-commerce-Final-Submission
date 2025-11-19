import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

interface ProductCardProps {
  id: string;
  name: string;
  description: string;
  price: number;
  discount_price?: number;
  category: string;
  images: string[];
  stock_quantity: number;
}

const ProductCard = ({ 
  id, 
  name, 
  price, 
  discount_price, 
  category, 
  images,
  stock_quantity 
}: ProductCardProps) => {
  const hasDiscount = discount_price && discount_price < price;
  const isOutOfStock = stock_quantity === 0;

  return (
    <Link to={`/products/${id}`} className="group cursor-pointer">
      <div className="space-y-3">
        {/* Image */}
        <div className="aspect-square bg-secondary rounded-lg overflow-hidden relative">
          {images[0] ? (
            <img
              src={images[0]}
              alt={name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              No Image
            </div>
          )}
          
          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-2">
            {hasDiscount && (
              <Badge variant="default" className="bg-primary text-primary-foreground">
                {Math.round(((price - discount_price) / price) * 100)}% OFF
              </Badge>
            )}
            {isOutOfStock && (
              <Badge variant="secondary" className="bg-destructive text-destructive-foreground">
                Out of Stock
              </Badge>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            {category}
          </p>
          <h3 className="font-semibold group-hover:underline line-clamp-2">
            {name}
          </h3>
          <div className="flex items-center gap-2">
            {hasDiscount ? (
              <>
                <span className="font-bold">GH₵ {discount_price.toFixed(2)}</span>
                <span className="text-sm text-muted-foreground line-through">
                  GH₵ {price.toFixed(2)}
                </span>
              </>
            ) : (
              <span className="font-bold">GH₵ {price.toFixed(2)}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
