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
};

export const products: Product[] = [
  { id: "1", slug: "blue-razz-ice-20k", upc: "628242730118", name: "Blue Razz Ice 20K", brand: "STLTH", category: "Disposable", flavour: "Blue Raspberry", price: 34.99, promoPrice: 29.99, accent: "#5c63e8", featured: true, puffCount: "20,000" },
  { id: "2", slug: "peach-mango-ice-20k", upc: "628242730125", name: "Peach Mango Ice 20K", brand: "STLTH", category: "Disposable", flavour: "Peach & Mango", price: 34.99, accent: "#f59655", featured: true, puffCount: "20,000" },
  { id: "3", slug: "watermelon-melon-30k", upc: "628242740186", name: "Watermelon Melon 30K", brand: "Flavour Beast", category: "Disposable", flavour: "Watermelon", price: 39.99, accent: "#ef5a6f", featured: true, puffCount: "30,000" },
  { id: "4", slug: "polar-mint-30k", upc: "628242740193", name: "Polar Mint 30K", brand: "Flavour Beast", category: "Disposable", flavour: "Mint", price: 39.99, accent: "#36bfc0", featured: true, puffCount: "30,000" },
  { id: "5", slug: "strawberry-banana-20mg", upc: "628242750147", name: "Strawberry Banana 20mg", brand: "Vice", category: "E-Liquid", flavour: "Strawberry Banana", price: 24.99, accent: "#e85870" },
  { id: "6", slug: "grape-ice-20mg", upc: "628242750154", name: "Grape Ice 20mg", brand: "Vice", category: "E-Liquid", flavour: "Grape", price: 24.99, accent: "#7655ba" },
  { id: "7", slug: "tropical-punch-pods", upc: "628242760122", name: "Tropical Punch Pods", brand: "Allo", category: "Pods", flavour: "Tropical", price: 18.99, accent: "#f2a43b" },
  { id: "8", slug: "clear-20mg", upc: "628242760139", name: "Clear 20mg", brand: "Z Pods", category: "Pods", flavour: "Unflavoured", price: 16.99, accent: "#8ba7b5" },
];

export const categories = ["All products", "Disposable", "E-Liquid", "Pods"];
export const brands = ["All brands", "STLTH", "Flavour Beast", "Vice", "Allo", "Z Pods"];

export const store = {
  name: "Vape Mart",
  address: "307 — Ontario store address",
  phone: "(000) 000-0000",
  email: "vapemart307@gmail.com",
  hours: [
    ["Monday – Friday", "10:00 AM – 9:00 PM"],
    ["Saturday", "10:00 AM – 8:00 PM"],
    ["Sunday", "11:00 AM – 7:00 PM"],
  ],
};
