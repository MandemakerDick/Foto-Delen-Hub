---
name: Multi-artifact publishing
description: Replit's publishing boundary for projects with several artifacts
---

A republish in this workspace publishes all project artifacts as a single unit; PhotographersHub cannot be republished independently from sibling artifacts within the same project. The user must initiate Republish in Replit's Publishing tool; the agent can verify readiness and the live deployment but cannot perform that click.

**Why:** Replit's current Projects and Artifacts publishing documentation states that multi-artifact projects publish together so the shared backend and artifacts stay in sync. A request to republish “the web app” can therefore include changes to sibling artifacts that are still awaiting phone QA.

**How to apply:** Check the active deployment with the deployment service before sharing a production URL or status. Explain the all-artifact consequence when a user requests a selective republish, and do not claim it completed until a new successful build is confirmed after the user initiates it.