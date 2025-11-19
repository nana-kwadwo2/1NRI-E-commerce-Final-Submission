import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

interface ProductFiltersProps {
  categories: string[];
  selectedCategory: string | null;
  selectedSort: string;
  minPrice: string | null;
  maxPrice: string | null;
  onFilterChange: (filters: Record<string, string>) => void;
}

const ProductFilters = ({
  categories,
  selectedCategory,
  selectedSort,
  minPrice,
  maxPrice,
  onFilterChange,
}: ProductFiltersProps) => {
  const [priceRange, setPriceRange] = useState([
    minPrice ? parseFloat(minPrice) : 0,
    maxPrice ? parseFloat(maxPrice) : 500,
  ]);

  const handleCategoryChange = (category: string) => {
    if (category === "all") {
      onFilterChange({ category: "" });
    } else {
      onFilterChange({ category });
    }
  };

  const handleSortChange = (sort: string) => {
    onFilterChange({ sort });
  };

  const handlePriceChange = () => {
    onFilterChange({
      minPrice: priceRange[0].toString(),
      maxPrice: priceRange[1].toString(),
    });
  };

  const clearFilters = () => {
    setPriceRange([0, 500]);
    onFilterChange({
      category: "",
      minPrice: "",
      maxPrice: "",
      sort: "newest",
    });
  };

  return (
    <div className="space-y-6 border border-border rounded-lg p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Filters</h3>
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear All
        </Button>
      </div>

      {/* Sort */}
      <div className="space-y-2">
        <Label>Sort By</Label>
        <Select value={selectedSort} onValueChange={handleSortChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="price-asc">Price: Low to High</SelectItem>
            <SelectItem value="price-desc">Price: High to Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Categories */}
      <div className="space-y-2">
        <Label>Category</Label>
        <div className="space-y-2">
          <button
            onClick={() => handleCategoryChange("all")}
            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
              !selectedCategory
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent"
            }`}
          >
            All Products
          </button>
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => handleCategoryChange(category)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                selectedCategory === category
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div className="space-y-4">
        <Label>Price Range</Label>
        <div className="px-2">
          <Slider
            value={priceRange}
            onValueChange={setPriceRange}
            max={500}
            step={10}
            className="mb-4"
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>GH₵ {priceRange[0]}</span>
          <span>GH₵ {priceRange[1]}</span>
        </div>
        <Button onClick={handlePriceChange} className="w-full" size="sm">
          Apply Price Filter
        </Button>
      </div>
    </div>
  );
};

export default ProductFilters;
