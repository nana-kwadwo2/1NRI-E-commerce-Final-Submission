import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";

export interface ProductVariant {
  size?: string;
  color?: string;
  stock_quantity: number;
  sku?: string;
}

interface ProductVariantsProps {
  value: ProductVariant[];
  onChange: (variants: ProductVariant[]) => void;
}

export const ProductVariants = ({ value, onChange }: ProductVariantsProps) => {
  const addVariant = () => {
    onChange([
      ...value,
      { size: "", color: "", stock_quantity: 0, sku: "" },
    ]);
  };

  const removeVariant = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: keyof ProductVariant, val: string | number) => {
    const updated = [...value];
    updated[index] = { ...updated[index], [field]: val };
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base">Product Variants (Size & Color)</Label>
        <Button type="button" onClick={addVariant} variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Variant
        </Button>
      </div>

      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No variants added. Add size/color options for this product.
        </p>
      ) : (
        <div className="space-y-3">
          {value.map((variant, index) => (
            <Card key={index}>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div>
                    <Label htmlFor={`size-${index}`} className="text-sm">
                      Size
                    </Label>
                    <Input
                      id={`size-${index}`}
                      placeholder="e.g., S, M, L"
                      value={variant.size || ""}
                      onChange={(e) =>
                        updateVariant(index, "size", e.target.value)
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor={`color-${index}`} className="text-sm">
                      Color
                    </Label>
                    <Input
                      id={`color-${index}`}
                      placeholder="e.g., Black, Red"
                      value={variant.color || ""}
                      onChange={(e) =>
                        updateVariant(index, "color", e.target.value)
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor={`stock-${index}`} className="text-sm">
                      Stock
                    </Label>
                    <Input
                      id={`stock-${index}`}
                      type="number"
                      min="0"
                      value={variant.stock_quantity}
                      onChange={(e) =>
                        updateVariant(
                          index,
                          "stock_quantity",
                          parseInt(e.target.value) || 0
                        )
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor={`sku-${index}`} className="text-sm">
                      SKU (Optional)
                    </Label>
                    <Input
                      id={`sku-${index}`}
                      placeholder="SKU"
                      value={variant.sku || ""}
                      onChange={(e) =>
                        updateVariant(index, "sku", e.target.value)
                      }
                    />
                  </div>

                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => removeVariant(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
