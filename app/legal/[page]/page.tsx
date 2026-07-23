import { notFound } from "next/navigation";
import { Footer, Header } from "../../storefront";

const pages: Record<string, { title: string; intro: string; sections: [string,string][] }> = {
  privacy: { title: "Privacy policy", intro: "How Vape Mart handles information submitted through this catalogue.", sections: [
    ["Information we collect","When you submit an availability request, we collect your name, email address or phone number, the product requested, and technical information used for spam prevention."],
    ["How we use it","We use your information only to respond to your request, operate the admin workflow, prevent abuse, and maintain our records. Product cost data is never exposed to catalogue visitors."],
    ["Retention and contact","Requests are retained only as long as reasonably necessary for customer service and legal obligations. To request access or deletion, email vapemart307@gmail.com."],
  ]},
  terms: { title: "Terms of use", intro: "The conditions that apply when browsing the Vape Mart website.", sections: [
    ["Catalogue only","This website provides product information and in-store availability inquiries. It does not offer online ordering, reservations, checkout, payment, shipping, or delivery."],
    ["Prices and availability","Prices, promotions, product details, and availability may change without notice. A positive availability response is not a reservation and does not guarantee stock at arrival."],
    ["Responsible use","You may not misuse the website, attempt unauthorized access, submit false requests, or interfere with site operation."],
  ]},
  "age-restriction": { title: "Age restriction", intro: "Vape Mart is intended only for adults of legal age.", sections: [
    ["Ontario 19+","You must be at least 19 years old to enter this website or purchase vaping products in Ontario. Valid government-issued identification may be required in store."],
    ["No sales to minors","We do not sell or supply vaping products to minors. The age gate is a notice and does not replace in-store age verification."],
    ["Leave the site","If you are under 19, do not browse this catalogue or submit an availability request."],
  ]},
  warnings: { title: "Vaping warnings", intro: "Important health and legal information for customers in Ontario and Canada.", sections: [
    ["Nicotine warning","Vaping products may contain nicotine. Nicotine is highly addictive. Vaping is not harmless and may expose you to chemicals that could affect your health."],
    ["Health advice","Non-smokers, people who are pregnant or breastfeeding, and young people should not vape. Keep all vaping products away from children and pets."],
    ["Learn more","For current public-health information, consult Health Canada and the Government of Ontario. Product packaging and in-store notices provide additional required warnings."],
  ]},
};

export function generateStaticParams(){ return Object.keys(pages).map(page => ({ page })); }
export default async function LegalPage({ params }: { params: Promise<{page:string}> }) {
  const { page } = await params; const content = pages[page]; if (!content) notFound();
  return <><Header/><main className="subpage"><div className="subpage-wrap"><p className="eyebrow">Legal & responsible retailing</p><h1>{content.title}</h1><p className="muted">{content.intro}</p><article className="legal-copy">{content.sections.map(([title,copy]) => <section key={title}><h2>{title}</h2><p>{copy}</p></section>)}</article></div></main><Footer/></>;
}
