import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const temporaryDirectory = "/tmp/vape-mart-product-images";

function productStem(productId:string) {
  return createHash("sha256").update(productId).digest("hex").slice(0, 24);
}

export function temporaryImageUrl(fileName:string) {
  return `/api/temporary-images/${encodeURIComponent(path.basename(fileName))}`;
}

export async function writeTemporaryProductImage(productId:string, bytes:ArrayBuffer, extension:string) {
  await mkdir(temporaryDirectory, { recursive:true });
  const stem=productStem(productId);
  const safeExtension=["png","webp","avif","jpg","jpeg"].includes(extension.toLowerCase())?extension.toLowerCase():"jpg";
  const fileName=`${stem}.${safeExtension}`;
  for(const existing of await readdir(temporaryDirectory).catch(()=>[] as string[])) {
    if(existing.startsWith(`${stem}.`)&&existing!==fileName)await unlink(path.join(temporaryDirectory,existing)).catch(()=>undefined);
  }
  const filePath=path.join(temporaryDirectory,fileName);
  await writeFile(filePath,Buffer.from(bytes));
  return {fileName,filePath,url:temporaryImageUrl(fileName)};
}

export async function readTemporaryProductImage(fileName:string) {
  const safeName=path.basename(fileName);
  if(safeName!==fileName)return null;
  const filePath=path.join(temporaryDirectory,safeName);
  try{return {filePath,body:await readFile(filePath)}}catch{return null}
}

export async function temporaryProductImageExists(filePath:string|null|undefined) {
  if(!filePath)return false;
  const safePath=path.join(temporaryDirectory,path.basename(filePath));
  try{await readFile(safePath);return true}catch{return false}
}

export async function removeTemporaryProductImage(filePath:string|null|undefined) {
  if(!filePath)return;
  const safePath=path.join(temporaryDirectory,path.basename(filePath));
  await unlink(safePath).catch(()=>undefined);
}
