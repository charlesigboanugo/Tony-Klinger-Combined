# Give-Get-Go — Navigation & Content Architecture

## Purpose

Give-Get-Go is Tony Klinger’s broader venture/arm encompassing areas including **Publishing, Films and Documentaries**, with **Give-Get-Go Education CIC** as a related education venture.

The Tony Klinger website should present Give-Get-Go clearly as part of Tony’s wider work while keeping the separate Give-Get-Go Education website independent.

## Main Navigation

Give-Get-Go should be a primary item in the Tony Klinger website navigation with a dropdown submenu:

```text
Give-Get-Go
├── Overview
├── Publishing
├── Films
├── Documentaries
└── Give-Get-Go Education
```

## Overview

**Give-Get-Go → Overview** should take the visitor to a dedicated Give-Get-Go overview page on TonyKlinger.com.

The page should explain the purpose of Give-Get-Go and introduce its different areas of activity.

The overview should provide context rather than attempting to recreate a separate Give-Get-Go platform.

## Publishing

**Give-Get-Go → Publishing** should take the visitor to the relevant publishing content on TonyKlinger.com.

This may include Tony's books, forthcoming publications, the Give-Get-Go Books publishing imprint and other relevant publishing projects.

Where appropriate, existing Catalogue content should be reused rather than unnecessarily duplicated.

## Films

**Give-Get-Go → Films** should take the visitor to the relevant film content on TonyKlinger.com.

This should make use of the site's existing Catalogue/content architecture where appropriate and may include Tony's films and associated film projects.

## Documentaries

**Give-Get-Go → Documentaries** should take the visitor to the relevant documentary content on TonyKlinger.com.

Existing Catalogue content should be used where appropriate rather than creating duplicate content structures.

## Give-Get-Go Education

**Give-Get-Go → Give-Get-Go Education** is different from the other submenu items.

Give-Get-Go Education CIC has its **own independent website and platform**.

Clicking this submenu item should therefore take the visitor **to the external Give-Get-Go Education website**, rather than to another section of TonyKlinger.com.

The navigation should make the external destination clear, preferably with an external-link indicator such as `↗`.

```text
TonyKlinger.com
     │
     └── Give-Get-Go
          │
          ├── Overview       → TonyKlinger.com
          ├── Publishing    → TonyKlinger.com
          ├── Films         → TonyKlinger.com
          ├── Documentaries → TonyKlinger.com
          └── Education     → External Give-Get-Go Education website ↗
```

## Relationship Between Give-Get-Go and Give-Get-Go Education

Give-Get-Go Education CIC should be presented as a **related education venture associated with Give-Get-Go**, not as a section of the Tony Klinger Academy.

The Tony Klinger website may provide brief context about Give-Get-Go Education, but its full website, platform, functionality and content remain external.

## Content Architecture Rule

Publishing, Films and Documentaries should use the Tony Klinger site's existing content/Catalogue architecture wherever possible.

Do not create duplicate content merely to satisfy the Give-Get-Go navigation.

Give-Get-Go Education should remain an external destination and must not be incorporated into the Tony Klinger application's Academy or Admin functionality.

## Implementation Rule

Claude should implement Give-Get-Go as a **navigation and content grouping within the Tony Klinger website**, not as a separate application.

The final navigation should clearly communicate:

**Give-Get-Go = Tony Klinger’s broader venture/arm**

while:

**Give-Get-Go Education = related education venture with its own independent website.**

---

# Resolution — how the sections draw their content

*Added 2026-09-03 when R25 was closed. The note's original wording above is unaltered;
this section records how its Content Architecture Rule is satisfied.*

All three internal sections are **tag-filtered views over `catalogue_items`** (note 08
§28.2.1). No content is duplicated, no new content entity exists, and no eighth Catalogue
category is added:

```text
give-get-go:publishing     → Publishing
give-get-go:films          → Films
give-get-go:documentaries  → Documentaries
```

**Why tags rather than a category mapping.** Every section needs curation, not only
Documentaries. This note describes Publishing as "the Give-Get-Go Books publishing
imprint" — a *subset* of Tony's books, not the whole `books` category — and the same holds
for Films. So mapping a section onto a whole category would have been wrong even for the
two that appeared to fit, and would have shown works that have nothing to do with
Give-Get-Go.

**Documentaries needed no new category.** A documentary is a film. It lives in the `films`
category at its canonical URL and appears here by tag. The seven categories fixed by R9
are media types; a documentary is a genre of one of them, and admitting it as a category
would invite every other genre to follow.

**Curation is an administrative act.** Tags are edited in `/admin/catalogue` under the
existing `catalogue.update` permission. Adding a work to a Give-Get-Go section is
therefore an editorial decision made by a person, not a rule inferred from the data —
which is what this note's Content Architecture Rule requires.

---

# Document History

| Date | Amendment |
|------|-----------|
| 2026-09-02 | Initial version recorded as supplied, wording unaltered. The note declared no filename; numbered `11-` and named from its own title, following the convention of notes 01–10. The external Give-Get-Go Education destination was supplied separately by the user as `give-get-go.com`. Opens R25 — the submenu names Documentaries, which is not one of the seven canonical Catalogue categories fixed by note 03 §7 (closed as R9), so the content source for that page is undecided. |
