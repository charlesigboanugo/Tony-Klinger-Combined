# TONYKLINGER_COMBINED_WEBSITE

Production web application for Tony Klinger at `tonyklinger.com`.

## Architecture is version-controlled

The canonical architecture lives in [docs/architecture/](docs/architecture/).
Read [docs/architecture/README.md](docs/architecture/README.md) before non-trivial work.

## Standing rule: keep architecture in sync — unprompted

Whenever a change is made that alters the system's architecture, update the relevant
document in `docs/architecture/` **as part of that same change**, and add a row to the
Change Log in `docs/architecture/README.md`.

Do this automatically. Do **not** wait to be asked, and do not ask permission first —
detect that the change is architectural and record it.

Architectural triggers include: new/renamed routes or application areas; new product
types, membership tiers, or entitlement rules; changes to the
payment → order → entitlement → access/booking chain; new or changed external services,
integrations, or webhooks; new background/scheduled processes; new database entities or
changed entity roles; changes to authorization, roles, or RLS; changes to the design
system, theming, or navigation model; and any deliberate deviation from a documented rule.

Local implementation detail (component internals, styling tweaks, model-preserving
refactors) does not require an update.

When the user pastes a new architecture note, save it verbatim into
`docs/architecture/` under the filename it declares, add it to the README index table,
and reconcile it against the existing notes — flagging any contradiction rather than
silently resolving it.
