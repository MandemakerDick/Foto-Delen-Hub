---
name: Photographer ownership rollout
description: Intended account/profile cardinality and approval boundary for legacy ownership data
---

Keep photographer ownership one-to-one: each account may own at most one
photographer profile, while unclaimed profiles remain permitted. Linking an
already-owned same profile is not an ownership transfer.

**Why:** The intended self-service profile policy is one profile per account;
browser invitations must not bypass that rule. Existing duplicate ownership may
represent valuable profiles and photos, so technical enforcement is not consent
to choose which profile a person keeps.

**How to apply:** New ownership features must preserve this cardinality. Before
changing legacy ownership records, obtain an explicit per-account plan approved
by the project owner. Do not automatically retain the first profile, unlink the
others, merge them, or delete their photos. A prepared migration is not proof it
has been approved or applied in production.