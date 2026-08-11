{
  "targets": [{
    "target_name": "static_chafa",
    "sources": ["addon.c"],
    "include_dirs": ["native", "../../chafa_vendor", "/tmp/chafa_src/chafa", "/tmp/chafa_src/chafa/internal", "/tmp/chafa_src/chafa/internal/smolscale"],
    "defines": ["CHAFA_COMPILATION", "NAPI_VERSION=9"],
    "libraries": ["-lpng16", "-ljpeg", "-lwebp", "-lwebpdemux", "-lz", "-lm"],
    "cflags": ["-O3", "-fPIC"],
    "conditions": [
      ["OS=='win'", {
        "defines": ["_WIN32"],
        "libraries": [],
        "cflags": ["-DCODEC_EXPORT="]
      }],
      ["OS=='mac'", {
        "libraries": [],
        "xcode_settings": { "OTHER_LDFLAGS": ["-undefined", "dynamic_lookup"] }
      }]
    ]
  }]
}
