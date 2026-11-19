# PharmaChain: Permissioned Blockchain-Based Drug Traceability System
## Alignment with UN Sustainable Development Goal 3 (Good Health and Well-Being)
### Technical Submission, Architecture & Cryptographic Audit Dossier

---

## Executive Summary

Counterfeit, substandard, and falsified pharmaceuticals represent a critical global health crisis, particularly across developing supply chains where data fragmentation between manufacturers, distributors, and dispensing pharmacies prevents timely verification. When combined with delayed paper-based recalls, compromised medicines reach vulnerable patients, causing preventable mortality and severe economic loss.

**PharmaChain** is a permissioned pharmaceutical supply chain traceability system modeled on **Hyperledger Fabric v2.5** and **CouchDB World State**. Developed in TypeScript, React, and the Web Crypto API, the system implements cryptographic guarantees—including:
1. **Per-Organization ECDSA P-256 Key Pairs** (Membership Service Provider simulation);
2. **Deterministic SHA-256 Block Hashing & Merkle Trees**;
3. **Execute-Order-Validate Pipeline** with multi-peer endorsement policies (e.g. `AND('Sender.peer', 'Recipient.peer')`);
4. **Multi-Version Concurrency Control (MVCC) Read-Write Sets** preventing double-spends;
5. **Private Data Collections (PDC / SideDBs)** preserving commercial price confidentiality;
6. **Real-time Event-Driven Statutory Recalls** broadcasting instant holder quarantine alerts;
7. **Zero-login Public Consumer QR Verification** with continuous optical decoding (`jsqr`).

---

## 1. Problem Statement & Academic Grounding

### 1.1 The Challenge in Developing Markets
In fragmented pharmaceutical distribution networks (such as in Kenya and broader Sub-Saharan Africa), drugs move through complex handoffs:
- **Manufacturers** (e.g., Dawa Life Sciences, Universal Corporation, Cosmos Limited);
- **National / Regional Distributors** (e.g., Kenya Medical Supplies Authority [KEMSA], Mission for Essential Drugs and Supplies [MEDS]);
- **Dispensing Endpoints** (e.g., Kenyatta National Hospital Pharmacy, retail pharmacies like Goodlife).

Because each entity maintains independent, siloed database systems, two primary failure modes emerge:
1. **Counterfeit Infiltration**: Cloned or fake batch numbers are introduced mid-stream without cryptographic provenance.
2. **Delayed Regulatory Recalls**: Paper circulars or email notices from the Pharmacy and Poisons Board (PPB) take days or weeks to propagate down to dispensing counters, during which patients continue receiving compromised medications.

### 1.2 UN SDG 3 Alignment
This project directly targets **United Nations Sustainable Development Goal 3: Ensure healthy lives and promote well-being for all at all ages**, specifically:
- **Target 3.8**: *"Achieve universal health coverage, including financial risk protection, access to quality essential health-care services and access to safe, effective, quality and affordable essential medicines and vaccines for all."*
- **Target 3.b**: *"Support the research and development of vaccines and medicines for the communicable and non-communicable diseases that primarily affect developing countries..."*

### 1.3 Literature Review & Citations
- **[12] Uddin, M. et al. (2021)**: *"Blockchain for drug traceability: Architectures and open challenges."* Health Informatics Journal / PubMed & ScienceDirect. Analyzes multi-party authorization bottlenecks and data integrity failures in centralized healthcare databases.
- **[16] Musamih, A. et al. (2021)**: *"A blockchain-based approach for drug traceability in healthcare supply chain."* IEEE Access / Khalifa University. Outlines the execute-order-validate paradigm for smart contracts governing batch custody handoffs.

---

## 2. Core Architecture: Mapping Hyperledger Fabric to PharmaChain

Since enterprise Hyperledger Fabric nodes (Docker peers, Raft orderers, Fabric CA) cannot execute natively inside client browser sandboxes, PharmaChain implements a faithful architectural mapping:

| Enterprise Production Component | PharmaChain Browser Simulation | Module Location | Technical Implementation |
| :--- | :--- | :--- | :--- |
| **Fabric CA & MSP Keystore** | Web Crypto API P-256 Key Pairs | `src/crypto.ts` | `window.crypto.subtle.generateKey('ECDSA', 'P-256')`, deterministic JSON canonicalization, signature generation & verification. |
| **Smart Contract (Chaincode)** | Role-Based Access Control Contract | `src/chaincode.ts` | Functions: `registerBatch`, `transferBatch`, `receiveBatch`, `dispenseUnits`, `flagBatch`, `recallBatch`, `verifyBatch`. |
| **Raft Ordering Service** | Block Cutting & Linking Engine | `src/ledger.ts` | Calculates block header SHA-256, links `previousHash`, builds Merkle Trees, and sequences transactions. |
| **CouchDB World State** | Key-Value State DB + Persistence | `src/store.ts` | Keyed by `batchNo`, stores latest quantities, holders, and MVCC version numbers (`v1, v2...`), synchronized in `localStorage`. |
| **Peer Event Hub (`ctx.stub.setEvent`)** | `PharmaChainEventBus` | `src/store.ts` | Pub/sub event bus triggering real-time banners when PPB issues statutory recall directives. |
| **Private Data Collections (SideDBs)** | Off-chain Confidential Store | `src/privatedata.ts` | Stores unit wholesale pricing and tender numbers; stores only SHA-256 hash proofs on the public ledger. |
| **Mobile Verifier App** | Pure-JS QR Scanner & Audit Dossier | `src/components/ConsumerVerifyPage.tsx` | HTML5 video canvas frame analysis via `jsqr` + PDF dossier export via `jspdf`. |

---

## 3. Cryptographic Specification & Security Properties

### 3.1 Digital Signatures (ECDSA P-256)
Every permissioned stakeholder is provisioned with an asymmetric key pair:
- **Curve**: NIST P-256 (`secp256r1`).
- **Hash Function**: SHA-256.
- **Payload Canonicalization**: Deterministic sorting of object keys (`canonicalizeJson`) ensures identical byte representations across heterogeneous clients.
- **Non-Repudiation**: A transaction proposal must carry the ECDSA signature of the executing organization; unauthorized state changes are cryptographically rejected by peer VSCC validation.

### 3.2 Block Structure & Merkle Tree Root
Each block $B_i$ contains:
$$B_i = \{ \text{index}, \text{timestamp}, \text{previousHash}, \text{merkleRoot}, \text{creatingOrg}, \text{transactions}[] \}$$
- **Block Header Hash**: $\text{Hash}(B_i) = \text{SHA-256}(i \mathbin{\Vert} \text{timestamp} \mathbin{\Vert} \text{Hash}(B_{i-1}) \mathbin{\Vert} \text{merkleRoot} \mathbin{\Vert} \text{creatingOrg})$
- **Merkle Tree**: All transactions $T_1, T_2, \dots, T_n$ inside block $B_i$ are hashed into leaves. Pairwise hashing builds an $O(\log n)$ balanced tree yielding a single 256-bit `merkleRoot`.
- **SPV Proofs**: Any consumer can verify transaction $T_k$ belongs to block $B_i$ by checking $\approx \lceil \log_2 n \rceil$ sibling hashes without processing the entire ledger.

### 3.3 Multi-Peer Endorsement Policies
In traditional databases, updates are signed by a single client. PharmaChain implements Fabric multi-party endorsement policies:
$$\text{Policy}(\text{transferBatch}) = \text{AND}(\text{SenderMSP.peer}, \text{RecipientMSP.peer})$$
When Universal Corporation transfers a batch to KEMSA:
1. Universal signs the proposal with its private key;
2. KEMSA verifies the parameters, validates cold-chain integrity, and generates its endorsing peer signature;
3. Both signatures are included in the transaction payload committed by the Ordering Service.

### 3.4 Read-Write Sets & MVCC Conflict Defense
To prevent double-spending or race conditions:
- During smart contract simulation, the chaincode records read keys and their current version: `reads: [{ key: "batch_KE-ACT-001", version: 1 }]`.
- During validation, the peer verifies whether `currentVersion == readVersion`. If another transaction already committed version 2, an `MVCC_READ_CONFLICT` exception is thrown and the transaction is aborted.

### 3.5 Private Data Collections (PDC / SideDBs)
Wholesale pharmaceutical pricing and procurement contracts are sensitive commercial secrets. Competing manufacturers (e.g., Cosmos vs. Dawa) must not see each other's tender prices:
- The raw deal terms (price, discount rebate, contract reference, private salt) are stored in a private collection.
- Only the SHA-256 hash of the deal is written to the shared channel block:
$$\text{OnChainHash} = \text{SHA-256}(\text{DealMetadata} \mathbin{\Vert} \text{WholesalePrice} \mathbin{\Vert} \text{PrivateSalt})$$
- Authorized entities (buyer, seller, PPB regulator) can decrypt the terms; third parties verify only that the hash matches on-chain consensus.

---

## 4. Smart Contract (Chaincode) Specifications

### 4.1 Role-Based Access Control (RBAC) Matrix

| Chaincode Function | Authorized Caller | Preconditions & Invariant Checks | State Transition |
| :--- | :--- | :--- | :--- |
| `registerBatch` | **Manufacturer only** | Batch must not exist; `expDate > mfgDate`; `qty > 0`. | Creates batch in World State (`status: REGISTERED`, `version: 1`). |
| `transferBatch` | **Current Holder only** | Batch must not be `RECALLED`; caller must be `currentHolder`; `transferQty <= stockQty`. | Moves to `IN_TRANSIT`, designates `pendingRecipient`, increments version. |
| `receiveBatch` | **Designated Recipient only** | Caller must match `pendingRecipientOrgId`; batch must not be `RECALLED`. | Sets `currentHolder` to recipient, clears `pendingRecipient`, updates stock. |
| `dispenseUnits` | **Pharmacy only** | Caller must hold batch; batch must not be `EXPIRED` or `RECALLED`; `dispenseQty <= stock`. | Decrements remaining stock, logs patient reference, updates version. |
| `flagBatch` | **Regulator (PPB) only** | Specific inspection reason $\ge 5$ characters; batch exists and not recalled. | Sets `status: FLAGGED`, logs regulatory directive on-chain. |
| `recallBatch` | **Regulator (PPB) only** | Class I statutory recall directive; batch exists. | Sets `status: RECALLED`, atomically locks stock against transfer/dispensing, emits real-time alert. |
| `verifyBatch` | **Public (Zero login)** | Read-only query; verifies against CouchDB state and block signatures. | Returns: `AUTHENTIC`, `RECALLED`, `EXPIRED`, `FLAGGED`, or `UNKNOWN_COUNTERFEIT`. |

---

## 5. Kenyan Supply Chain Preloaded Dataset

The system boots with 8 permissioned Kenyan organizations and 6 realistic batch scenarios:

### 5.1 Consortium Organizations
1. **Dawa Life Sciences Ltd** (`MFG-DAWA` / `DawaLifeMSP`) — Manufacturer (Ruaraka, Nairobi)
2. **Cosmos Limited** (`MFG-COSMOS` / `CosmosPharmaMSP`) — Manufacturer (Industrial Area, Nairobi)
3. **Universal Corporation Ltd** (`MFG-UNIVERSAL` / `UniversalCorpMSP`) — Manufacturer (Kikuyu, Kiambu)
4. **KEMSA (Kenya Medical Supplies Authority)** (`DIST-KEMSA` / `KemsaSupplyMSP`) — National Depot (Embakasi)
5. **MEDS (Mission for Essential Drugs & Supplies)** (`DIST-MEDS` / `MedsLogisticsMSP`) — Distributor (Mombasa Rd)
6. **Goodlife Pharmacy — Westlands** (`PHARM-GOODLIFE` / `GoodlifePharmMSP`) — Retail Pharmacy (Nairobi)
7. **Kenyatta National Hospital (KNH) Pharmacy** (`PHARM-KNH` / `KnhHospitalMSP`) — Hospital Pharmacy (Upper Hill)
8. **Pharmacy and Poisons Board (PPB Kenya)** (`REG-PPB` / `PpbRegulatorMSP`) — Statutory Regulator (Lenana Rd)

### 5.2 Preloaded Test Batches
| Batch Number | Drug Name & Strength | Flow / Custody Path | Ledger State |
| :--- | :--- | :--- | :--- |
| `KE-ACT-2026-001` | Coartem (Artemether 20mg / Lumefantrine 120mg) | Universal Corp $\rightarrow$ KEMSA $\rightarrow$ KNH Pharmacy | **AUTHENTIC** (350 units dispensed, 4,650 units in stock) |
| `KE-AMX-2026-002` | Amoxil (Amoxicillin Trihydrate 500mg) | Dawa Life Sciences $\rightarrow$ MEDS $\rightarrow$ Goodlife Pharmacy | **AUTHENTIC** (120 units dispensed, 1,880 units in stock) |
| `KE-MET-2026-003` | Glucophage (Metformin HCl 850mg) | Cosmos Limited $\rightarrow$ KEMSA $\rightarrow$ *In-transit to Goodlife* | **IN_TRANSIT** (Ready for Goodlife to test `receiveBatch`) |
| `KE-AZM-2026-004` | Zithromax (Azithromycin 500mg) | Held at Dawa Life Sciences factory | **REGISTERED** (Ready to test dispatch) |
| `KE-INS-2026-005` | Insulatard (Human Insulin 100IU/ml) | Cosmos $\rightarrow$ MEDS $\rightarrow$ Flagged by PPB | **FLAGGED** (Cold-chain IoT excursion +9.4°C on Mombasa Rd) |
| `KE-CIP-2024-089` | Ciproxin (Ciprofloxacin HCl 500mg) | Cosmos $\rightarrow$ MEDS $\rightarrow$ Goodlife (Mfd 2023, Exp 2025) | **EXPIRED** (Smart contract blocks dispensing to patients) |
| `KE-PCM-2026-999` | Cetamol Pediatric Syrup 120mg/5ml | Universal $\rightarrow$ KEMSA $\rightarrow$ Recalled by PPB | **RECALLED** (NQCL detected diethylene glycol impurity) |
| `FAKE-MOMBASA-404` | Simulated Counterfeit Cloned Pack | *Unregistered packaging serial* | **COUNTERFEIT** (Zero genesis blocks on ledger) |

---

## 6. Verification & Tamper-Evident Proof (Demonstration Guide)

### 6.1 Cryptographic Chain Validation
In the **Ledger Explorer**:
1. Click **Validate Chain**: The system re-hashes all block headers, re-computes Merkle roots, checks previous hash linkage, and verifies every ECDSA signature against the organization's public key.
2. Observe the green status banner confirming all blocks and signatures are cryptographically valid.

### 6.2 Demonstrating Immutability ("Tamper Demo")
1. Select Block #2 and click **Tamper Demo**.
2. The simulation secretly alters the quantity inside Block #2's transaction payload to 999,999 units (simulating a database administrator attempting unauthorized stock diversion).
3. Click **Validate Chain**:
   - The block turns **bright red**;
   - Cryptographic failure diagnostics pinpoint:
     - *SHA-256 hash mismatch: block payload was altered after block was sealed.*
     - *Merkle root mismatch.*
     - *ECDSA signature verification failure: payload was modified without the creator's private key.*
     - *Chain contamination: downstream blocks reject the invalid upstream hash.*
4. Click **Restore Untampered Ledger** to restore state.

### 6.3 Demonstrating MVCC Double-Spend Prevention
1. In the **Role Console**, select an organization holding stock (e.g., KEMSA holding `KE-ACT-2026-001`).
2. Click **Test MVCC Double-Spend Defense**:
   - Simulates a concurrent race condition where an outdated version ($v_{\text{expected}} = v - 1$) is submitted.
   - The transaction is rejected with `MVCC_READ_CONFLICT: Transaction aborted! The batch record has already been modified`.

### 6.4 Demonstrating Real-Time Emergency Recall
1. In the **Role Console**, log in as **Pharmacy and Poisons Board (PPB Kenya)**.
2. Select any batch (e.g., `KE-ACT-2026-001`), enter a statutory recall reason, and click **Execute Emergency Recall**.
3. **Event Bus Trigger**:
   - An immediate high-visibility crimson alert banner broadcasts across the entire application;
   - The current holder's dashboard flags the batch for quarantine;
   - Any patient scanning the QR code in **Consumer Verify** instantly sees **"RECALLED, DO NOT USE"**;
   - Any attempt to transfer or dispense the batch is rejected by smart contract policy.

---

## 7. Instructions for Local Deployment & Evaluation

### 7.1 System Requirements
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **Package Manager**: npm, yarn, or pnpm
- **Supported Browsers**: Chrome, Edge, Firefox, Safari (Web Crypto API requires a secure context: `localhost` or `https://`)

### 7.2 Installation Steps
```bash
# 1. Clone repository or unzip project folder
cd pharmachain

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev

# 4. Open in browser
http://localhost:3000
```

### 7.3 Verifying Codebase Quality
```bash
# Verify TypeScript compilation and zero linting/typing errors
npm run lint

# Build production bundle
npm run build
```

---

## 8. Conclusion

PharmaChain demonstrates how permissioned blockchain architectures solve the systemic vulnerabilities of fragmented pharmaceutical supply chains. By replacing vulnerable, mutable SQL databases with an append-only ledger governed by **Web Crypto ECDSA signatures**, **Merkle roots**, **multi-peer endorsement policies**, **MVCC concurrency control**, and **instant event-driven recalls**, the system guarantees end-to-end medicine authenticity and advances the global mandate of **UN SDG 3: Good Health and Well-Being**.
