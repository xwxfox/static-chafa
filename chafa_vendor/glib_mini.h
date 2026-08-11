/* glib_mini.h — Complete GLib replacement for embedded chafa */
#ifndef GLIB_MINI_H
#define GLIB_MINI_H

#include <stdint.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <stdarg.h>
#include <stdatomic.h>
#include <limits.h>
#include <float.h>
#include <math.h>
#include <time.h>
#include <errno.h>

#ifdef _WIN32
#define G_OS_WIN32 1
#endif

#ifndef _WIN32
#include <unistd.h>
#include <fcntl.h>
#include <pthread.h>
#include <signal.h>
#include <poll.h>
#include <sched.h>
#else
#include <windows.h>
#include <process.h>
#define sched_yield() Sleep(0)
#endif

/* ── Basic types ── */
typedef int                gint;
typedef unsigned int       guint;
typedef uint8_t            guint8;
typedef int8_t             gint8;
typedef uint16_t           guint16;
typedef int16_t            gint16;
typedef uint32_t           guint32;
typedef int32_t            gint32;
typedef uint64_t           guint64;
typedef int64_t            gint64;
typedef int                gboolean;
typedef void*              gpointer;
typedef const void*        gconstpointer;
typedef char               gchar;
typedef float              gfloat;
typedef double             gdouble;
typedef size_t             gsize;
typedef ssize_t            gssize;
typedef long               glong;
typedef unsigned long      gulong;
typedef uint32_t           gunichar;
typedef uintptr_t          guintptr;
typedef intptr_t           gintptr;
typedef uint8_t            guchar;
typedef uint32_t           GQuark;
/* GPid defined later (platform-dependent) */

typedef uint16_t           gushort;

#define TRUE  1
#define FALSE 0

#define G_BEGIN_DECLS
#define G_END_DECLS

/* ── Compiler attributes ── */
#define G_GNUC_UNUSED               __attribute__((unused))
#define G_GNUC_PURE                 __attribute__((pure))
#define G_GNUC_CONST                __attribute__((const))
#define G_GNUC_WARN_UNUSED_RESULT   __attribute__((warn_unused_result))
#define G_GNUC_PRINTF(n,m)          __attribute__((format(printf, n, m)))
#define G_GNUC_NORETURN             __attribute__((noreturn))
#define G_GNUC_MALLOC               __attribute__((malloc))
#define G_GNUC_INTERNAL             __attribute__((visibility("hidden")))

/* ── Math macros ── */
#ifndef MAX
#define MAX(a,b) ((a) > (b) ? (a) : (b))
#endif
#ifndef MIN
#define MIN(a,b) ((a) < (b) ? (a) : (b))
#endif
#define CLAMP(x,low,high) (((x) > (high)) ? (high) : (((x) < (low)) ? (low) : (x)))
#define ABS(x) ((x) < 0 ? -(x) : (x))

#define G_STMT_START do
#define G_UNLIKELY(expr) (expr)
#define G_LIKELY(expr) (expr)
#define G_STMT_END   while(0)
#define G_N_ELEMENTS(arr) (sizeof(arr) / sizeof((arr)[0]))

/* ── Conversions ── */
#define GINT_TO_POINTER(i)  ((gpointer)(guintptr)(i))
#define GPOINTER_TO_INT(p)  ((gint)(gintptr)(p))
#define GUINT_TO_POINTER(u) ((gpointer)(guintptr)(u))
#define GPOINTER_TO_UINT(p) ((guint)(guintptr)(p))

/* ── Limits ── */
#define G_MININT     INT_MIN
#define G_MAXINT     INT_MAX
#define G_MAXINT64   INT64_MAX
#define G_MAXUINT    UINT_MAX
#define G_MAXUINT8   UINT8_MAX
#define G_MAXUINT16  UINT16_MAX
#define G_MAXUINT32  UINT32_MAX
#define G_MAXUINT64  UINT64_MAX
#define G_MAXSIZE    SIZE_MAX
#define G_MAXINT16   INT16_MAX
#define G_MININT16   INT16_MIN
#define G_MAXFLOAT   FLT_MAX

/* ── Endian byte swap macros ── */
#if __BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__
  #define GUINT32_FROM_BE(x) __builtin_bswap32(x)
  #define GUINT32_TO_LE(x)   (x)
  #define GUINT16_TO_LE(x)   (x)
#else
  #define GUINT32_FROM_BE(x) (x)
  #define GUINT32_TO_LE(x)   __builtin_bswap32(x)
  #define GUINT16_TO_LE(x)   __builtin_bswap16(x)
#endif

/* ── g_once ── */
#define g_once(once, func, arg) g_once_impl((GOnce*)(once), (gpointer(*)(gpointer))(func), (gpointer)(arg))

/* ── GLib version macros ── */
#define G_ENCODE_VERSION(major, minor)  (((major) << 16) | ((minor) & 0xffff))
#define G_DEPRECATED              __attribute__((deprecated))
#define G_DEPRECATED_FOR(f)       __attribute__((deprecated("Use " #f)))
#define G_UNAVAILABLE(major,minor)

/* ── Memory ── */
#define g_new(type, count)       ((type*)malloc(sizeof(type) * (size_t)(count)))
#define g_new0(type, count)      ((type*)calloc((size_t)(count), sizeof(type)))
#define g_try_new(type, count)   ((type*)malloc(sizeof(type) * (size_t)(count)))
#define g_try_new0(type, count)  ((type*)calloc((size_t)(count), sizeof(type)))
#define g_try_malloc(size)       malloc(size)
#define g_try_malloc0(size)      calloc(1, size)
#define g_try_malloc_n(n,sz)     malloc((n)*(sz))
#define g_try_realloc(p,sz)      realloc(p,sz)
#define g_slice_new(type)        ((type*)malloc(sizeof(type)))
#define g_slice_alloc(sz)        malloc(sz)
#define g_slice_alloc0(sz)       calloc(1,sz)
#define g_slice_free1(sz,p)      free(p)
#define g_slice_free(type,p)     free(p)

static gpointer g_malloc(gsize n) { return malloc(n); }
static gpointer g_malloc0(gsize n) { return calloc(1, n); }
static gpointer g_malloc_n(gsize n, gsize sz) { return malloc(n*sz); }
static gpointer g_malloc0_n(gsize n, gsize sz) { return calloc(n, sz); }
static void g_free(gpointer p) { free(p); }
static gchar* g_strdup(const gchar *s) { return s ? strdup(s) : NULL; }
static gchar* g_strndup(const gchar *s, gsize n) {
    if (!s) return NULL;
#ifdef _WIN32
    gsize len = 0; while (len < n && s[len]) len++;
    gchar *r = malloc(len + 1); if (!r) return NULL;
    memcpy(r, s, len); r[len] = '\0'; return r;
#else
    return strndup(s, n);
#endif
}
static gpointer g_memdup(gconstpointer m, guint sz) { if(!m) return NULL; void *p=malloc(sz); if(p) memcpy(p,m,sz); return p; }

/* ── Atomic operations ── */
#define g_atomic_int_get(p)     atomic_load((_Atomic int*)(p))
#define g_atomic_int_set(p, v)  atomic_store((_Atomic int*)(p), (v))
#define g_atomic_int_inc(p)     (atomic_fetch_add((_Atomic int*)(p), 1))
#define g_atomic_int_dec_and_test(p) (atomic_fetch_sub((_Atomic int*)(p), 1) == 1)
#define g_atomic_int_add(p, v)  (atomic_fetch_add((_Atomic int*)(p), (v)))
#define g_atomic_pointer_get(p)      atomic_load((_Atomic void**)(p))
#define g_atomic_pointer_set(p, v)   atomic_store((_Atomic void**)(p), (v))

/* ── g_snprintf ── */
static inline gint g_snprintf(gchar *s, gulong n, const gchar *fmt, ...) {
    va_list ap; va_start(ap, fmt); gint r = vsnprintf(s, n, fmt, ap); va_end(ap); return r;
}
static inline gint g_vasprintf(gchar **s, const gchar *fmt, va_list ap) {
    va_list ap2; va_copy(ap2, ap); gint n = vsnprintf(NULL, 0, fmt, ap2); va_end(ap2);
    if (n < 0) return -1;
    *s = malloc((gsize)n+1); if (!*s) return -1;
    return vsnprintf(*s, (gsize)n+1, fmt, ap);
}

/* ── GString (dynamic string) ── */
typedef struct { gchar *str; gsize len; gsize allocated_len; } GString;

static inline GString* g_string_new(const gchar *init) {
    GString *gs = malloc(sizeof(GString)); if(!gs) return NULL;
    gs->len = init ? strlen(init) : 0;
    gs->allocated_len = gs->len + 64;
    gs->str = malloc(gs->allocated_len); if(!gs->str){free(gs);return NULL;}
    if(init) memcpy(gs->str, init, gs->len+1); else gs->str[0]='\0';
    return gs;
}
static inline GString* g_string_sized_new(gsize dfl) {
    GString *gs = malloc(sizeof(GString)); if(!gs) return NULL;
    gs->len = 0; gs->allocated_len = dfl > 0 ? dfl : 64;
    gs->str = malloc(gs->allocated_len); if(!gs->str){free(gs);return NULL;}
    gs->str[0]='\0'; return gs;
}
static inline void g_string_set_size(GString *gs, gsize len) {
    if(!gs) return;
    if(len+1 >= gs->allocated_len) { gs->allocated_len = (len+1)*2; gs->str = realloc(gs->str, gs->allocated_len); }
    gs->len = len; gs->str[len] = '\0';
}
static inline gchar* g_string_free(GString *gs, gboolean free_segment) {
    if(!gs) return NULL;
    gchar *s = free_segment ? NULL : gs->str;
    if(free_segment) free(gs->str);
    free(gs); return s;
}
#define g_string_free_and_steal(gs) g_string_free((gs), FALSE)

static inline GString* _gstr_grow(GString *gs, gsize extra) {
    if(!gs) return NULL;
    if(gs->len + extra + 1 > gs->allocated_len) {
        gs->allocated_len = (gs->len + extra + 1) * 2;
        gs->str = realloc(gs->str, gs->allocated_len);
    }
    return gs;
}
static inline GString* g_string_append(GString *gs, const gchar *v) {
    if(!gs||!v) return gs; gsize vl=strlen(v); _gstr_grow(gs, vl);
    memcpy(gs->str+gs->len, v, vl); gs->len+=vl; gs->str[gs->len]='\0'; return gs;
}
static inline GString* g_string_append_len(GString *gs, const gchar *v, gssize l) {
    if(!gs||!v||l<=0) return gs; _gstr_grow(gs, (gsize)l);
    memcpy(gs->str+gs->len, v, (gsize)l); gs->len+=(gsize)l; gs->str[gs->len]='\0'; return gs;
}
static inline GString* g_string_append_c(GString *gs, gchar c) {
    if(!gs) return gs; _gstr_grow(gs, 1);
    gs->str[gs->len++]=c; gs->str[gs->len]='\0'; return gs;
}
static inline GString* g_string_prepend(GString *gs, const gchar *v) {
    if(!gs||!v) return gs; gsize vl=strlen(v); _gstr_grow(gs, vl);
    memmove(gs->str+vl, gs->str, gs->len+1); memcpy(gs->str, v, vl); gs->len+=vl; return gs;
}
static inline GString* g_string_insert(GString *gs, gssize pos, const gchar *v) {
    if(!gs||!v) return gs; if(pos<0||(gsize)pos>gs->len) return gs;
    gsize vl=strlen(v); _gstr_grow(gs, vl);
    memmove(gs->str+pos+vl, gs->str+pos, gs->len-(gsize)pos+1);
    memcpy(gs->str+pos, v, vl); gs->len+=vl; return gs;
}
static inline GString* g_string_insert_c(GString *gs, gssize pos, gchar c) {
    if(!gs) return gs; if(pos<0||(gsize)pos>gs->len) return gs;
    _gstr_grow(gs, 1);
    memmove(gs->str+pos+1, gs->str+pos, gs->len-(gsize)pos+1);
    gs->str[pos]=c; gs->len++; gs->str[gs->len]='\0'; return gs;
}
static inline GString* g_string_insert_len(GString *gs, gssize pos, const gchar *v, gssize len) {
    if(!gs||!v||len<=0) return gs; if(pos<0||(gsize)pos>gs->len) return gs;
    _gstr_grow(gs, (gsize)len);
    memmove(gs->str+pos+len, gs->str+pos, gs->len-(gsize)pos+1);
    memcpy(gs->str+pos, v, (gsize)len); gs->len+=(gsize)len; return gs;
}
static inline GString* g_string_assign(GString *gs, const gchar *v) {
    if(!gs) return NULL; gs->len=0; return g_string_append(gs, v);
}
static inline GString* g_string_truncate(GString *gs, gsize len) {
    if(!gs||len>=gs->len) return gs; gs->len=len; gs->str[len]='\0'; return gs;
}
static inline GString* g_string_erase(GString *gs, gssize pos, gssize len) {
    if(!gs||pos<0||(gsize)pos>=gs->len) return gs;
    if(len<0||(gsize)(pos+len)>gs->len) len = (gssize)(gs->len - (gsize)pos);
    memmove(gs->str+pos, gs->str+pos+len, gs->len-(gsize)(pos+len)+1);
    gs->len-=(gsize)len; return gs;
}
static inline void g_string_printf(GString *gs, const gchar *fmt, ...) {
    if(!gs) return; va_list ap; va_start(ap, fmt);
    gint n = vsnprintf(NULL, 0, fmt, ap); va_end(ap);
    if(n<0) return;
    if((gsize)n+1 > gs->allocated_len) { gs->allocated_len = (gsize)n+64; gs->str = realloc(gs->str, gs->allocated_len); }
    va_start(ap, fmt); vsnprintf(gs->str, gs->allocated_len, fmt, ap); va_end(ap);
    gs->len = strlen(gs->str);
}

/* ── strdup_printf ── */
static inline gchar* g_strdup_printf(const gchar *fmt, ...) {
    va_list ap; va_start(ap, fmt); gint n = vsnprintf(NULL,0,fmt,ap); va_end(ap);
    if(n<0) return NULL; gchar *s=malloc((gsize)n+1); if(!s) return NULL;
    va_start(ap, fmt); vsnprintf(s,(gsize)n+1,fmt,ap); va_end(ap); return s;
}

/* ── g_strconcat ── */
static inline gchar* g_strconcat(const gchar *s1, ...) {
    va_list ap; const gchar *s; gsize len=0;
    va_start(ap,s1); s=s1; while(s){len+=strlen(s);s=va_arg(ap,const gchar*);} va_end(ap);
    gchar *r=malloc(len+1); if(!r) return NULL; gchar *p=r;
    va_start(ap,s1); s=s1; while(s){gsize l=strlen(s); memcpy(p,s,l); p+=l; s=va_arg(ap,const gchar*);} va_end(ap);
    *p='\0'; return r;
}

/* ── g_strjoin ── */
static inline gchar* g_strjoin(const gchar *sep, ...) {
    va_list ap; const gchar *s; gsize total=0, n=0, seplen=sep?strlen(sep):0;
    va_start(ap,sep); while((s=va_arg(ap,const gchar*))){total+=strlen(s);n++;} va_end(ap);
    total += (n>1 ? (n-1)*seplen : 0);
    gchar *r=malloc(total+1); if(!r) return NULL; gchar *p=r;
    va_start(ap,sep); n=0;
    while((s=va_arg(ap,const gchar*))){if(n++>0&&sep){memcpy(p,sep,seplen);p+=seplen;} gsize l=strlen(s); memcpy(p,s,l); p+=l;}
    va_end(ap); *p='\0'; return r;
}

/* ── g_strsplit ── */
static inline gchar** g_strsplit(const gchar *s, const gchar *delim, gint max) {
    if(!s || !delim) { gchar **r=malloc(sizeof(gchar*)); r[0]=NULL; return r; }
    gsize dlen=strlen(delim); if(dlen==0) { gchar **r=malloc(2*sizeof(gchar*)); r[0]=g_strdup(s); r[1]=NULL; return r; }
    gint cap=16, cnt=0; gchar **r=malloc((gsize)cap*sizeof(gchar*));
    const gchar *p=s;
    while(*p && (max<=0||cnt<max-1)) {
        const gchar *q=strstr(p, delim); if(!q) break;
        if(cnt>=cap-1){cap*=2;r=realloc(r,(gsize)cap*sizeof(gchar*));}
        r[cnt++]=g_strndup(p, (gsize)(q-p)); p=q+dlen;
    }
    if(cnt>=cap-1){cap++;r=realloc(r,(gsize)cap*sizeof(gchar*));}
    r[cnt++]=g_strdup(p); r[cnt]=NULL; return r;
}
static inline void g_strfreev(gchar **v) { if(v){for(gint i=0;v[i];i++) free(v[i]); free(v);} }

/* ── ASCII/unicode string utils ── */
static inline gint g_ascii_strcasecmp(const gchar *a, const gchar *b) {
    while(*a && *b) { gint ca=(guchar)*a, cb=(guchar)*b;
        if(ca>='A'&&ca<='Z')ca+='a'-'A'; if(cb>='A'&&cb<='Z')cb+='a'-'A';
        if(ca!=cb) return ca-cb; a++; b++; }
    return (guchar)*a - (guchar)*b;
}
static inline gint g_ascii_strncasecmp(const gchar *a, const gchar *b, gsize n) {
    if(n==0) return 0;
    for(gsize i=0; i<n; i++) { gint ca=(guchar)a[i], cb=(guchar)b[i];
        if(ca>='A'&&ca<='Z')ca+='a'-'A'; if(cb>='A'&&cb<='Z')cb+='a'-'A';
        if(ca!=cb) return ca-cb; if(!ca) return 0; }
    return 0;
}
static inline gunichar g_ascii_tolower(gunichar c) { return (c>='A'&&c<='Z')?c-'A'+'a':c; }
static inline gunichar g_ascii_toupper(gunichar c) { return (c>='a'&&c<='z')?c-'a'+'A':c; }

/* ── Unicode ── */
static inline gboolean g_unichar_isprint(gunichar c) { return c >= 0x20 && c != 0x7f; }
static inline gboolean g_unichar_iszerowidth(gunichar c) {
    return (c>=0x0300&&c<=0x036f)||(c>=0x0483&&c<=0x0489)||(c>=0x0591&&c<=0x05bd)||
           (c>=0x200b&&c<=0x200f)||(c>=0x2028&&c<=0x202e)||(c>=0x2060&&c<=0x2064)||
           (c>=0xfe00&&c<=0xfe0f)||c==0x200d||c==0xfeff;
}
static inline gboolean g_unichar_iswide(gunichar c) {
    return (c>=0x1100&&c<=0x115f)||(c>=0x2329&&c<=0x232a)||(c>=0x2e80&&c<=0x303e)||
           (c>=0x3041&&c<=0x33bf)||(c>=0x3400&&c<=0x4dbf)||(c>=0x4e00&&c<=0xa4cf)||
           (c>=0xa960&&c<=0xa97c)||(c>=0xac00&&c<=0xd7a3)||(c>=0xf900&&c<=0xfaff)||
           (c>=0xfe30&&c<=0xfe6f)||(c>=0xff01&&c<=0xff60)||(c>=0xffe0&&c<=0xffe6)||
           (c>=0x1b000&&c<=0x1b2ff)||(c>=0x1f200&&c<=0x1f2ff)||(c>=0x20000&&c<=0x2fffd)||
           (c>=0x30000&&c<=0x3fffd);
}
#define g_unichar_iswide_cjk(c) g_unichar_iswide(c)
static inline gboolean g_unichar_isalpha(gunichar c) { return (c>='A'&&c<='Z')||(c>='a'&&c<='z'); }
static inline gboolean g_unichar_isdigit(gunichar c) { return c>='0'&&c<='9'; }
static inline gboolean g_unichar_ismark(gunichar c) {
    return (c>=0x0300&&c<=0x036f)||(c>=0x1ab0&&c<=0x1aff)||(c>=0x1dc0&&c<=0x1dff)||
           (c>=0x20d0&&c<=0x20ff)||(c>=0xfe00&&c<=0xfe0f);
}

/* Unicode scripts (stubs) */
typedef enum { G_UNICODE_SCRIPT_COMMON=0, G_UNICODE_SCRIPT_ARABIC=2, G_UNICODE_SCRIPT_HEBREW=9,
    G_UNICODE_SCRIPT_THAANA=50, G_UNICODE_SCRIPT_SYRIAC=49, G_UNICODE_SCRIPT_LATIN=12 } GUnicodeScript;
static inline GUnicodeScript g_unichar_get_script(gunichar c) { (void)c; return G_UNICODE_SCRIPT_COMMON; }

/* UTF-8 */
static inline gint g_unichar_to_utf8(gunichar c, gchar *b) {
    if(c<0x80){b[0]=(gchar)c;return 1;}
    if(c<0x800){b[0]=(gchar)(0xc0|(c>>6));b[1]=(gchar)(0x80|(c&0x3f));return 2;}
    if(c<0x10000){b[0]=(gchar)(0xe0|(c>>12));b[1]=(gchar)(0x80|((c>>6)&0x3f));b[2]=(gchar)(0x80|(c&0x3f));return 3;}
    b[0]=(gchar)(0xf0|(c>>18));b[1]=(gchar)(0x80|((c>>12)&0x3f));b[2]=(gchar)(0x80|((c>>6)&0x3f));b[3]=(gchar)(0x80|(c&0x3f));return 4;
}
static inline gunichar g_utf8_get_char(const gchar *p) {
    gunichar r; guchar c=(guchar)*p;
    if(c<0x80) return c; if(c<0xc0) return (gunichar)-1;
    if(c<0xe0){r=c&0x1f; if((guchar)p[1]>>6!=2) return (gunichar)-1; r=(r<<6)|(p[1]&0x3f); return r;}
    if(c<0xf0){r=c&0x0f; if((guchar)p[1]>>6!=2||(guchar)p[2]>>6!=2) return (gunichar)-1; r=(r<<6)|(p[1]&0x3f); r=(r<<6)|(p[2]&0x3f); return r;}
    r=c&0x07; if((guchar)p[1]>>6!=2||(guchar)p[2]>>6!=2||(guchar)p[3]>>6!=2) return (gunichar)-1;
    r=(r<<6)|(p[1]&0x3f); r=(r<<6)|(p[2]&0x3f); r=(r<<6)|(p[3]&0x3f); return r;
}
static inline gunichar g_utf8_get_char_validated(const gchar *p, gssize max) {
    if(!p||max==0) return (gunichar)-1; return g_utf8_get_char(p);
}
static inline const gchar* g_utf8_next_char(const gchar *p) {
    if(!p||!*p) return p; guchar c=(guchar)*p; gsize skip=1;
    if(c>=0xe0&&c<0xf0)skip=3; else if(c>=0xc0&&c<0xe0)skip=2; else if(c>=0xf0&&c<0xf8)skip=4;
    return p+skip;
}
/* g_utf8_skip - maps first byte to UTF-8 char length */
static const guint8 _g_utf8_skip_data[256] = {
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,
    3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,4,4,4,4,4,4,4,4,5,5,5,5,6,6,1,1
};
#define g_utf8_skip (_g_utf8_skip_data)

/* ── Simple hash table ── */
typedef guint (*GHashFunc)(gconstpointer);
typedef gboolean (*GEqualFunc)(gconstpointer, gconstpointer);
typedef void (*GDestroyNotify)(gpointer);
typedef void (*GFunc)(gpointer, gpointer);

typedef struct _GHNode { struct _GHNode *next; gpointer key; gpointer value; } GHNode;
typedef struct {
    GHNode **buckets; gsize n_buckets, n_nodes;
    GHashFunc hash; GEqualFunc eq;
    GDestroyNotify key_del, val_del;
} GHashTable;

static guint g_direct_hash(gconstpointer v) { return (guint)(guintptr)v; }
static gboolean g_direct_equal(gconstpointer a, gconstpointer b) { return a==b; }
static guint g_int_hash(gconstpointer v) { return (guint)(gintptr)v; }
static gboolean g_int_equal(gconstpointer a, gconstpointer b) { return (gintptr)a==(gintptr)b; }
static guint g_str_hash(gconstpointer v) { const signed char *p=v; guint h=5381; if(p) while(*p) h=(h<<5)+h+(guint)*p++; return h; }
static gboolean g_str_equal(gconstpointer a, gconstpointer b) { return a&&b?strcmp(a,b)==0:a==b; }

static inline GHashTable* g_hash_table_new_full(GHashFunc hf, GEqualFunc ef, GDestroyNotify kd, GDestroyNotify vd) {
    GHashTable *ht=calloc(1,sizeof(GHashTable)); if(!ht) return NULL;
    ht->n_buckets=64; ht->buckets=calloc(64,sizeof(GHNode*)); if(!ht->buckets){free(ht);return NULL;}
    ht->hash=hf?hf:g_direct_hash; ht->eq=ef?ef:g_direct_equal; ht->key_del=kd; ht->val_del=vd; return ht;
}
static inline GHashTable* g_hash_table_new(GHashFunc hf, GEqualFunc ef) { return g_hash_table_new_full(hf,ef,NULL,NULL); }
static inline guint g_hash_table_size(GHashTable *ht) { return ht?(guint)ht->n_nodes:0; }

static inline gboolean g_hash_table_insert(GHashTable *ht, gpointer key, gpointer value) {
    if(!ht) return FALSE; guint h=ht->hash(key)%(guint)ht->n_buckets;
    GHNode *n=malloc(sizeof(GHNode)); if(!n) return FALSE;
    n->key=key; n->value=value; n->next=ht->buckets[h]; ht->buckets[h]=n; ht->n_nodes++; return TRUE;
}
static inline gboolean g_hash_table_replace(GHashTable *ht, gpointer key, gpointer value) {
    if(!ht) return FALSE; guint h=ht->hash(key)%(guint)ht->n_buckets;
    for(GHNode *n=ht->buckets[h]; n; n=n->next) { if(ht->eq(n->key,key)) { if(ht->val_del) ht->val_del(n->value); n->value=value; return TRUE; } }
    return g_hash_table_insert(ht,key,value);
}
static inline gpointer g_hash_table_lookup(GHashTable *ht, gconstpointer key) {
    if(!ht) return NULL; guint h=ht->hash(key)%(guint)ht->n_buckets;
    for(GHNode *n=ht->buckets[h]; n; n=n->next) { if(ht->eq(n->key,key)) return n->value; } return NULL;
}
static inline gboolean g_hash_table_remove(GHashTable *ht, gconstpointer key) {
    if(!ht) return FALSE; guint h=ht->hash(key)%(guint)ht->n_buckets;
    GHNode *prev=NULL;
    for(GHNode *n=ht->buckets[h]; n; prev=n, n=n->next) {
        if(ht->eq(n->key,key)) {
            if(prev) prev->next=n->next; else ht->buckets[h]=n->next;
            if(ht->key_del) ht->key_del(n->key); if(ht->val_del) ht->val_del(n->value);
            free(n); ht->n_nodes--; return TRUE;
        }
    }
    return FALSE;
}
static inline void g_hash_table_destroy(GHashTable *ht) {
    if(!ht) return;
    for(gsize i=0;i<ht->n_buckets;i++){GHNode *n=ht->buckets[i]; while(n){GHNode *nx=n->next; if(ht->key_del)ht->key_del(n->key); if(ht->val_del)ht->val_del(n->value); free(n); n=nx;}}
    free(ht->buckets); free(ht);
}
typedef struct { GHashTable *ht; GHNode *node; gsize bucket; gboolean started; } GHashTableIter;
static inline void g_hash_table_iter_init(GHashTableIter *it, GHashTable *ht) { memset(it,0,sizeof(*it)); it->ht=ht; }
static inline gboolean g_hash_table_iter_next(GHashTableIter *it, gpointer *key, gpointer *value) {
    GHashTable *ht=it->ht; if(!ht) return FALSE;
    while(it->bucket < ht->n_buckets && !it->node) { it->node = ht->buckets[it->bucket++]; }
    if(!it->node) return FALSE;
    if(key) *key=it->node->key; if(value) *value=it->node->value;
    it->node = it->node->next;
    return TRUE;
}

/* ── Simple dynamic array ── */
typedef struct { gchar *data; gsize len, alloc, elt_size; gboolean zero_term, clear; } GArray;
static inline GArray* g_array_new(gboolean zt, gboolean cl, guint es) {
    GArray *a=calloc(1,sizeof(GArray)); if(!a) return NULL; a->elt_size=es; a->zero_term=zt; a->clear=cl; return a;
}
static inline void g_array_set_size(GArray *a, guint len) {
    if(!a) return; gsize need=(gsize)len*a->elt_size+(a->zero_term?a->elt_size:0);
    gsize cur=(gsize)a->alloc*a->elt_size+(a->zero_term?a->elt_size:0);
    if(need>cur){a->alloc=len+(len/2)+8; gsize ns=(gsize)a->alloc*a->elt_size+(a->zero_term?a->elt_size:0); a->data=realloc(a->data,ns);}
    if(a->zero_term&&a->elt_size<=8) memset(a->data+(gsize)len*a->elt_size,0,a->elt_size);
    a->len=len;
}
static inline GArray* g_array_append_vals(GArray *a, gconstpointer d, guint n) {
    if(!a||!d||!n) return a; guint old=(guint)a->len; g_array_set_size(a,old+n);
    memcpy(a->data+(gsize)old*a->elt_size, d, (gsize)n*a->elt_size); return a;
}
#define g_array_append_val(a,v) do{GArray*_ga=(a);g_array_set_size(_ga,(guint)(_ga->len)+1);memcpy(_ga->data+((gsize)(_ga->len)-1)*_ga->elt_size,&(v),_ga->elt_size);}while(0)
#define g_array_index(a,t,i) (((t*)(void*)(a)->data)[i])
static inline gchar* g_array_free(GArray *a, gboolean free_seg) {
    if(!a) return NULL; gchar *d=free_seg?NULL:a->data; if(free_seg) free(a->data); free(a); return d;
}

/* ── Simple queue ── */
typedef struct _GQNode { struct _GQNode *next, *prev; gpointer data; } GQNode;
typedef struct { GQNode *head, *tail; guint length; } GQueue;
static inline GQueue* g_queue_new(void) { return calloc(1,sizeof(GQueue)); }
static inline void g_queue_push_head(GQueue *q, gpointer d) {
    if(!q) return; GQNode *n=malloc(sizeof(GQNode)); n->data=d; n->prev=NULL; n->next=q->head;
    if(q->head) q->head->prev=n; else q->tail=n; q->head=n; q->length++;
}
static inline gpointer g_queue_pop_tail(GQueue *q) {
    if(!q||!q->tail) return NULL; GQNode *n=q->tail; gpointer d=n->data;
    q->tail=n->prev; if(q->tail) q->tail->next=NULL; else q->head=NULL;
    free(n); q->length--; return d;
}
static inline void g_queue_free_full(GQueue *q, GDestroyNotify fn) {
    if(!q) return; GQNode *n=q->head;
    while(n){GQNode *nx=n->next; if(fn)fn(n->data); free(n); n=nx;} free(q);
}

/* ── Threading (minimal, pthread on POSIX, Win32 API on Windows) ── */
#ifdef _WIN32
typedef CRITICAL_SECTION GMutex;
typedef CONDITION_VARIABLE GCond;
typedef HANDLE GThread;

static inline void g_mutex_init(GMutex *m) { InitializeCriticalSection(m); }
static inline void g_mutex_clear(GMutex *m) { DeleteCriticalSection(m); }
static inline void g_mutex_lock(GMutex *m) { EnterCriticalSection(m); }
static inline void g_mutex_unlock(GMutex *m) { LeaveCriticalSection(m); }
static inline void g_cond_init(GCond *c) { InitializeConditionVariable(c); }
static inline void g_cond_clear(GCond *c) { (void)c; }
static inline void g_cond_signal(GCond *c) { WakeConditionVariable(c); }
static inline void g_cond_broadcast(GCond *c) { WakeAllConditionVariable(c); }
static inline void g_cond_wait(GCond *c, GMutex *m) { SleepConditionVariableCS(c, m, INFINITE); }
typedef struct { gint64 tv_sec; gint64 tv_usec; } GTimeVal;
static inline gboolean g_cond_wait_until(GCond *c, GMutex *m, gint64 end_time) {
    gint64 now; struct timespec ts; clock_gettime(CLOCK_MONOTONIC, &ts);
    now = (gint64)ts.tv_sec*1000000 + ts.tv_nsec/1000;
    if (now >= end_time) return FALSE;
    DWORD ms = (DWORD)((end_time - now) / 1000);
    if (ms == 0) ms = 1;
    return SleepConditionVariableCS(c, m, ms) ? TRUE : FALSE;
}
static inline gpointer g_thread_new(const gchar *name, void*(*func)(gpointer), gpointer data) {
    (void)name; HANDLE h = CreateThread(NULL, 0, (LPTHREAD_START_ROUTINE)func, data, 0, NULL);
    return (gpointer)h;
}
static inline void g_thread_join(gpointer thread) {
    if(!thread) return; WaitForSingleObject((HANDLE)thread, INFINITE); CloseHandle((HANDLE)thread);
}
#define g_thread_yield() Sleep(0)
#define g_thread_self() ((void*)(guintptr)GetCurrentThreadId())
#else
typedef pthread_mutex_t GMutex;
typedef pthread_cond_t GCond;
typedef pthread_t GThread;

static inline void g_mutex_init(GMutex *m) { pthread_mutex_init(m, NULL); }
static inline void g_mutex_clear(GMutex *m) { pthread_mutex_destroy(m); }
static inline void g_mutex_lock(GMutex *m) { pthread_mutex_lock(m); }
static inline void g_mutex_unlock(GMutex *m) { pthread_mutex_unlock(m); }
static inline void g_cond_init(GCond *c) { pthread_cond_init(c, NULL); }
static inline void g_cond_clear(GCond *c) { pthread_cond_destroy(c); }
static inline void g_cond_signal(GCond *c) { pthread_cond_signal(c); }
static inline void g_cond_broadcast(GCond *c) { pthread_cond_broadcast(c); }
static inline void g_cond_wait(GCond *c, GMutex *m) { pthread_cond_wait(c, m); }
typedef struct { gint64 tv_sec; gint64 tv_usec; } GTimeVal;
static inline gboolean g_cond_wait_until(GCond *c, GMutex *m, gint64 end_time) {
    struct timespec ts = { (time_t)(end_time/1000000), (long)((end_time%1000000)*1000) };
    int r = pthread_cond_timedwait(c, m, &ts); return r != ETIMEDOUT;
}
static inline gpointer g_thread_new(const gchar *name, void*(*func)(gpointer), gpointer data) {
    (void)name; pthread_t *t=malloc(sizeof(pthread_t)); pthread_create(t, NULL, func, data); return t;
}
static inline void g_thread_join(gpointer thread) {
    if(!thread) return; pthread_join(*(pthread_t*)thread, NULL); free(thread);
}
#define g_thread_yield() sched_yield()
#define g_thread_self() ((void*)(guintptr)pthread_self())
#endif

/* ── GError (forward declared for thread pool) ── */
typedef struct { guint domain; gint code; gchar *message; } GError;

/* Thread pool (simplified - single-threaded mode only) */
typedef struct { GMutex m; GCond c; GQueue *q; gpointer *threads; gint n_threads; } GThreadPool;
static inline GThreadPool* g_thread_pool_new(GFunc func, gpointer ud, gint max, gboolean excl, GError **err) {
    (void)func;(void)ud;(void)max;(void)excl;(void)err;
    GThreadPool *p=calloc(1,sizeof(GThreadPool)); if(!p) return NULL;
    g_mutex_init(&p->m); g_cond_init(&p->c); p->q=g_queue_new(); p->n_threads=max;
    return p;
}
static inline void g_thread_pool_push(GThreadPool *p, gpointer data, GError **err) {
    (void)err; if(!p) return; g_queue_push_head(p->q, data);
}
static inline void g_thread_pool_free(GThreadPool *p, gboolean imm, gboolean wait) {
    if(!p) return; (void)imm; (void)wait;
    g_queue_free_full(p->q, g_free); g_mutex_clear(&p->m); g_cond_clear(&p->c); free(p);
}

/* ── GOnce ── */
typedef struct { volatile int status; gpointer retval; } GOnce;
#define G_ONCE_INIT {0, NULL}
static inline gboolean g_once_init_enter(volatile void *loc) {
    GOnce *o = (GOnce*)loc;
    if(atomic_load((_Atomic int*)&o->status) == 0) return TRUE;
    while(atomic_load((_Atomic int*)&o->status) != 2);
    return FALSE;
}
static inline void g_once_init_leave(volatile void *loc, gsize result) {
    GOnce *o = (GOnce*)loc;
    o->retval = (gpointer)result;
    atomic_store((_Atomic int*)&o->status, 2);
}

/* ── Assertions ── */
#define g_assert(expr) do{if(!(expr)){fprintf(stderr,"ASSERT %s:%d: %s\n",__FILE__,__LINE__,#expr);abort();}}while(0)
#define g_assert_not_reached() do{fprintf(stderr,"ASSERT_NOT_REACHED %s:%d\n",__FILE__,__LINE__);abort();}while(0)
#define g_assert_true(expr) g_assert(expr)
static inline void g_return_if_fail_warning(const gchar *l, const gchar *f, const gchar *e) {
    fprintf(stderr, "RETURN_IF_FAIL(%s) at %s:%s\n", e, f, l);
}
#define g_return_if_fail(expr) do{if(!(expr)){g_return_if_fail_warning(G_STRFUNC,__FILE__,#expr);return;}}while(0)
#define g_return_val_if_fail(expr,v) do{if(!(expr)){g_return_if_fail_warning(G_STRFUNC,__FILE__,#expr);return(v);}}while(0)
#define G_STRFUNC __func__

/* ── Logging ── */
typedef enum { G_LOG_LEVEL_ERROR=4, G_LOG_LEVEL_CRITICAL=8, G_LOG_LEVEL_WARNING=16,
    G_LOG_LEVEL_MESSAGE=32, G_LOG_LEVEL_INFO=64, G_LOG_LEVEL_DEBUG=128 } GLogLevelFlags;
static inline void g_log(const gchar *dom, GLogLevelFlags lvl, const gchar *fmt, ...) {
    (void)dom;(void)lvl;(void)fmt;
}
static inline void g_error(const gchar *fmt, ...) {
    fprintf(stderr, "FATAL ERROR: "); va_list ap; va_start(ap, fmt); vfprintf(stderr, fmt, ap); va_end(ap); fprintf(stderr, "\n"); abort();
}
static inline void g_assertion_message_expr(const gchar *dom, const gchar *file, gint line,
                                             const gchar *func, const gchar *expr) {
    fprintf(stderr, "ASSERTION FAILED: %s:%d:%s: %s\n", file, line, func, expr); abort();
}

/* ── GError functions ── */
static inline void g_set_error(GError **err, guint d, gint c, const gchar *fmt, ...) {
    (void)err;(void)d;(void)c;(void)fmt;
}
#define g_clear_error(e) do{if(e&&*e){free(*e);*e=NULL;}}while(0)

/* Quark and option error support */
#define G_DEFINE_QUARK(QN,qn)
#define G_OPTION_ERROR 0
#define G_OPTION_ERROR_BAD_VALUE 1
#define G_OPTION_ERROR_FAILED 2

/* ── Quark ── */
static inline GQuark g_quark_from_static_string(const gchar *s) { (void)s; return 1; }
static inline GQuark g_quark_from_string(const gchar *s) { (void)s; return 1; }

/* ── Time ── */
static inline gint64 g_get_monotonic_time(void) {
#ifdef _WIN32
    LARGE_INTEGER freq, cnt;
    QueryPerformanceFrequency(&freq);
    QueryPerformanceCounter(&cnt);
    return (gint64)(cnt.QuadPart * 1000000 / freq.QuadPart);
#else
    struct timespec ts; clock_gettime(CLOCK_MONOTONIC, &ts);
    return (gint64)ts.tv_sec*1000000 + ts.tv_nsec/1000;
#endif
}
static inline guint g_get_num_processors(void) { return 1; }

/* ── Environment ── */
static inline const gchar* g_environ_getenv(gchar **envp, const gchar *name) {
    if(!envp||!name) return NULL; gsize nl=strlen(name);
    for(gint i=0; envp[i]; i++) { if(!strncmp(envp[i],name,nl) && envp[i][nl]=='=') return envp[i]+nl+1; }
    return NULL;
}
#ifdef _WIN32
static inline gchar** g_get_environ(void) { return NULL; }
#else
static inline gchar** g_get_environ(void) { extern char **environ; return environ; }
#endif

/* ── g_once_impl ── */
static inline gpointer g_once_impl(GOnce *once, void*(*func)(gpointer), gpointer arg) {
    if(atomic_load((_Atomic int*)&once->status)==2) return once->retval;
    if(g_once_init_enter(once)) { gpointer r=func(arg); g_once_init_leave(once,(gsize)r); return r; }
    return once->retval;
}

/* ── Types needed by chafa but not in original section ── */
typedef struct { gint fd; gushort events, revents; } GPollFD;
#define G_IO_IN  1
#define G_IO_OUT 4
#define G_IO_HUP 16
#define G_IO_ERR 8
#define G_SOURCE_REMOVE FALSE
#define G_SOURCE_CONTINUE TRUE
typedef gboolean (*GSourceFunc)(gpointer);
typedef void* (*GThreadFunc)(gpointer);

/* ── Poll ── */
static inline gint g_poll(GPollFD *fds, guint n, gint timeout) {
#ifdef _WIN32
    (void)fds;(void)n;(void)timeout; return 0;
#else
    struct pollfd *p = malloc(sizeof(struct pollfd)*n);
    for(guint i=0; i<n; i++) { p[i].fd=fds[i].fd; p[i].events=0;
        if(fds[i].events&G_IO_IN) p[i].events|=POLLIN;
        if(fds[i].events&G_IO_OUT) p[i].events|=POLLOUT; }
    gint r = poll(p, (nfds_t)n, timeout);
    for(guint i=0; i<n; i++) { fds[i].revents=0;
        if(r>0&&p[i].revents&POLLIN) fds[i].revents|=G_IO_IN;
        if(r>0&&p[i].revents&POLLOUT) fds[i].revents|=G_IO_OUT; }
    free(p); return r;
#endif
}

/* ── Unix ── */
static inline gint g_unix_open_pipe(gint *fds, gint flags, GError **err) {
    (void)err;(void)flags;
#ifndef _WIN32
    return pipe(fds);
#else
    (void)fds; return -1;
#endif
}
static inline gboolean g_unix_set_fd_nonblocking(gint fd, gboolean nb, GError **err) {
    (void)err;(void)nb;(void)fd;
#ifndef _WIN32
    gint fl=fcntl(fd,F_GETFL,0); if(nb) fl|=O_NONBLOCK; else fl&=~O_NONBLOCK; fcntl(fd,F_SETFL,fl);
#endif
    return TRUE;
}

/* ── Event loop stubs ── */
static inline guint g_idle_add(gboolean(*fn)(gpointer), gpointer d) { (void)fn;(void)d; return 0; }
static inline gboolean g_source_remove(guint tag) { (void)tag; return TRUE; }

/* ── Win32 helpers ── */
#ifdef _WIN32
static inline gchar* g_win32_error_message(guint32 err) {
    (void)err; return g_strdup("Unknown error");
}
#endif

/* ── GPid ── */
#ifdef _WIN32
typedef void* GPid;
#else
typedef pid_t GPid;
#endif

#endif /* GLIB_MINI_H */