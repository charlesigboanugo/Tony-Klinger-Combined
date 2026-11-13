# To connect / to do

Only what is still waiting — an account, keys, a decision or information. When one is ready,
say "do the <name> item" and point at this file. Finished items are removed; their record is
in `docs/architecture/` (built work) and `docs/deployment.md` (launch steps).

---

## 1. Vimeo — paid video

**Waiting on:** Tony's Vimeo account being connected.

- Paid videos uploaded to Tony's Vimeo, each set to **unlisted** and **restricted to the
  site's domains** (tonyklinger.com, and localhost for development).
- Each lesson or playlist video then gets its Vimeo link in Admin.

The site side is built: the video fields, Vimeo playback, and withholding the link from
anyone without access (architecture note 09 §40.1). Public videos stay on YouTube.
