import { Link } from "react-router-dom";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: number;
    discount_price?: number;
    category: string;
    images?: string[];
    stock_quantity: number;
  };
}

const ProductCard = ({ product }: ProductCardProps) => {
  const displayPrice = product.discount_price || product.price;
  const hasDiscount = product.discount_price && product.discount_price < product.price;

  return (
    <Link to={`/products/${product.id}`} className="group">
      <div className="aspect-square bg-secondary rounded-lg overflow-hidden mb-4">
        <img
          src={product.images?.[0] || "/placeholder.svg"}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{product.category}</p>
        <h3 className="font-semibold group-hover:underline">{product.name}</h3>
        
        <div className="flex items-center gap-2">
          <span className="font-bold">GH₵ {displayPrice.toFixed(2)}</span>
          {hasDiscount && (
            <span className="text-sm text-muted-foreground line-through">
              GH₵ {product.price.toFixed(2)}
            </span>
          )}
        </div>

        {product.stock_quantity === 0 && (
          <p className="text-sm text-destructive">Out of Stock</p>
        )}
      </div>
    </Link>
  );
};

export default ProductCard;
