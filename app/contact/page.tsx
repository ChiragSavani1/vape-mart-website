import { Footer, Header } from "../storefront";
import { store } from "../data";

export default function ContactPage() {
  return <><Header/><main className="subpage"><div className="subpage-wrap">
    <p className="eyebrow">Visit Vape Mart</p><h1>Let’s make your<br/>trip worthwhile.</h1>
    <p className="muted">Check product availability online, then visit us for age-verified, in-person service.</p>
    <div className="contact-store-photo"><img src="/brand/vape-mart-store.webp" alt="Vape Mart logo on the Barrie store entrance"/></div>
    <div className="contact-grid">
      <section className="contact-card"><h2>Store details</h2><p><b>Address</b><br/>{store.address}</p><p><b>Phone</b><br/><a href={`tel:${store.phone}`}>{store.phone}</a></p><p><b>Email</b><br/><a href={`mailto:${store.email}`}>{store.email}</a></p></section>
      <section className="contact-card"><h2>Opening hours</h2>{store.hours.map(([day,time]) => <div className="hours-row" key={day}><span>{day}</span><b>{time}</b></div>)}<p className="muted">Holiday hours may vary. Contact the store before travelling.</p></section>
    </div>
  </div></main><Footer/></>;
}
