import { z } from "zod";

// Runs in the browser before the app's own modules. Zod probes
// `new Function("")` when it builds an object schema, to decide whether it may
// compile parsers; the CSP refuses eval, so every page logged a violation.
// jitless skips the probe; the interpreted parser is what already ran.
z.config({ jitless: true });
