# To connect / to do

Only what is still waiting — an account, keys, a decision or information. When one is ready,
say "do the <name> item" and point at this file. Finished items are removed; their record is
in `docs/architecture/` (built work) and `docs/deployment.md` (launch steps).

---

## 1. Livid — paid video and session recordings

**Waiting on:** the paid videos and recordings being uploaded to Livid (the account works:
a test video played on the site, 2026-11-13).

- Paid videos uploaded to Tony's Livid, each set to **private** and **restricted to the site's
  domains** (tonyklinger.com, and localhost for development).
- Each lesson or playlist video then gets its Livid link in Admin.
- **Session recordings** the same way: Tony records in Zoom, uploads the recording to Livid,
  and its Livid link is attached as the session's Recording (Group Coaching, workshops, the
  Q&A). Members with access see the replay in the Academy once the session ends.
- The player address is confirmed (`livid.com/embed/<id>`; paste either the watch or embed
  link in Admin). Before going live, check one paid video is set to **private** and plays
  only on tonyklinger.com.

The site side is built: the video fields, Livid playback, and withholding the link from
anyone without access (architecture note 09 §40.1). Public videos stay on YouTube. Vimeo
links still play, for anything already on Vimeo.
