"use client";

import { useState } from "react";
import Link from "next/link";
import type { AdminProduct } from "../../db/catalog";
import type { SiteBanner } from "../../db/assets";

type RequestStatus = "Pending" | "Available" | "Unavailable";
export type AdminInquiry = {
  id:string;
  customer:string;
  contact:string;
  product:string;
  time:string;
  status:RequestStatus;
};
const tabs = ["Overview","Products","Imports","Banners","Requests"];

async function compressImage(file:File,maxWidth:number,maxHeight:number,targetBytes:number){
  const source=URL.createObjectURL(file);
  try{
    const image=await new Promise<HTMLImageElement>((resolve,reject)=>{
      const element=new Image();
      element.onload=()=>resolve(element);
      element.onerror=()=>reject(new Error("The selected image could not be read."));
      element.src=source;
    });
    const scale=Math.min(1,maxWidth/image.naturalWidth,maxHeight/image.naturalHeight);
    let width=Math.round(image.naturalWidth*scale);
    let height=Math.round(image.naturalHeight*scale);
    let blob:Blob|null=null;
    for(let attempt=0;attempt<5;attempt++){
      const canvas=document.createElement("canvas");
      canvas.width=Math.max(1,Math.round(width));
      canvas.height=Math.max(1,Math.round(height));
      canvas.getContext("2d")?.drawImage(image,0,0,canvas.width,canvas.height);
      const quality=Math.max(.48,.86-attempt*.1);
      blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",quality));
      if(blob&&blob.size<=targetBytes)break;
      width*=.82;height*=.82;
    }
    if(!blob||blob.size>targetBytes+100_000)throw new Error("This image could not be compressed enough. Please use a simpler image.");
    return new File([blob],`${file.name.replace(/\.[^.]+$/,"")}.webp`,{type:"image/webp"});
  }finally{URL.revokeObjectURL(source)}
}
const compressHeroBanner=(file:File)=>compressImage(file,2400,1400,800_000);
const compressProductImage=(file:File)=>compressImage(file,1400,1400,700_000);

export function AdminDashboard({
  user,
  signOut,
  initialRequests,
  emailConfigured,
  databaseError,
  initialProducts,
  initialBanners,
}: {
  user:string;
  signOut:string;
  initialRequests:AdminInquiry[];
  emailConfigured:boolean;
  databaseError:string;
  initialProducts:AdminProduct[];
  initialBanners:SiteBanner[];
}) {
  const [tab,setTab]=useState("Overview");
  const [products,setProducts]=useState(initialProducts);
  const [requests,setRequests]=useState(initialRequests);
  const [requestError,setRequestError]=useState(databaseError);
  const [importSummary,setImportSummary]=useState<{added:number;updated:number;duplicates:number;hardware:number;review:number;imagesMatched:number;imagesUnmatched:number}|null>(null);
  const [importing,setImporting]=useState(false);
  const [productQuery,setProductQuery]=useState("");
  const [productCategory,setProductCategory]=useState("All categories");
  const [editing,setEditing]=useState<AdminProduct|Partial<AdminProduct>|null>(null);
  const [savingProduct,setSavingProduct]=useState(false);
  const [banners,setBanners]=useState(initialBanners);
  const [uploading,setUploading]=useState(false);

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
  async function uploadBanner(form:HTMLFormElement){
    setUploading(true);setRequestError("");
    try{
      const input=form.elements.namedItem("file") as HTMLInputElement|null;
      const alt=form.elements.namedItem("alt") as HTMLInputElement|null;
      const file=input?.files?.[0];
      if(!file)throw new Error("Choose a banner image.");
      const body=new FormData();
      body.append("file",await compressHeroBanner(file));
      body.append("alt",alt?.value||"Vape Mart promotion");
      const response=await fetch("/api/admin/banners",{method:"POST",body});
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.error||"The banner could not be uploaded.");
      setBanners(data.banners);form.reset();
    }catch(reason){setRequestError(reason instanceof Error?reason.message:"The banner could not be uploaded.")}
    finally{setUploading(false)}
  }
  async function deleteBanner(id:string){
    const response=await fetch(`/api/admin/banners/${id}`,{method:"DELETE"});
    const data=await response.json().catch(()=>null);
    if(response.ok)setBanners(data.banners);else setRequestError(data?.error||"The banner could not be removed.");
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
      {tab==="Imports"&&<div className="two-columns"><Panel title="Import RetailzPOS Excel export"><div className="upload-zone"><span>⇧</span><h3>Drop an .xlsx, .xls, or .csv file here</h3><p>Products match by UPC. New rows are checked against the existing 844-image catalogue by UPC first and normalized product name second. Hardware is excluded automatically, and missing rows are flagged—not deleted.</p><label className="admin-primary">{importing?"Analysing…":"Choose Excel file"}<input type="file" accept=".xlsx,.xls,.csv" hidden onChange={e=>importFile(e.target.files?.[0])}/></label></div></Panel><Panel title="Last import summary">{importSummary?<div className="summary-grid"><Metric label="Added" value={String(importSummary.added)} note="New UPCs"/><Metric label="Updated" value={String(importSummary.updated)} note="Prices & details"/><Metric label="Images found" value={String(importSummary.imagesMatched)} note="Matched automatically"/><Metric label="Need an image" value={String(importSummary.imagesUnmatched)} note="New products to review" warn={importSummary.imagesUnmatched>0}/><Metric label="Duplicates" value={String(importSummary.duplicates)} note="Review required" warn/><Metric label="Hardware skipped" value={String(importSummary.hardware)} note="Automatic"/><Metric label="Missing / review" value={String(importSummary.review)} note="Not deleted"/></div>:<div className="blank"><b>No import in this session</b><p>Upload a RetailzPOS export to see product and automatic-image matching results.</p></div>}</Panel></div>}
      {tab==="Banners"&&<><Panel title={`Hero banners (${banners.length}/6)`}><form className="banner-upload" onSubmit={event=>{event.preventDefault();uploadBanner(event.currentTarget)}}><label>Banner image<input name="file" type="file" accept="image/*" required disabled={banners.length>=6}/></label><label>Accessible description<input name="alt" placeholder="New arrival promotion" required/></label><button className="admin-primary" disabled={uploading||banners.length>=6}>{uploading?"Uploading…":"Upload banner"}</button></form><p className="panel-intro">{banners.length?"These banners replace the default hero rotation. Delete all custom banners to restore the original three.":"No custom banners uploaded. The original three banners are currently shown."}</p><div className="banner-admin-grid">{banners.map(banner=><article key={banner.id}><img src={banner.src} alt=""/><div><b>{banner.alt}</b><button onClick={()=>deleteBanner(banner.id)}>Remove</button></div></article>)}</div></Panel></>}
      {tab==="Requests"&&<Panel title="Availability requests"><RequestTable rows={requests} status={status}/></Panel>}
      {editing&&<ProductEditor product={editing} saving={savingProduct} close={()=>setEditing(null)} save={saveProduct} imageUploaded={(id,image)=>setProducts(rows=>rows.map(row=>row.id===id?{...row,image}:row))}/>}
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
function ProductEditor({product,saving,close,save,imageUploaded}:{product:Partial<AdminProduct>;saving:boolean;close:()=>void;save:(product:Partial<AdminProduct>)=>void;imageUploaded:(id:string,image:string)=>void}){
  const [draft,setDraft]=useState(product);
  const [uploadingImage,setUploadingImage]=useState(false);
  const [imageError,setImageError]=useState("");
  const field=(key:keyof AdminProduct,value:unknown)=>setDraft(current=>({...current,[key]:value}));
  async function uploadImage(file?:File){
    if(!file||!draft.id)return;
    setUploadingImage(true);setImageError("");
    try{
      const body=new FormData();
      body.append("file",await compressProductImage(file));
      const response=await fetch(`/api/admin/products/${draft.id}/image`,{method:"POST",body});
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.error||"The product image could not be uploaded.");
      field("image",data.image);imageUploaded(draft.id,data.image);
    }catch(reason){setImageError(reason instanceof Error?reason.message:"The product image could not be uploaded.")}
    finally{setUploadingImage(false)}
  }
  return <div className="modal-backdrop" onMouseDown={close}><div className="admin-editor" onMouseDown={event=>event.stopPropagation()}>
    <button className="modal-close" onClick={close} aria-label="Close">×</button>
    <p className="eyebrow">{draft.id?"Edit product":"New product"}</p><h2>{draft.id?draft.name:"Add a catalogue product"}</h2>
    <form className="admin-form" onSubmit={event=>{event.preventDefault();save(draft)}}>
      <label>Product name<input required value={draft.name||""} onChange={event=>field("name",event.target.value)}/></label>
      <div className="form-row"><label>UPC<input required inputMode="numeric" value={draft.upc||""} disabled={Boolean(draft.id)} onChange={event=>field("upc",event.target.value)}/></label><label>Price<input required min="0" step=".01" type="number" value={draft.price??0} onChange={event=>field("price",Number(event.target.value))}/></label></div>
      <div className="form-row"><label>Brand<input required value={draft.brand||""} onChange={event=>field("brand",event.target.value)}/></label><label>Category<input required value={draft.category||""} onChange={event=>field("category",event.target.value)}/></label></div>
      <label>Flavour / variant<input value={draft.flavour||""} onChange={event=>field("flavour",event.target.value)}/></label>
      <div className="product-image-editor">
        <div className="product-image-preview">{draft.image?<img src={draft.image} alt="Current product"/>:<span>Placeholder currently shown</span>}</div>
        <div><b>Product image</b><p>Upload a clear, front-facing product image. It will replace the current image or placeholder.</p>
          {draft.id?<label className="admin-primary">{uploadingImage?"Uploading…":draft.image?"Change image":"Upload image"}<input type="file" accept="image/*" hidden disabled={uploadingImage} onChange={event=>uploadImage(event.target.files?.[0])}/></label>:<small>Save the new product first, then reopen it to upload its image.</small>}
          {imageError&&<p className="field-error">{imageError}</p>}
        </div>
      </div>
      <div className="editor-checks"><label><input type="checkbox" checked={draft.visible!==false} onChange={event=>field("visible",event.target.checked)}/> Visible</label><label><input type="checkbox" checked={Boolean(draft.featured)} onChange={event=>field("featured",event.target.checked)}/> Featured</label></div>
      <button className="admin-primary" disabled={saving}>{saving?"Saving…":"Save product"}</button>
    </form>
  </div></div>
}
