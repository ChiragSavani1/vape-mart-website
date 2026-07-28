import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const BANNER_UPLOAD_LIMIT=10_000_000;
export const BANNER_TEMPORARY_DIRECTORY="/tmp/vape-mart/banners";
const acceptedMimeTypes=new Set(["image/png","image/jpeg","image/webp"]);
const actualMimeTypes:Record<string,string>={png:"image/png",jpeg:"image/jpeg",webp:"image/webp"};

export class BannerUploadError extends Error {
  status:number;
  constructor(message:string,status=400){super(message);this.status=status}
}

export function temporaryBannerUrl(fileName:string) {
  return `/api/temporary-banners/${encodeURIComponent(path.basename(fileName))}`;
}

export async function processBannerUpload(
  file:{name:string;type:string;size:number;arrayBuffer:()=>Promise<ArrayBuffer>},
  bannerId:string,
  directory=BANNER_TEMPORARY_DIRECTORY,
) {
  if(file.size>BANNER_UPLOAD_LIMIT)throw new BannerUploadError("File exceeds the upload size limit.",413);
  if(!acceptedMimeTypes.has(file.type.toLowerCase()))throw new BannerUploadError("Unsupported image format.");
  const bytes=Buffer.from(await file.arrayBuffer());
  if(!bytes.length||bytes.length!==file.size)throw new BannerUploadError("The uploaded file is not a valid image.");
  let metadata:Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    metadata=await sharp(bytes,{failOn:"error",limitInputPixels:48_000_000}).metadata();
  } catch(error) {
    console.error("banner_image_validation_failed",error);
    throw new BannerUploadError("The uploaded file is not a valid image.");
  }
  const detectedMime=metadata.format?actualMimeTypes[metadata.format]:undefined;
  if(!detectedMime)throw new BannerUploadError("Unsupported image format.");
  if(detectedMime!==file.type.toLowerCase())throw new BannerUploadError("The uploaded file is not a valid image.");
  const width=metadata.width||0,height=metadata.height||0,aspect=height?width/height:0;
  if(width<800||height<250||aspect<1.6||aspect>4.5) {
    throw new BannerUploadError("Image processing failed. Use a wide banner at least 800 × 250 pixels.");
  }
  let optimized:Buffer;
  try {
    optimized=await sharp(bytes,{failOn:"error",limitInputPixels:48_000_000})
      .rotate()
      .resize({width:2400,height:1000,fit:"inside",withoutEnlargement:true})
      .webp({quality:84,effort:5})
      .toBuffer();
  } catch(error) {
    console.error("banner_image_processing_failed",error);
    throw new BannerUploadError("Image processing failed.");
  }
  try{await mkdir(directory,{recursive:true})}catch(error){
    console.error("banner_temporary_directory_failed",error);
    throw new BannerUploadError("Temporary upload directory is unavailable.",500);
  }
  const fileName=`${bannerId}-${crypto.randomUUID()}.webp`;
  const filePath=path.join(directory,fileName);
  try{await writeFile(filePath,optimized)}catch(error){
    console.error("banner_temporary_write_failed",error);
    throw new BannerUploadError("Temporary upload directory is unavailable.",500);
  }
  return {
    fileName,filePath,url:temporaryBannerUrl(fileName),contentType:"image/webp",
    originalFilename:path.basename(file.name).slice(0,180),width,height,size:optimized.byteLength,
  };
}

export async function readTemporaryBanner(fileName:string,directory=BANNER_TEMPORARY_DIRECTORY) {
  const safeName=path.basename(fileName);
  if(safeName!==fileName||!safeName.endsWith(".webp"))return null;
  const filePath=path.join(directory,safeName);
  try{return {filePath,body:await readFile(filePath)}}catch{return null}
}

export async function temporaryBannerExists(filePath:string|null|undefined,directory=BANNER_TEMPORARY_DIRECTORY) {
  if(!filePath)return false;
  try{await readFile(path.join(directory,path.basename(filePath)));return true}catch{return false}
}

export async function removeTemporaryBanner(filePath:string|null|undefined,directory=BANNER_TEMPORARY_DIRECTORY) {
  if(!filePath)return;
  await unlink(path.join(directory,path.basename(filePath))).catch(()=>undefined);
}
