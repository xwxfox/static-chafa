/* chafa_quarks.c — Quark functions needed by chafa */
#include "glib_mini.h"

GQuark chafa_term_info_error_quark(void) { static GQuark q=0; if(!q) q=g_quark_from_static_string("chafa-term-info-error-quark"); return q; }
GQuark g_option_error_quark(void) { static GQuark q=0; if(!q) q=g_quark_from_static_string("g-option-error-quark"); return q; }
