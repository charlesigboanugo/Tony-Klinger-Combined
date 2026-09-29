import { z } from "zod";

/*
  Every client-side schema imports Zod from here. Zod probes `new Function("")`
  when it builds an object schema, to decide whether it may compile parsers;
  the CSP refuses eval, so the probe logged a violation on every page with a
  form. `jitless` skips it — the interpreted parser is what already ran. Set in
  this module so it is in place before any schema below it is built.
*/
z.config({ jitless: true });

export { z };
