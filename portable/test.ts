// Diagnostic — test raw DLL loading
const { dlopen, FFIType, ptr, CString } = require("bun:ffi");
const fs = require("fs");

// Try opening with just one symbol
const lib = dlopen("codec.dll", {
    cfs: { args: [FFIType.ptr], returns: FFIType.void },
});
console.log("dlopen OK");
console.log("lib keys:", Object.keys(lib));
console.log("lib.symbols:", Object.keys(lib.symbols || {}));
console.log("cfs type:", typeof lib.symbols.cfs);
console.log("cfs direct:", typeof lib.cfs);

// Try accessing via both paths
try { lib.symbols.cfs(null); console.log("symbols.cfs() OK"); } catch(e: any) { console.log("symbols.cfs:", e.message); }
try { lib.cfs(null); console.log("lib.cfs() OK"); } catch(e: any) { console.log("lib.cfs:", e.message); }
