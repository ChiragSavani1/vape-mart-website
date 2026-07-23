export type Product = {
  id: string;
  slug: string;
  upc: string;
  name: string;
  brand: string;
  category: string;
  flavour: string;
  price: number;
  promoPrice?: number;
  accent: string;
  featured?: boolean;
  puffCount?: string;
  image?: string;
};

import { importedProducts } from "./products.generated";

export const products: Product[] = importedProducts;
export const categories = ["All products", ...Array.from(new Set(products.map(product => product.category))).sort()];
export const brands = ["All brands", ...Array.from(new Set(products.map(product => product.brand))).sort()];
export const getProductVolume = (product: Product) =>
  product.category === "E-Liquids" ? (product.price < 40 ? "30 mL" : "60 mL") : undefined;

export const store = {
  name: "Vape Mart",
  address: "307 Cundles Road East, Barrie, ON",
  phone: "(705) 721-8181",
  email: "vapemart307@gmail.com",
  hours: [
    ["Monday – Friday", "9:00 AM – 10:00 PM"],
    ["Saturday", "10:00 AM – 8:00 PM"],
    ["Sunday", "10:00 AM – 9:00 PM"],
  ],
};
