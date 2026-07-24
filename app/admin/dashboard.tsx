"use client";

import { useState } from "react";
import Link from "next/link";
import type { AdminProduct } from "../../db/catalog";

type RequestStatus = "Pending" | "Available" | "Unavailable";
export type AdminInquiry = {
  id:string;
  customer:string;
  contact:string;
  product:string;
  time:string;
  status:RequestStatus;
};
const tabs = ["Overview","Products","Imports","Requests"];

export function AdminDashboard({
  user,
  signOut,
  initialRequests,
  emailConfigured,
  databaseError,
  initialProducts,
}: {
  user:string;
  signOut:string;
  initialRequests:AdminInquiry[];
  emailConfigured:boolean;
  databaseError:string;
  initialProducts:AdminProduct[];
}) {
  const [tab,setTab]=useState("Overview");
  const [products,setProducts]=useState(initialProducts);
  const [requests,setRequests]=useState(initialRequests);
  const [requestError,setRequestError]=useState(databaseError);
  const [importSummary,setImportSummary]=useState<{added:number;updated:number;duplicates:number;hardware:number;review:number}|null>(null);
  const [importing,setImporting]=useState(false);
  const [productQuery,setProductQuery]=useState("");
  const [productCategory,setProductCategory]=useState("All categories");
  const [editing,setEditing]=useState<AdminProduct|Partial<AdminProduct>|null>(null);
  const [savingProduct,setSavingProduct]=useState(false);

  async function importFile(file?:File){
    if(!file)return; setImporting(true);
    const body=new FormData(); body.append("file",file);
    const response=await fetch("/api/admin/import",{method:"POST",body});
    const data=await response.json().catch(()=>null);
    if(!response.ok){setRequestError(data?.error||"The workbook could not be imported.");setImporting(false);return}
    setImportSummary(data.summary);
    const refreshed=await fetch("/api/admin/products").then(result=>result.json()).catch(()=>null);
    if(refreshed?.products)setProducts(refreshed.products);
    setImporting(false);
  }
  async function status(id:string,status:RequestStatus){
    const previous=requests;
    setRequestError("");
    setRequests(rows=>rows.map(r=>r.id===id?{...r,status}:r));
    try{
      const response=await fetch(`/api/admin/inquiries/${id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({status})});
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.error||"The reply could not be saved.");
    }catch(reason){
      setRequests(previous);
      setRequestError(reason instanceof Error?reason.message:"The reply could not be saved.");
    }
  }
  async function saveProduct(product:Partial<AdminProduct>){
    setSavingProduct(true);setRequestError("");
    try{
      const exists=Boolean(product.id);
      const response=await fetch(exists?`/api/admin/products/${product.id}`:"/api/admin/products",{
        method:exists?"PATCH":"POST",headers:{"content-type":"application/json"},body:JSON.stringify(product)
      });
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.error||"The product could not be saved.");
      if(exists)setProducts(rows=>rows.map(row=>row.id===product.id?{...row,...product} as AdminProduct:row));
      else setProducts(rows=>[data.product,...rows]);
      setEditing(null);
    }catch(reason){setRequestError(reason instanceof Error?reason.message:"The product could not be saved.")}
    finally{setSavingProduct(false)}
  }
  async function updateProduct(id:string,patch:Partial<AdminProduct>){
    const previous=products;setProducts(rows=>rows.map(row=>row.id===id?{...row,...patch}:row));
    const response=await fetch(`/api/admin/products/${id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(patch)});
    if(!response.ok){setProducts(previous);const data=await response.json().catch(()=>null);setRequestError(data?.error||"The product change could not be saved.")}
  }
  async function deleteProduct(product:AdminProduct){
    if(!window.confirm(`Delete ${product.name}? This cannot be undone.`))return;
    const response=await fetch(`/api/admin/products/${product.id}`,{method:"DELETE"});
    if(response.ok)setProducts(rows=>rows.filter(row=>row.id!==product.id));
    else setRequestError("The product could not be deleted.");
  }
  const categories=["All categories",...Array.from(new Set(products.map(product=>product.category))).sort()];
  const filteredProducts=products.filter(product=>(productCategory==="All categories"||product.category===productCategory)&&`${product.name} ${product.upc} ${product.brand}`.toLowerCase().includes(productQuery.toLowerCase()));
  return <div className="admin-shell">
    <aside className="admin-side"><Link className="logo" href="/"><span><img src="/brand/vape-mart-logo.png" alt="" /></span> VAPE MART</Link><p>Catalogue admin</p><nav>{tabs.map(item=><button key={item} className={tab===item?"active":""} onClick={()=>setTab(item)}><i>{item.slice(0,1)}</i>{item}</button>)}</nav><div className="admin-profile"><b>{user}</b><small>Administrator</small><a href={signOut}>Sign out</a></div></aside>
    <main className="admin-main"><header className="admin-top"><div><p className="eyebrow">Vape Mart admin</p><h1>{tab}</h1></div><div><Link href="/" target="_blank">View catalogue ↗</Link><button className="admin-primary" onClick={()=>{setTab("Products");setEditing({visible:true,featured:false,price:0})}}>+ Add product</button></div></header>
      {!emailConfigured&&<div className="admin-alert"><b>Email delivery is not configured.</b> Requests are saved here, but Vape Mart and customers will not receive email until a verified mail sender is connected.</div>}
      {requestError&&<div className="admin-alert error" role="alert">{requestError}</div>}
      {tab==="Overview"&&<><div className="metric-grid"><Metric label="Visible products" value={String(products.filter(p=>p.visible).length)} note="Hardware excluded"/><Metric label="Pending requests" value={String(requests.filter(r=>r.status==="Pending").length)} note="Needs a reply" warn/><Metric label="Products with images" value={String(products.filter(p=>p.image).length)} note={`of ${products.length}`}/><Metric label="Import review" value={String(products.filter(p=>p.missingReview).length)} note="Missing from latest file"/></div><div className="admin-grid"><Panel title="Recent availability requests" action={()=>setTab("Requests")} actionLabel="View all">{<RequestTable rows={requests.slice(0,8)} status={status}/>}</Panel><Panel title="Launch status"><div className="health-list"><Health label="Catalogue database" value="Connected" good/><Health label="Cart & tax estimate" value="Live" good/><Health label="Checkout & payment" value="Disabled"/><Health label="Hardware products" value="Excluded" good/></div></Panel></div></>}
      {tab==="Products"&&<Panel title="Product catalogue" action={()=>setEditing({visible:true,featured:false,price:0})} actionLabel="Add product"><div className="admin-toolbar"><input value={productQuery} onChange={event=>setProductQuery(event.target.value)} placeholder="Search by name, UPC, or brand"/><select value={productCategory} onChange={event=>setProductCategory(event.target.value)}>{categories.map(category=><option key={category}>{category}</option>)}</select></div><div className="table-scroll"><table className="admin-table"><thead><tr><th>Product</th><th>UPC</th><th>Price</th><th>Featured</th><th>Visible</th><th>Actions</th></tr></thead><tbody>{filteredProducts.slice(0,300).map(p=><tr key={p.id}><td><span className="mini-art" style={{background:p.accent}}></span><b>{p.name}</b><small>{p.brand} · {p.category}</small></td><td>{p.upc}</td><td>${p.price.toFixed(2)}</td><td><input type="checkbox" checked={!!p.featured} onChange={()=>updateProduct(p.id,{featured:!p.featured})}/></td><td><input type="checkbox" checked={p.visible} onChange={()=>updateProduct(p.id,{visible:!p.visible})}/></td><td><button className="table-action" onClick={()=>setEditing(p)}>Edit</button><button className="table-action danger" onClick={()=>deleteProduct(p)}>Delete</button></td></tr>)}</tbody></table></div><p className="panel-intro">Showing {Math.min(300,filteredProducts.length)} of {filteredProducts.length} matching products. Changes are saved to the live catalogue database.</p></Panel>}
      {tab==="Imports"&&<div className="two-columns"><Panel title="Import RetailzPOS Excel export"><div className="upload-zone"><span>⇧</span><h3>Drop an .xlsx, .xls, or .csv file here</h3><p>Products match by UPC. Hardware is excluded automatically, and missing rows are flagged—not deleted.</p><label className="admin-primary">{importing?"Analysing…":"Choose Excel file"}<input type="file" accept=".xlsx,.xls,.csv" hidden onChange={e=>importFile(e.target.files?.[0])}/></label></div></Panel><Panel title="Last import summary">{importSummary?<div className="summary-grid"><Metric label="Added" value={String(importSummary.added)} note="New UPCs"/><Metric label="Updated" value={String(importSummary.updated)} note="Prices & details"/><Metric label="Duplicates" value={String(importSummary.duplicates)} note="Review required" warn/><Metric label="Hardware skipped" value={String(importSummary.hardware)} note="Automatic"/><Metric label="Missing / review" value={String(importSummary.review)} note="Not deleted"/></div>:<div className="blank"><b>No import in this session</b><p>Upload a RetailzPOS export to see a row-by-row summary.</p></div>}</Panel></div>}
      {tab==="Requests"&&<Panel title="Availability requests"><RequestTable rows={requests} status={status}/></Panel>}
      {editing&&<ProductEditor product={editing} saving={savingProduct} close={()=>setEditing(null)} save={saveProduct}/>}
    </main>
  </div>
}
function Metric({label,value,note,warn}:{label:string,value:string,note:string,warn?:boolean}){return <div className="metric"><span>{label}</span><strong className={warn?"warn":""}>{value}</strong><small>{note}</small></div>}
function Panel({title,children,action,actionLabel}:{title:string;children:React.ReactNode;action?:()=>void;actionLabel?:string}){return <section className="admin-panel"><header><h2>{title}</h2>{actionLabel&&<button onClick={action}>{actionLabel} →</button>}</header>{children}</section>}
function Health({label,value,good}:{label:string,value:string,good?:boolean}){return <div><span>{label}</span><b className={good?"good":""}>{value}</b></div>}
function RequestTable({rows,status}:{rows:AdminInquiry[];status:(id:string,status:RequestStatus)=>void}){
  if(!rows.length)return <div className="blank"><b>No availability requests yet</b><p>New customer requests will appear here automatically.</p></div>;
  return <div className="table-scroll"><table className="admin-table request-table"><thead><tr><th>Request</th><th>Customer</th><th>Product</th><th>Received</th><th>Status / reply</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><b>{r.id}</b></td><td>{r.customer}<small>{r.contact}</small></td><td>{r.product}</td><td>{r.time}</td><td><select value={r.status} onChange={e=>status(r.id,e.target.value as RequestStatus)} className={`status ${r.status.toLowerCase()}`}><option>Pending</option><option>Available</option><option>Unavailable</option></select></td></tr>)}</tbody></table></div>;
}
function ProductEditor({product,saving,close,save}:{product:Partial<AdminProduct>;saving:boolean;close:()=>void;save:(product:Partial<AdminProduct>)=>void}){
  const [draft,setDraft]=useState(product);
  const field=(key:keyof AdminProduct,value:unknown)=>setDraft(current=>({...current,[key]:value}));
  return <div className="modal-backdrop" onMouseDown={close}><div className="admin-editor" onMouseDown={event=>event.stopPropagation()}>
    <button className="modal-close" onClick={close} aria-label="Close">×</button>
    <p className="eyebrow">{draft.id?"Edit product":"New product"}</p><h2>{draft.id?draft.name:"Add a catalogue product"}</h2>
    <form className="admin-form" onSubmit={event=>{event.preventDefault();save(draft)}}>
      <label>Product name<input required value={draft.name||""} onChange={event=>field("name",event.target.value)}/></label>
      <div className="form-row"><label>UPC<input required inputMode="numeric" value={draft.upc||""} disabled={Boolean(draft.id)} onChange={event=>field("upc",event.target.value)}/></label><label>Price<input required min="0" step=".01" type="number" value={draft.price??0} onChange={event=>field("price",Number(event.target.value))}/></label></div>
      <div className="form-row"><label>Brand<input required value={draft.brand||""} onChange={event=>field("brand",event.target.value)}/></label><label>Category<input required value={draft.category||""} onChange={event=>field("category",event.target.value)}/></label></div>
      <label>Flavour / variant<input value={draft.flavour||""} onChange={event=>field("flavour",event.target.value)}/></label>
      <label>Image path<input placeholder="/products/catalog/example.webp" value={draft.image||""} onChange={event=>field("image",event.target.value)}/></label>
      <div className="editor-checks"><label><input type="checkbox" checked={draft.visible!==false} onChange={event=>field("visible",event.target.checked)}/> Visible</label><label><input type="checkbox" checked={Boolean(draft.featured)} onChange={event=>field("featured",event.target.checked)}/> Featured</label></div>
      <button className="admin-primary" disabled={saving}>{saving?"Saving…":"Save product"}</button>
    </form>
  </div></div>
}
