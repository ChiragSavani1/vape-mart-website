import { Footer, Header } from "../storefront";
import { store } from "../data";
import { loadStoreHours } from "../../db/store-settings";

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const hours=await loadStoreHours();
  const publicHours=[
    ["Monday – Friday",hours.weekdays],
    ["Saturday",hours.saturday],
    ["Sunday",hours.sunday],
  ];
  return <><Header/><main className="subpage"><div className="subpage-wrap">
    <p className="eyebrow">Visit Vape Mart</p><h1>Let’s make your<br/>trip worthwhile.</h1>
    <p className="muted">Check product availability online, then visit us for age-verified, in-person service.</p>
    <div className="contact-grid">
      <section className="contact-card"><h2>Store details</h2><p><b>Address</b><br/>{store.address}</p><p><b>Phone</b><br/><a href={`tel:${store.phone}`}>{store.phone}</a></p><p><b>Email</b><br/><a href={`mailto:${store.email}`}>{store.email}</a></p></section>
      <section className="contact-card"><h2>Opening hours</h2>{publicHours.map(([day,time]) => <div className="hours-row" key={day}><span>{day}</span><b>{time}</b></div>)}<p className="muted">Holiday hours may vary. Contact the store before travelling.</p></section>
    </div>
  </div></main><Footer/></>;
}
