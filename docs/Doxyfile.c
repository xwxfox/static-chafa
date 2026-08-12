# Doxygen config for C API docs (codec.c + addon.c only)
INPUT                  = src/codec.c src/addon.c src/codec_video.c
RECURSIVE              = NO
GENERATE_HTML          = NO
GENERATE_XML           = YES
XML_OUTPUT             = c_api_xml
OUTPUT_DIRECTORY       = docs
GENERATE_LATEX         = NO
GENERATE_MAN           = NO
GENERATE_RTF           = NO
EXTRACT_ALL            = YES
QUIET                  = YES
WARN_IF_UNDOCUMENTED   = NO
WARN_NO_PARAMDOC       = NO
ENABLE_PREPROCESSING   = YES
MACRO_EXPANSION        = YES
EXPAND_ONLY_PREDEF     = YES
PREDEFINED             = CODEC_EXPORT
