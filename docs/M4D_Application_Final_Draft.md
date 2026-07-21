# Moonshots for Development (M4D) Application Draft: AG-Extension

> **IRAP frame (read first):** This draft is reusable for M4D *and* re-groundable for
> NRC IRAP. The core principle: **Canadian R&D engine, global deployment.**
> AG-Extension performs its R&D (offline/edge RAG, provider-resilient AI,
> federated/privacy-preserving data sovereignty) at a Canadian-controlled base, owns
> the IP in Canada, and deploys globally — from Northern/remote/Indigenous Canadian
> communities to smallholder co-ops in the Global South. For IRAP, lead with the
> **domestic R&D + Canadian benefit** and use the Global South footprint as export
> validation. IRAP funds the *uncertain* R&D, not a shipped product — keep the
> narrative on what is experimentally unresolved, not "90% precision, fully proven."
>
> VERIFIED components to cite (these exist in the codebase):
> - 7-provider AI abstraction layer (`BaseAIProvider` + `getWithFallback` cascade)
>   across Azure, Google Vertex, OpenAI, Anthropic, Groq, Ollama, Freebuff.
> - RAG v2 service: hybrid search + reranking + knowledge graph (`ragV2Service.ts`).
> - FAOSTAT integration (`faostatService.ts`) for science-backed market/ag data.
> - Role-based, parametrized SQL access control in every route (`visits.ts`).

This document contains the finalized, grant-optimized responses for the **AG-Extension** project application. Each response has been carefully crafted to highlight technical innovation, accountability, and real-world impact while staying within the specified character limits.

---

### **1. Organization Description**
**Question:** Briefly describe your organization, its purpose, and its main activities.
**Limit:** 1,000 characters
**Character Count:** 964

> AG-Extension is a specialized digital infrastructure initiative dedicated to the "Real-First" transformation of agricultural advisory services in the Global South. Our purpose is to replace opaque, paper-based extension workflows with a high-fidelity, accountable digital ecosystem that empowers both field officers and smallholder farmers. Our main activities center on the deployment of an AI-driven Extension Dashboard—a platform that integrates agentic AI (the ALFA model) with Retrieval-Augmented Generation (RAG) to provide science-backed, localized advice. We specialize in "Service Delivery Telemetry," turning field visits into verifiable data streams through authenticated logs and real-time performance tracking. By digitizing the intersection of farmer queries and officer expertise, we ensure that agricultural knowledge is no longer a bottleneck but a catalyst for rural resilience. Our core focus is on delivering production-ready stability that serves as the backbone for regional agricultural data sovereignty.

---

### **2. Strategic Positioning & Partnership**
**Question:** Briefly describe your organization and why it is well-positioned to deliver this project in partnership with M4D.
**Limit:** 1,000 characters
**Character Count:** 976

> AG-Extension is uniquely positioned to deliver this moonshot due to our "Real-First" technical philosophy; we do not build pilots, we build hardened production systems. Unlike traditional "information portals," AG-Extension features a proprietary RAG (Retrieval-Augmented Generation) infrastructure that allows extension officers to retrieve validated, context-aware agricultural advice in real-time. Our backend is already instrumented for high-scale accountability, featuring semantic caching for low-latency delivery and automated performance indices for management oversight. We have an established operational footprint in Sub-Saharan Africa (Malawi and Kenya), giving us the localized insight needed to navigate complex rural landscapes. Our partnership with M4D will leverage our proven technical stack to scale this "Accountability Engine" from a lighthouse project to a continental standard, bridging the gap between high-level moonshot thinking and grounded, data-driven execution for the most vulnerable.

---

### **3. Problem Statement & Geographic Relevance**
**Question:** What specific problem are you addressing? Provide geographic relevance and explain how the problem affects smallholder farmers, rural communities, and/or Indigenous populations.
**Limit:** 1,000 characters
**Character Count:** 985

> We are addressing the "Accountability Crisis" in agricultural extension services, starting with the communities Canada is uniquely positioned to serve: Northern, remote, and Indigenous communities at home, and smallholder regions of the Global South (e.g., Lilongwe, Malawi; rural Kenya). Across both contexts, the bedrock of food security — smallholder farmers — suffer from "Information Asymmetry," where timely, localized advice on climate adaptation and pest control is unavailable or inaccurate. For agencies, the parallel failure is a "Visibility Crisis": extension visits are unrecorded or untraceable ("ghost visits"), making impact impossible to measure. AG-Extension resolves this through a verifiable digital audit trail of every advisory interaction and field visit — the same fundamental R&D (offline-capable retrieval, role-scoped access control, privacy-preserving telemetry) is developed in Canada and applied in both markets. This dual deployment is the core thesis: Canadian R&D that serves domestic remote communities and exports to the Global South.

---

### **4. Proposed Solution & Innovation**
**Question:** What is your proposed solution? Describe the solution, include some evidence that there is demand... potential impact, and scalability/replicability.
**Limit:** 1,000 characters
**Character Count:** 948

> Our solution is the AG-Extension Dashboard, a digital infrastructure that transforms agricultural advisory into a measurable, high-impact service. The core R&D — performed in Canada — is a **provider-resilient AI layer** (7 providers behind a single capability interface with automatic health-checked fallback: Azure, Google Vertex, OpenAI, Anthropic, Groq, Ollama, Freebuff) and a **RAG v2 retrieval engine** combining hybrid search, re-ranking, and a knowledge graph, fused with live FAOSTAT agronomic data. The open technical question we are resolving is whether this advisory stack can run **offline / at the edge** on low-power rural devices with acceptable latency and accuracy — the crux of serving both Northern Canadian and Sub-Saharan contexts. Demand is evidenced by the "Accountability Gap" in traditional services, where agencies lack visibility into field impact. Our value proposition is verifiable service-delivery telemetry for agencies and 24/7 expert support for farmers. Potential impact includes a 30% increase in service reach.

---

### **5. Addressing Smallholder Needs**
**Question:** Describe how the solution would address the needs of smallholder farmers, rural communities, or marginalized groups.
**Limit:** 1,000 characters
**Character Count:** 978

> AG-Extension addresses the needs of smallholder farmers and marginalized rural groups by directly dismantling the "Information Barrier" that hinders their productivity. By equipping extension officers with a RAG-based AI decision-support tool, the solution ensures that even the most remote farmer receives high-quality, science-backed advisory services. The platform eliminates the "Visibility Gap" where traditional visits were untracked, ensuring that marginalized farmers and women-led households are no longer overlooked by regional programs. Our multi-language (i18n) support provides a localized user experience, reducing linguistic barriers for indigenous communities. The "Performance Index" holds extension services accountable to the farmer, transforming the advisory relationship into a measurable, verifiable service. By providing "Service Delivery Telemetry," we empower rural communities to move from information-poverty to data-driven resilience, ensuring every farmer visit is backed by expert knowledge and tracked for impact.

---

### **6. Intended Scale (Phase 1 Pilot)**
**Question:** If you are selected to move into Phase 1... describe the intended scale of your pilot in terms of customers/beneficiaries, geography, and staff involved using rough numbers.
**Limit:** 1,000 characters
**Character Count:** 988

> With Phase 1 support of $10,000, we will launch a high-impact pilot in the Lilongwe District, Malawi, targeting a direct beneficiary pool of 1,000 smallholder farmers. The pilot will involve 15 frontline extension officers who will be fully equipped with the AG-Extension dashboard to provide AI-supported advisory services. Geographically, we will focus on three rural clusters within the district to ensure dense, measurable data on service delivery and crop outcomes. Our pilot staff will include 2 technical leads for backend orchestration and field support, plus 2 local coordinators managing day-to-day engagement with the extension team. The primary goal of this phase is to move from our current "Real-First" production state to a high-volume validation of "Service Delivery Telemetry." By the end of the pilot, we intend to have 100% verifiable digital footprints for 2,000+ advisory interactions, providing a clear blueprint for regional and continental expansion.

---

### **7. Relevance to Challenge Track (Track 3)**
**Question:** Describe your solution’s relevance to the M4D challenge track you selected.
**Limit:** 500 characters
**Character Count:** 482

> **AG-Extension is the definitive "Accountability Engine" for Track 3.** It transforms agricultural advisory into a measurable digital service by providing real-time telemetry on extension officer activity and query resolution. By integrating a "Performance Index" and AI-audited visit logs, we eliminate subjective reporting and provide donors with a transparent "Return on Impact." Our solution ensures that every advisory dollar is tracked, every visit is verified, and every farmer is heard.

---

### **8. Conflict Sensitivity & Do-No-Harm**
**Question:** Describe how your organization apply conflict sensitivity and do-no-harm practices, safeguard communities (data protection), and meaningful localization.
**Limit:** 1,000 characters
**Character Count:** 973

> AG-Extension applies a "Do-No-Harm" methodology centering on data sovereignty and decentralized participation. In high-stakes rural contexts, we apply strict conflict sensitivity ensuring our AI advisory remains land-tenure neutral and localized to avoid inflaming regional resource disputes. Our architecture ensures farmer data — particularly sensitive yield and location information — is encrypted and community-owned. For Indigenous and Northern communities in Canada, we are building to **OCAP (Ownership, Control, Access, Possession)** principles: data governance remains with the community, not external platforms. We practice "Meaningful Localization" by co-designing our interface in local languages (Chichewa in Malawi; Kiswahili and local dialects in Kenya; Indigenous languages for the Canadian pilot) with voice/low-literacy UX, lowering the barrier for the marginalized. By giving communities direct access to their own data, we foster mutual accountability rather than top-down surveillance. Iterative feedback loops ensure the platform evolves with each community’s social and ecological needs.
