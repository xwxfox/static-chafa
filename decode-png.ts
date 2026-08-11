import { dlopen, FFIType, ptr } from "bun:ffi";

export interface DecodeStats { parseMs: number; idatMs: number; inflateMs: number; defilterMs: number; }
export interface RGBAImage { width: number; height: number; data: Uint8Array; stats: DecodeStats; }
export interface GIFFrame  { data: Uint8Array; delayMs: number; width: number; height: number; left: number; top: number; disposal: number; }
export interface GIFResult { width: number; height: number; frames: GIFFrame[]; loopCount: number; stats: DecodeStats; }

const PNG_SIG = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
function readU32BE(buf: Uint8Array, off: number): number { return ((buf[off]!<<24)|(buf[off+1]!<<16)|(buf[off+2]!<<8)|buf[off+3]!)>>>0; }

const nativeDefilter = dlopen("defilter.so", {
    inflate_zlib:          { args: [FFIType.ptr,FFIType.i32,FFIType.ptr,FFIType.i32], returns: FFIType.i32 },
    defilter:              { args: [FFIType.ptr,FFIType.i32,FFIType.i32,FFIType.i32,FFIType.i32,FFIType.ptr,FFIType.ptr], returns: FFIType.void },
    defilter_rgb_to_rgba:  { args: [FFIType.ptr,FFIType.i32,FFIType.i32,FFIType.ptr,FFIType.ptr], returns: FFIType.void },
    decode_jpeg_to_rgba:   { args: [FFIType.ptr,FFIType.i32,FFIType.ptr,FFIType.ptr,FFIType.ptr], returns: FFIType.i32 },
    decode_gif_to_rgba:    { args: [FFIType.ptr,FFIType.i32,FFIType.ptr,FFIType.i32,FFIType.ptr,FFIType.i32,FFIType.ptr,FFIType.ptr,FFIType.ptr], returns: FFIType.i32 },
    decode_webp_to_rgba:   { args: [FFIType.ptr,FFIType.i32,FFIType.ptr,FFIType.i32,FFIType.ptr,FFIType.ptr], returns: FFIType.i32 },
    decode_animated_webp_to_rgba: { args: [FFIType.ptr,FFIType.i32,FFIType.ptr,FFIType.i32,FFIType.ptr,FFIType.i32,FFIType.ptr,FFIType.ptr,FFIType.ptr], returns: FFIType.i32 },
    decode_bmp_to_rgba:   { args: [FFIType.ptr,FFIType.i32,FFIType.ptr,FFIType.i32,FFIType.ptr,FFIType.ptr], returns: FFIType.i32 },
    webp_anim_open:       { args: [FFIType.ptr,FFIType.i32,FFIType.ptr,FFIType.i32,FFIType.ptr,FFIType.ptr,FFIType.ptr], returns: FFIType.i32 },
    webp_anim_next:       { args: [FFIType.i32,FFIType.i32,FFIType.ptr,FFIType.ptr], returns: FFIType.i32 },
    webp_anim_count:      { args: [FFIType.i32], returns: FFIType.i32 },
    webp_anim_close:      { args: [FFIType.i32], returns: FFIType.void },
});
const { inflate_zlib, defilter, defilter_rgb_to_rgba, decode_jpeg_to_rgba, decode_gif_to_rgba, decode_webp_to_rgba, decode_animated_webp_to_rgba, decode_bmp_to_rgba, webp_anim_open, webp_anim_next, webp_anim_count, webp_anim_close } = nativeDefilter.symbols;

type Bufs = { compressed: Uint8Array; raw: Uint8Array; prev: Uint8Array; rgba: Uint8Array; width: number; height: number; channels: number; };
let _pool: Bufs | null = null;
function getPool(w: number, h: number, c: number, il: number): Bufs {
    const sl = w*c, rl = (sl+1)*h, rgl = w*h*4;
    if (_pool && _pool.width===w && _pool.height===h && _pool.channels===c) { if (_pool.compressed.length<il) _pool.compressed=new Uint8Array(il); if (_pool.raw.length<rl) _pool.raw=new Uint8Array(rl); return _pool; }
    return _pool = { compressed:new Uint8Array(il), raw:new Uint8Array(rl), prev:new Uint8Array(sl), rgba:new Uint8Array(rgl), width:w, height:h, channels:c };
}

export function decodePng(buf: Uint8Array): RGBAImage {
    let t0=performance.now();
    for (let i=0;i<8;i++) if (buf[i]!==PNG_SIG[i]!) throw new Error("Not a PNG");
    let off=8, width=0, height=0, bitDepth=0, colorType=0, interlace=0;
    let palette:Uint8Array|null=null, trns:Uint8Array|null=null;
    const idat:Uint8Array[]=[]; let idatLen=0;
    while (off+12<=buf.length) {
        const len=readU32BE(buf,off), dataOff=off+8, next=dataOff+len+4;
        if (next>buf.length) throw new Error("Corrupt PNG");
        const t0b=buf[off+4]!, t1b=buf[off+5]!, t2b=buf[off+6]!, t3b=buf[off+7]!;
        if (t0b===0x49&&t1b===0x48&&t2b===0x44&&t3b===0x52) { width=readU32BE(buf,dataOff); height=readU32BE(buf,dataOff+4); bitDepth=buf[dataOff+8]!; colorType=buf[dataOff+9]!; interlace=buf[dataOff+12]!; }
        else if (t0b===0x50&&t1b===0x4c&&t2b===0x54&&t3b===0x45) palette=buf.subarray(dataOff,dataOff+len);
        else if (t0b===0x74&&t1b===0x52&&t2b===0x4e&&t3b===0x53) trns=buf.subarray(dataOff,dataOff+len);
        else if (t0b===0x49&&t1b===0x44&&t2b===0x41&&t3b===0x54) { idat.push(buf.subarray(dataOff,dataOff+len)); idatLen+=len; }
        else if (t0b===0x49&&t1b===0x45&&t2b===0x4e&&t3b===0x44) break;
        off=next;
    }
    if (!width||!height) throw new Error("Missing IHDR");
    if (idatLen===0) throw new Error("Missing IDAT");
    if (bitDepth!==8||interlace!==0) throw new Error("Unsupported PNG");
    let channels=0;
    switch (colorType) { case 0:channels=1;break; case 2:channels=3;break; case 3:channels=1;break; case 4:channels=2;break; case 6:channels=4;break; default:throw new Error("Unsupported color type"); }
    let t1=performance.now();
    const pool=getPool(width,height,channels,idatLen);
    for (let i=0,p=0;i<idat.length;i++) { pool.compressed.set(idat[i]!,p); p+=idat[i]!.length; }
    let t2=performance.now();
    const scanline=width*channels, stride=scanline+1, exp=stride*height;
    if (inflate_zlib(ptr(pool.compressed),idatLen,ptr(pool.raw),exp)!==exp) throw new Error("Inflate failed");
    let t3=performance.now();
    const rgba=pool.rgba;
    if (colorType===2) { defilter_rgb_to_rgba(ptr(pool.raw),width,height,ptr(pool.prev),ptr(rgba)); let t4=performance.now(); return {width,height,data:rgba,stats:{parseMs:t1-t0,idatMs:t2-t1,inflateMs:t3-t2,defilterMs:t4-t3}}; }
    if (colorType===6) { defilter(ptr(pool.raw),channels,scanline,stride,height,ptr(pool.prev),ptr(rgba)); let t4=performance.now(); return {width,height,data:rgba,stats:{parseMs:t1-t0,idatMs:t2-t1,inflateMs:t3-t2,defilterMs:t4-t3}}; }
    const unpacked=new Uint8Array(scanline*height);
    defilter(ptr(pool.raw),channels,scanline,stride,height,ptr(pool.prev),ptr(unpacked));
    let t4=performance.now();
    const tb=width*height*4;
    if (colorType===0) { for (let i=3;i<tb;i+=4) rgba[i]=255; for (let s=0,d=0;s<unpacked.length;s++,d+=4) { const v=unpacked[s]!; rgba[d]=v; rgba[d+1]=v; rgba[d+2]=v; } }
    else if (colorType===4) { for (let s=0,d=0;s<unpacked.length;s+=2,d+=4) { const v=unpacked[s]!; rgba[d]=v; rgba[d+1]=v; rgba[d+2]=v; rgba[d+3]=unpacked[s+1]!; } }
    else if (colorType===3) { if (!palette) throw new Error("Missing PLTE"); for (let i=3;i<tb;i+=4) rgba[i]=255; for (let s=0,d=0;s<unpacked.length;s++,d+=4) { const idx=unpacked[s]!,p=idx*3; rgba[d]=palette[p]!; rgba[d+1]=palette[p+1]!; rgba[d+2]=palette[p+2]!; if (trns&&idx<trns.length) rgba[d+3]=trns[idx]!; } }
    return {width,height,data:rgba,stats:{parseMs:t1-t0,idatMs:t2-t1,inflateMs:t3-t2,defilterMs:t4-t3}};
}

let _jpegBuf:Uint8Array|null=null;
export function decodeJpeg(buf:Uint8Array):RGBAImage {
    let t0=performance.now();
    const dims=new Int32Array(2), wv=new Int32Array(dims.buffer,dims.byteOffset,1), hv=new Int32Array(dims.buffer,dims.byteOffset+4,1);
    let t1=performance.now();
    if (!_jpegBuf) _jpegBuf=new Uint8Array(4*4096*4096);
    decode_jpeg_to_rgba(ptr(buf),buf.length,ptr(_jpegBuf),ptr(wv),ptr(hv));
    let t2=performance.now();
    const size=dims[0]!*dims[1]!*4, rgba=new Uint8Array(size);
    rgba.set(_jpegBuf.subarray(0,size));
    return {width:dims[0]!,height:dims[1]!,data:rgba,stats:{parseMs:t1-t0,idatMs:0,inflateMs:t2-t1,defilterMs:0}};
}

let _gifPool:Uint8Array|null=null;
export function decodeGif(buf:Uint8Array,maxFrames?:number):GIFResult {
    let t0=performance.now();
    if (!_gifPool||_gifPool.length<512*1024*1024) _gifPool=new Uint8Array(512*1024*1024);
    const dims=new Int32Array(4), delays=new Int32Array(maxFrames||500);
    const wv=new Int32Array(dims.buffer,dims.byteOffset,1), hv=new Int32Array(dims.buffer,dims.byteOffset+4,1), fcv=new Int32Array(dims.buffer,dims.byteOffset+8,1);
    const result=decode_gif_to_rgba(ptr(buf),buf.length,ptr(_gifPool),_gifPool.length,ptr(delays),maxFrames||500,ptr(wv),ptr(hv),ptr(fcv));
    if (result<0) throw new Error("GIF failed: "+result);
    const w=dims[0]!,h=dims[1]!,fc=dims[2]!,fs=w*h*4;
    let t1=performance.now();
    const frames:GIFFrame[]=[];
    for (let i=0;i<fc;i++) frames.push({data:new Uint8Array(_gifPool.buffer,_gifPool.byteOffset+i*fs,fs),delayMs:delays[i]!,width:w,height:h,left:0,top:0,disposal:0});
    return {width:w,height:h,frames,loopCount:0,stats:{parseMs:t1-t0,idatMs:0,inflateMs:0,defilterMs:0}};
}

let _webpPool:Uint8Array|null=null;
export function decodeWebp(buf:Uint8Array):RGBAImage {
    let t0=performance.now();
    if (!_webpPool) _webpPool=new Uint8Array(4*4096*4096);
    const dims=new Int32Array(2), wv=new Int32Array(dims.buffer,dims.byteOffset,1), hv=new Int32Array(dims.buffer,dims.byteOffset+4,1);
    let t1=performance.now();
    const r=decode_webp_to_rgba(ptr(buf),buf.length,ptr(_webpPool),_webpPool.length,ptr(wv),ptr(hv));
    if (r<0) throw new Error("WebP decode failed: "+r);
    const w=dims[0]!,h=dims[1]!;
    let t2=performance.now();
    const rr=new Uint8Array(w*h*4);
    rr.set(_webpPool.subarray(0,w*h*4));
    return {width:w,height:h,data:rr,stats:{parseMs:t1-t0,idatMs:0,inflateMs:t2-t1,defilterMs:0}};
}

let _webpAnimPool:Uint8Array|null=null;
export function decodeWebpAnim(buf:Uint8Array,maxFrames?:number):GIFResult {
    let t0=performance.now();
    if (!_webpAnimPool||_webpAnimPool.length<512*1024*1024) _webpAnimPool=new Uint8Array(512*1024*1024);
    const dims=new Int32Array(4), delays=new Int32Array(maxFrames||500);
    const wv=new Int32Array(dims.buffer,dims.byteOffset,1), hv=new Int32Array(dims.buffer,dims.byteOffset+4,1), fcv=new Int32Array(dims.buffer,dims.byteOffset+8,1);
    const result=decode_animated_webp_to_rgba(ptr(buf),buf.length,ptr(_webpAnimPool),_webpAnimPool.length,ptr(delays),maxFrames||500,ptr(wv),ptr(hv),ptr(fcv));
    if (result<0) throw new Error("Animated WebP failed: "+result);
    const w=dims[0]!,h=dims[1]!,fc=dims[2]!,fs=w*h*4;
    let t1=performance.now();
    const frames:GIFFrame[]=[];
    for (let i=0;i<fc;i++) frames.push({data:new Uint8Array(_webpAnimPool.buffer,_webpAnimPool.byteOffset+i*fs,fs),delayMs:delays[i]!,width:w,height:h,left:0,top:0,disposal:0});
    return {width:w,height:h,frames,loopCount:0,stats:{parseMs:t1-t0,idatMs:0,inflateMs:0,defilterMs:0}};
}

let _webpStreamPool:Uint8Array|null=null;
export function decodeWebpStream(buf:Uint8Array):GIFResult {
    if (!_webpStreamPool||_webpStreamPool.length<512*1024*1024) _webpStreamPool=new Uint8Array(512*1024*1024);
    const dims=new Int32Array(3), wv=new Int32Array(dims.buffer,dims.byteOffset,1), hv=new Int32Array(dims.buffer,dims.byteOffset+4,1), dv=new Int32Array(dims.buffer,dims.byteOffset+8,1);
    let t0=performance.now();
    const handle=webp_anim_open(ptr(buf),buf.length,ptr(_webpStreamPool),_webpStreamPool.length,ptr(wv),ptr(hv),ptr(dv));
    if (handle<0) throw new Error("WebP anim open failed: "+handle);
    const w=dims[0]!,h=dims[1]!,fs=w*h*4;
    let t1=performance.now();
    // decode remaining frames in background
    (async () => {
        while (true) {
            const delays=new Int32Array(50), countBuf=new Int32Array(1);
            const r=webp_anim_next(handle,50,ptr(delays),ptr(countBuf));
            if (r<0) break;
            await new Promise(r => setTimeout(r, 0));
        }
        webp_anim_close(handle);
    })();
    return {width:w,height:h,
        frames:[{data:new Uint8Array(_webpStreamPool.buffer,_webpStreamPool.byteOffset,fs),delayMs:dims[2]!,width:w,height:h,left:0,top:0,disposal:0}],
        loopCount:0,stats:{parseMs:t1-t0,idatMs:0,inflateMs:0,defilterMs:0}};
}

let _bmpPool:Uint8Array|null=null;
export function decodeBmp(buf:Uint8Array):RGBAImage {
    let t0=performance.now();
    if (!_bmpPool) _bmpPool=new Uint8Array(4*4096*4096);
    const dims=new Int32Array(2), wv=new Int32Array(dims.buffer,dims.byteOffset,1), hv=new Int32Array(dims.buffer,dims.byteOffset+4,1);
    let t1=performance.now();
    const r=decode_bmp_to_rgba(ptr(buf),buf.length,ptr(_bmpPool),_bmpPool.length,ptr(wv),ptr(hv));
    if (r<0) throw new Error("BMP decode failed: "+r);
    const w=dims[0]!,h=dims[1]!;
    let t2=performance.now();
    const rr=new Uint8Array(w*h*4);
    rr.set(_bmpPool.subarray(0,w*h*4));
    return {width:w,height:h,data:rr,stats:{parseMs:t1-t0,idatMs:0,inflateMs:t2-t1,defilterMs:0}};
}
