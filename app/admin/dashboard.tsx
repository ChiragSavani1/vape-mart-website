"use client";

import { useState } from "react";
import Link from "next/link";
import type { AdminProduct } from "../../db/catalog";
import type { SiteBanner } from "../../db/assets";
import type { StoreHours } from "../data";
import type { ImageWorkflowItem } from "../../db/image-workflow";

type RequestStatus = "Pending" | "Available" | "Unavailable";
export type AdminInquiry = {
  id:string;
  customer:string;
  contact:string;
  product:string;
  time:string;
  status:RequestStatus;
};
const tabs = ["Overview","Products","Image Archive","Imports","Banners","Store Hours","Requests"];

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
  initialStoreHours,
  initialImageWorkflow,
}: {
  user:string;
  signOut:string;
  initialRequests:AdminInquiry[];
  emailConfigured:boolean;
  databaseError:string;
  initialProducts:AdminProduct[];
  initialBanners:SiteBanner[];
  initialStoreHours:StoreHours;
  initialImageWorkflow:ImageWorkflowItem[];
}) {
  const [tab,setTab]=useState("Overview");
  const [products,setProducts]=useState(initialProducts);
  const [requests,setRequests]=useState(initialRequests);
  const [requestError,setRequestError]=useState(databaseError);
  const [requestNotice,setRequestNotice]=useState("");
  const [importSummary,setImportSummary]=useState<{added:number;updated:number;duplicates:number;hardware:number;review:number;imagesMatched:number;imagesUnmatched:number;skippedRows:number;totalRows:number}|null>(null);
  const [importing,setImporting]=useState(false);
  const [productQuery,setProductQuery]=useState("");
  const [productCategory,setProductCategory]=useState("All categories");
  const [editing,setEditing]=useState<AdminProduct|Partial<AdminProduct>|null>(null);
  const [savingProduct,setSavingProduct]=useState(false);
  const [banners,setBanners]=useState(initialBanners);
  const [uploading,setUploading]=useState(false);
  const [searchingImages,setSearchingImages]=useState(false);
  const [imageSearchSummary,setImageSearchSummary]=useState("");
  const [storeHours,setStoreHours]=useState(initialStoreHours);
  const [savingHours,setSavingHours]=useState(false);
  const [imageWorkflow,setImageWorkflow]=useState(initialImageWorkflow);
  const [archivingImages,setArchivingImages]=useState(false);
  const [cleaningArchive,setCleaningArchive]=useState(false);
  const [archiveConfirmation,setArchiveConfirmation]=useState<{action:"dismiss"|"dismiss_all_verified";item?:ImageWorkflowItem}|null>(null);
  const [replacementBannerId,setReplacementBannerId]=useState("");

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
  async function refreshImageWorkflow(){
    const data=await fetch("/api/admin/image-workflow").then(response=>response.json()).catch(()=>null);
    if(data?.items)setImageWorkflow(data.items);
  }
  async function searchMissingImages(productId?:string){
    setSearchingImages(true);setRequestError("");setImageSearchSummary("");
    try{
      const response=await fetch("/api/admin/image-search",{
        method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(productId?{productId}:{})
      });
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.error||"The missing-image search could not be completed.");
      const refreshed=await fetch("/api/admin/products").then(result=>result.json()).catch(()=>null);
      if(refreshed?.products)setProducts(refreshed.products);
      await refreshImageWorkflow();
      if(!data.searched)setImageSearchSummary("Every product already has an image.");
      else setImageSearchSummary(
        `Searched ${data.searched} missing products and added ${data.matched} high-confidence image${data.matched===1?"":"s"}. `
        + `${data.remaining} products still use a placeholder.${data.failed?` ${data.failed} source download${data.failed===1?"":"s"} could not be completed.`:""}`
      );
    }catch(reason){setRequestError(reason instanceof Error?reason.message:"The missing-image search could not be completed.")}
    finally{setSearchingImages(false)}
  }
  async function archiveImages(){
    setArchivingImages(true);setRequestError("");setImageSearchSummary("");
    try{
      const response=await fetch("/api/admin/image-archive",{method:"POST"});
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.error||"The images could not be archived.");
      await refreshImageWorkflow();
      const refreshed=await fetch("/api/admin/products").then(result=>result.json()).catch(()=>null);
      if(refreshed?.products)setProducts(refreshed.products);
      const refreshedBanners=await fetch("/api/admin/banners").then(result=>result.json()).catch(()=>null);
      if(refreshedBanners?.banners)setBanners(refreshedBanners.banners);
      setImageSearchSummary(`Archived ${data.archived} image${data.archived===1?"":"s"}. ${data.missing} missing temporary file${data.missing===1?" was":"s were"} returned to the search queue.${data.failed?` ${data.failed} archive attempt${data.failed===1?"":"s"} need attention.`:""}`);
    }catch(reason){setRequestError(reason instanceof Error?reason.message:"The images could not be archived.")}
    finally{setArchivingImages(false)}
  }
  async function updateArchiveList(action:"dismiss"|"restore"|"dismiss_all_verified",item?:ImageWorkflowItem){
    setCleaningArchive(true);setRequestError("");setRequestNotice("");
    try{
      const response=await fetch("/api/admin/image-archive/records",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({action,entityType:item?.entityType,recordId:item?.recordId}),
      });
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.error||"The archive list could not be updated.");
      if(data?.items)setImageWorkflow(data.items);
      setArchiveConfirmation(null);
      setRequestNotice(action==="restore"?"Image restored to the active archive list.":`${data.changed} verified image${data.changed===1?"":"s"} removed from the active archive list.`);
    }catch(reason){setRequestError(reason instanceof Error?reason.message:"The archive list could not be updated.")}
    finally{setCleaningArchive(false)}
  }
  async function status(id:string,status:RequestStatus){
    const previous=requests;
    setRequestError("");setRequestNotice("");
    setRequests(rows=>rows.map(r=>r.id===id?{...r,status}:r));
    try{
      const response=await fetch(`/api/admin/inquiries/${id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({status})});
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.error||"The reply could not be saved.");
      if(status!=="Pending"){
        if(data?.delivery?.status==="sent")setRequestNotice("Status saved and the customer email was sent.");
        else if(data?.delivery?.status==="manual_phone_follow_up")setRequestNotice("Status saved. This customer provided a phone number, so contact them manually.");
        else if(data?.delivery?.status==="not_configured")setRequestNotice("Status saved, but customer email is not configured yet.");
        else setRequestNotice("Status saved, but the email provider did not accept the message. Try again or contact the customer manually.");
      }
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
      if(file.size>10_000_000)throw new Error("File exceeds the upload size limit.");
      const body=new FormData();
      body.append("file",await compressHeroBanner(file));
      body.append("alt",alt?.value||"Vape Mart promotion");
      if(replacementBannerId)body.append("replaceId",replacementBannerId);
      const response=await fetch("/api/admin/banners",{method:"POST",body});
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.error||"Image processing failed.");
      setBanners(data.banners);setReplacementBannerId("");form.reset();await refreshImageWorkflow();
    }catch(reason){setRequestError(reason instanceof Error?reason.message:"Image processing failed.")}
    finally{setUploading(false)}
  }
  async function deleteBanner(id:string){
    const response=await fetch(`/api/admin/banners/${id}`,{method:"DELETE"});
    const data=await response.json().catch(()=>null);
    if(response.ok){setBanners(data.banners);await refreshImageWorkflow()}else setRequestError(data?.error||"The banner could not be removed.");
  }
  async function saveHours(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setSavingHours(true);setRequestError("");setRequestNotice("");
    try{
      const response=await fetch("/api/admin/store-hours",{
        method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(storeHours)
      });
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.error||"Store hours could not be saved.");
      setStoreHours(data.hours);
      setRequestNotice("Store hours saved. The homepage and contact page now show the new schedule.");
    }catch(reason){setRequestError(reason instanceof Error?reason.message:"Store hours could not be saved.")}
    finally{setSavingHours(false)}
  }
  const categories=["All categories",...Array.from(new Set(products.map(product=>product.category))).sort()];
  const filteredProducts=products.filter(product=>(productCategory==="All categories"||product.category===productCategory)&&`${product.name} ${product.upc} ${product.brand}`.toLowerCase().includes(productQuery.toLowerCase()));
  return <div className="admin-shell">
    <aside className="admin-side"><Link className="logo" href="/"><span><img src="/brand/vape-mart-logo-small.webp" width="160" height="160" alt="" /></span> VAPE MART</Link><p>Catalogue admin</p><nav>{tabs.map(item=><button key={item} className={tab===item?"active":""} onClick={()=>setTab(item)}><i>{item.slice(0,1)}</i>{item}</button>)}</nav><div className="admin-profile"><b>{user}</b><small>Administrator</small><form action={signOut} method="post"><button className="admin-logout" type="submit">Sign out</button></form></div></aside>
    <main className="admin-main"><header className="admin-top"><div><p className="eyebrow">Vape Mart admin</p><h1>{tab}</h1></div><div><Link href="/" target="_blank">View catalogue ↗</Link><button className="admin-primary" onClick={()=>{setTab("Products");setEditing({visible:true,featured:false,price:0})}}>+ Add product</button></div></header>
      {!emailConfigured&&<div className="admin-alert"><b>Email delivery is not configured.</b> Requests are saved here, but Vape Mart and customers will not receive email until a verified mail sender is connected.</div>}
      {requestError&&<div className="admin-alert error" role="alert">{requestError}</div>}
      {requestNotice&&<div className="admin-alert success" role="status">{requestNotice}</div>}
      {tab==="Overview"&&<><div className="metric-grid"><Metric label="Visible products" value={String(products.filter(p=>p.visible).length)} note="Hardware excluded"/><Metric label="Pending requests" value={String(requests.filter(r=>r.status==="Pending").length)} note="Needs a reply" warn/><Metric label="Products with images" value={String(products.filter(p=>p.image).length)} note={`of ${products.length}`}/><Metric label="Import review" value={String(products.filter(p=>p.missingReview).length)} note="Missing from latest file"/></div><div className="admin-grid"><Panel title="Recent availability requests" action={()=>setTab("Requests")} actionLabel="View all">{<RequestTable rows={requests.slice(0,8)} status={status}/>}</Panel><Panel title="Launch status"><div className="health-list"><Health label="Catalogue database" value="Connected" good/><Health label="Cart & tax estimate" value="Live" good/><Health label="Checkout & payment" value="Disabled"/><Health label="Hardware products" value="Excluded" good/></div></Panel></div></>}
      {tab==="Products"&&<Panel title="Product catalogue" action={()=>setEditing({visible:true,featured:false,price:0})} actionLabel="Add product"><div className="admin-toolbar"><input value={productQuery} onChange={event=>setProductQuery(event.target.value)} placeholder="Search by name, UPC, or brand"/><select value={productCategory} onChange={event=>setProductCategory(event.target.value)}>{categories.map(category=><option key={category}>{category}</option>)}</select><button className="admin-primary image-search-button" disabled={searchingImages||!products.some(product=>!product.image)} onClick={()=>searchMissingImages()}>{searchingImages?"Searching 5 products…":"Find missing images"}</button></div>{imageSearchSummary&&<p className="image-search-summary" role="status">{imageSearchSummary}</p>}<div className="table-scroll"><table className="admin-table"><thead><tr><th>Product</th><th>UPC</th><th>Price</th><th>Featured</th><th>Visible</th><th>Actions</th></tr></thead><tbody>{filteredProducts.slice(0,300).map(p=><tr key={p.id}><td><span className="mini-art" style={{background:p.accent}}></span><b>{p.name}</b><small>{p.brand} · {p.category}</small></td><td>{p.upc}</td><td>${p.price.toFixed(2)}</td><td><input type="checkbox" checked={!!p.featured} onChange={()=>updateProduct(p.id,{featured:!p.featured})}/></td><td><input type="checkbox" checked={p.visible} onChange={()=>updateProduct(p.id,{visible:!p.visible})}/></td><td><button className="table-action" onClick={()=>setEditing(p)}>Edit</button><button className="table-action danger" onClick={()=>deleteProduct(p)}>Delete</button></td></tr>)}</tbody></table></div><p className="panel-intro">Showing {Math.min(300,filteredProducts.length)} of {filteredProducts.length} matching products. {products.filter(product=>!product.image).length} currently use a placeholder. Changes are saved to the live catalogue database.</p></Panel>}
      {tab==="Image Archive"&&<div className="image-workflow-page">
        <div className="image-workflow-actions">
          <div><h2>Image archive & recovery</h2><p>Product searches run in batches of five. Temporary product images and hero banners are archived only when you choose to send them to GitHub.</p></div>
          <div><button className="admin-primary" disabled={searchingImages} onClick={()=>searchMissingImages()}>{searchingImages?"Searching 5 products…":"Search next 5 missing images"}</button><button className="admin-primary secondary-admin" disabled={archivingImages||!imageWorkflow.some(item=>item.status==="temporary")} onClick={archiveImages}>{archivingImages?"Archiving…":"Archive Images to GitHub"}</button><button className="admin-primary secondary-admin" disabled={cleaningArchive||!imageWorkflow.some(item=>item.status==="archived_verified"&&!item.hiddenFromAdmin)} onClick={()=>setArchiveConfirmation({action:"dismiss_all_verified"})}>Clear Verified Images from List</button></div>
        </div>
        {imageSearchSummary&&<p className="image-search-summary" role="status">{imageSearchSummary}</p>}
        <ImageQueue title="Temporary images" items={imageWorkflow.filter(item=>item.status==="temporary"&&!item.lastFailureReason)} empty="No temporary images are waiting."/>
        <ImageQueue title="Pending deployment" items={imageWorkflow.filter(item=>item.status==="pending_deployment"||item.status==="archiving")} empty="No images are currently being deployed."/>
        <ImageQueue title="Missing images" items={imageWorkflow.filter(item=>item.status==="missing"&&!item.lastFailureReason)} empty="No missing images are waiting." retry={item=>item.entityType==="product"?searchMissingImages(item.productId):(setReplacementBannerId(item.bannerId),setTab("Banners"))} busy={searchingImages}/>
        <ImageQueue title="Failed images" items={imageWorkflow.filter(item=>Boolean(item.lastFailureReason)&&["missing","temporary"].includes(item.status))} empty="No image actions have failed." retry={item=>item.entityType==="product"?searchMissingImages(item.productId):(setReplacementBannerId(item.bannerId),setTab("Banners"))} busy={searchingImages}/>
        <details className="admin-panel archived-history"><summary>Archived history <span>{imageWorkflow.filter(item=>["archived","archived_verified"].includes(item.status)).length}</span></summary>
          <ImageHistory items={imageWorkflow.filter(item=>["archived","archived_verified"].includes(item.status))} busy={cleaningArchive} dismiss={item=>setArchiveConfirmation({action:"dismiss",item})} restore={item=>updateArchiveList("restore",item)}/>
        </details>
      </div>}
      {tab==="Imports"&&<div className="two-columns"><Panel title="Import RetailzPOS Excel export"><div className="upload-zone"><span>⇧</span><h3>Drop an .xlsx, .xls, or .csv file here</h3><p>RetailzPOS columns such as Item Name, Department Name, Category Name, and Sub Category Name are recognized automatically. Products match by UPC, Hardware is excluded, and missing rows are flagged—not deleted.</p><label className="admin-primary">{importing?"Analysing…":"Choose Excel file"}<input type="file" accept=".xlsx,.xls,.csv" hidden onChange={e=>importFile(e.target.files?.[0])}/></label></div></Panel><Panel title="Last import summary">{importSummary?<div className="summary-grid"><Metric label="Added" value={String(importSummary.added)} note="New UPCs"/><Metric label="Updated" value={String(importSummary.updated)} note="Prices & details"/><Metric label="Images found" value={String(importSummary.imagesMatched)} note="Matched automatically"/><Metric label="Need an image" value={String(importSummary.imagesUnmatched)} note="New products to review" warn={importSummary.imagesUnmatched>0}/><Metric label="Duplicates" value={String(importSummary.duplicates)} note="Review required" warn/><Metric label="Hardware skipped" value={String(importSummary.hardware)} note="Automatic"/><Metric label="Rows skipped" value={String(importSummary.skippedRows)} note={`of ${importSummary.totalRows} rows`} warn={importSummary.skippedRows>0}/><Metric label="Missing / review" value={String(importSummary.review)} note="Not deleted"/></div>:<div className="blank"><b>No import in this session</b><p>Upload a RetailzPOS export to see product and automatic-image matching results.</p></div>}</Panel></div>}
      {tab==="Banners"&&<><Panel title={replacementBannerId?"Replace missing hero banner":`Hero banners (${banners.length}/6)`}><form className="banner-upload" onSubmit={event=>{event.preventDefault();uploadBanner(event.currentTarget)}}><label>Banner image<input name="file" type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" required disabled={banners.length>=6}/></label><label>Accessible description<input name="alt" placeholder="New arrival promotion" required/></label><button className="admin-primary" disabled={uploading||banners.length>=6}>{uploading?"Uploading…":replacementBannerId?"Upload replacement":"Upload banner"}</button>{replacementBannerId&&<button type="button" className="table-action" onClick={()=>setReplacementBannerId("")}>Cancel replacement</button>}</form><p className="panel-intro">{banners.length?"PNG, JPG, and WebP banners are optimized and shown immediately, then included in the next GitHub archive action.":"No custom banners uploaded. The original three banners are currently shown."}</p><div className="banner-admin-grid">{banners.map(banner=><article key={banner.id}><img src={banner.src} alt=""/><div><b>{banner.alt}</b><button onClick={()=>deleteBanner(banner.id)}>Remove</button></div></article>)}</div></Panel></>}
      {tab==="Store Hours"&&<Panel title="Public store hours"><form className="store-hours-admin" onSubmit={saveHours}>
        <p>Update the schedule shown on the homepage and contact page. Include AM/PM and use “Closed” whenever the store will not open.</p>
        <label><span>Monday – Friday</span><input required maxLength={80} value={storeHours.weekdays} onChange={event=>setStoreHours(current=>({...current,weekdays:event.target.value}))} placeholder="9:00 AM – 10:00 PM"/></label>
        <label><span>Saturday</span><input required maxLength={80} value={storeHours.saturday} onChange={event=>setStoreHours(current=>({...current,saturday:event.target.value}))} placeholder="10:00 AM – 8:00 PM"/></label>
        <label><span>Sunday</span><input required maxLength={80} value={storeHours.sunday} onChange={event=>setStoreHours(current=>({...current,sunday:event.target.value}))} placeholder="10:00 AM – 9:00 PM"/></label>
        <button className="admin-primary" disabled={savingHours}>{savingHours?"Saving…":"Save store hours"}</button>
      </form></Panel>}
      {tab==="Requests"&&<Panel title="Availability requests"><RequestTable rows={requests} status={status}/></Panel>}
      {editing&&<ProductEditor product={editing} saving={savingProduct} close={()=>setEditing(null)} save={saveProduct} imageUploaded={(id,image)=>setProducts(rows=>rows.map(row=>row.id===id?{...row,image}:row))}/>}
      {archiveConfirmation&&<div className="modal-backdrop" role="presentation" onMouseDown={()=>setArchiveConfirmation(null)}><div className="archive-confirmation" role="dialog" aria-modal="true" aria-labelledby="archive-confirm-title" onMouseDown={event=>event.stopPropagation()}>
        <h2 id="archive-confirm-title">{archiveConfirmation.action==="dismiss"?"Remove from Archive List?":"Clear Verified Images from List?"}</h2>
        <p>{archiveConfirmation.action==="dismiss"?"This removes the image from the active archive list. The permanent GitHub image and product/banner will not be deleted.":"This removes all verified images from the active archive list. Permanent GitHub images and product/banner links will not be deleted."}</p>
        <div><button className="secondary-admin admin-primary" disabled={cleaningArchive} onClick={()=>setArchiveConfirmation(null)}>Cancel</button><button className="admin-primary" disabled={cleaningArchive} onClick={()=>updateArchiveList(archiveConfirmation.action,archiveConfirmation.item)}>{cleaningArchive?"Updating…":archiveConfirmation.action==="dismiss"?"Remove from list":"Clear verified images"}</button></div>
      </div></div>}
    </main>
  </div>
}
function Metric({label,value,note,warn}:{label:string,value:string,note:string,warn?:boolean}){return <div className="metric"><span>{label}</span><strong className={warn?"warn":""}>{value}</strong><small>{note}</small></div>}
function Panel({title,children,action,actionLabel}:{title:string;children:React.ReactNode;action?:()=>void;actionLabel?:string}){return <section className="admin-panel"><header><h2>{title}</h2>{actionLabel&&<button onClick={action}>{actionLabel} →</button>}</header>{children}</section>}
function Health({label,value,good}:{label:string,value:string,good?:boolean}){return <div><span>{label}</span><b className={good?"good":""}>{value}</b></div>}
function ImageQueue({title,items,empty,retry,busy=false}:{title:string;items:ImageWorkflowItem[];empty:string;retry?:(item:ImageWorkflowItem)=>void;busy?:boolean}) {
  return <section className="admin-panel image-queue"><header><h2>{title}</h2><span>{items.length}</span></header>
    {!items.length?<div className="blank"><p>{empty}</p></div>:<div className="image-queue-grid">{items.map(item=><article key={`${item.entityType}-${item.recordId}`}>
      <div className="image-queue-preview">{item.image?<img src={item.image} alt=""/>:<span aria-hidden="true">Image pending</span>}</div>
      <div className="image-queue-copy"><b>{item.name}</b><small>{item.entityType==="banner"?"Hero banner":`${item.brand} · UPC ${item.upc}${item.sku?` · SKU ${item.sku}`:""}`}</small>
        <dl><div><dt>Status</dt><dd>{item.status}</dd></div><div><dt>Retries</dt><dd>{item.retryCount}</dd></div><div><dt>Last search</dt><dd>{item.lastSearchAt?new Date(item.lastSearchAt).toLocaleString():"Not searched yet"}</dd></div></dl>
        {item.previousSourceUrl&&<p>Previous source: <span>{item.previousSourceUrl}</span></p>}
        {item.lastFailureReason&&<p className="image-failure">{item.lastFailureReason}</p>}
        {retry&&<button className="table-action" disabled={busy} onClick={()=>retry(item)}>{item.entityType==="banner"?"Upload replacement":"Retry this product"}</button>}
      </div>
    </article>)}</div>}
  </section>;
}
function ImageHistory({items,busy,dismiss,restore}:{items:ImageWorkflowItem[];busy:boolean;dismiss:(item:ImageWorkflowItem)=>void;restore:(item:ImageWorkflowItem)=>void}) {
  if(!items.length)return <div className="blank"><p>No archived images yet.</p></div>;
  return <div className="archive-history-list">{items.map(item=><article key={`${item.entityType}-${item.recordId}`}>
    <div><b>{item.name}</b><small>{item.entityType==="banner"?"Hero banner":`${item.brand} · UPC ${item.upc}`}</small></div>
    <dl><div><dt>GitHub path</dt><dd>{item.githubPath||"Existing catalogue archive"}</dd></div><div><dt>Commit</dt><dd>{item.githubCommitSha?item.githubCommitSha.slice(0,12):"—"}</dd></div><div><dt>Archived</dt><dd>{item.archivedAt?new Date(item.archivedAt).toLocaleString():"—"}</dd></div><div><dt>Dismissed</dt><dd>{item.dismissedAt?`${new Date(item.dismissedAt).toLocaleString()} by ${item.dismissedBy}`:"Visible"}</dd></div></dl>
    <div className="archive-history-actions">{item.githubUrl&&<a className="table-action" href={item.githubUrl} target="_blank" rel="noreferrer">View in GitHub</a>}
      {item.status==="archived_verified"&&!item.hiddenFromAdmin&&<button className="table-action" disabled={busy} onClick={()=>dismiss(item)}>Remove from Archive List</button>}
      {item.status==="archived_verified"&&item.hiddenFromAdmin&&<button className="table-action" disabled={busy} onClick={()=>restore(item)}>Restore to Archive List</button>}
    </div>
  </article>)}</div>;
}
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
