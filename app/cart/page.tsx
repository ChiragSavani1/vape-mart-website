import { Footer, Header } from "../storefront";
import { CartClient } from "./cart-client";

export default function CartPage(){
  return <><Header/><main className="subpage cart-page"><CartClient/></main><Footer/></>;
}
