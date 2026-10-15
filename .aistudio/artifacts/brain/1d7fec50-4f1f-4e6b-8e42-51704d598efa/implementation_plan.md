# Wünderkraf Paperware ERP — Architecture Roadmap & Post-Slitting Supervisor Control Suite

A comprehensive architectural overhaul and supervisor governance roadmap for Wünderkraf Paperware ERP Suite, detailing post-slitting floor operations (Cutting, Forming, QC, Packing, Dispatch), high-speed state virtualization to eliminate lag, and strict regression-prevention engineering contracts.

---

> [!IMPORTANT]
> **Zero-Code Phase Notice:** In accordance with your strict instructions, **no production code is modified in this step**. This implementation plan defines the complete blueprint, state architecture, and step-by-step phased execution. Execution begins only after your explicit review and approval.

---

## 1. Overview & Core Concept

Wünderkraf Paperware ERP manages industrial paper tableware and packaging manufacturing. The raw materials (Mother Reels) and secondary Slitting operations are currently functional and stable. This roadmap focuses on:
1. **Post-Slitting Supervisor Governance**: Introducing institutional-grade supervisory control and shift gates across Cutting, Forming, Quality Control (QC), Packing, and Finished Goods Gate-Pass Dispatch.
2. **Factory-Floor Speed Optimization**: Resolving sluggish UI rendering and tablet lag caused by monolithic 600KB+ state serialization by partitioning active shift memory from historical logs.
3. **Strict Zero-Regression Engineering Rules**: Establishing immutable transaction handlers and strict boundary contracts so updating one department never breaks or corrupts another.

### Target Personas & Workflows
* **Floor Operators**: Simplified, high-contrast, touch-optimized kiosk mode with single-click actions and barcode scanning.
* **Shift Supervisors**: Dedicated multi-stage approval console for validating scrap, authorizing crate generation, issuing material returns, and signing off on shift handovers.
* **Plant Managers & PPC**: High-level yield reconciliation (theoretical vs. actual pcs/kg), OEE tracking, and dispatch traceability.

---

## 2. Post-Slitting Supervisor Control Architecture

### A. Stage 1: Blank Die-Cutting Line
* **Crate Release Authorization**: Operators cannot arbitrarily create blank crates without linking them to an active Slit Roll lot.
* **Scrap Segregation & Digital Weighing**:
  - Distinct logging for *Setup / Start-up Scrap*, *Process Trim Scrap*, and *Off-spec Rejection*.
  - Supervisor digital verification if scrap exceeds target threshold (>4.5%).
* **Die Wear & Counter Verification**: Track strokes per die set to flag maintenance alerts before blank edge feathering occurs.

### B. Stage 2: Cup / Plate / Bowl Forming Machines
* **Material Loading & Crate Checkout**: 
  - Traceable linking between blank crate ID and machine spindle / die setup.
  - Real-time crate balance counter preventing ghost or negative inventory.
* **Supervised Un-issue / Return Handler**:
  - When returning unused blanks, mandatory assignment to the original operator slice with digital reason capture (e.g., *Machine breakdown*, *Shift end balance*, *Defective rim blanks*).
* **Speed & Meter Verification**: Supervisor verification of speed (SPM - strokes per minute) and heat sealer temperature setpoints.

### C. Stage 3: Quality Control (QC) & In-line Inspection
* **Standardized Defect Classification**:
  - Specific defect categories: *Bottom Leakage / Pinholes*, *Top Curl Deformity*, *Side Seam Glue Failure*, *Oil / Water Spots*, *Print Smear*.
* **Operator Attribution & Rework Routing**:
  - Returns from QC route strictly back to the accountable Forming Operator Lot, updating the operator's actual yield score without disturbing general stock.
* **Lot Release Gate**: Production lot status changes to `QC_APPROVED` only with Supervisor PIN / badge sign-off before entering packing lines.

### D. Stage 4: Packing, Corrugated Shipper & Finished Goods Dispatch
* **Box Barcode Generation**: Dynamic GS1-compliant label generation containing Mother Reel ID, Slit Roll ID, Forming Machine, Operator, and QC Stamp.
* **Crate Exhaustion Validation**: Prevent marking a batch complete if unverified blank crates remain in a transit state.
* **Digital Gate-Pass & Shipping Reconciliation**: Final sign-off validating customer purchase order (PO), box count, and gross dispatch weight.

---

## 3. Performance & Speed Optimization Blueprint

### Root Cause Analysis
The ERP's sluggishness on factory floor devices stems from:
1. **Monolithic State Serializer**: A single 600KB+ JSON state object containing all historical batches, closed logs, machine master tables, and active runs is deserialized, cloned, and written to IndexedDB/localStorage on every minor state mutation.
2. **Universal Component Re-renders**: Components throughout the application listen to the root state, triggering widespread re-renders across all tabs even when only a single operator slice timer ticks.
3. **Unbounded Historical Arrays**: All closed runs and past crates remain loaded in active memory.

### Three-Pillar Performance Solution

```
┌────────────────────────────────────────────────────────────────────────┐
│                   MEMORY & STATE PARTITIONING SCHEME                   │
├─────────────────────────────────────────┬──────────────────────────────┤
│          ACTIVE MEMORY (FAST)           │   HISTORICAL ARCHIVE (LAZY)  │
│  • Current Active Shift Batches         │  • Closed Runs (> 24 hrs old)│
│  • Running Machine Slices               │  • Historical QC Logs        │
│  • Floor Crate Buffer (< 100 crates)    │  • Past Gate-Pass Records    │
│  • Master Machine & SKU Configs         │  • Detailed Change Logs      │
│  → IndexedDB Cache (< 25 KB)            │  → Lazy IndexedDB / Archive  │
│  → Re-render latency < 8ms              │  → Loaded only on demand     │
└─────────────────────────────────────────┴──────────────────────────────┘
```

1. **Active Shift Partitioning**:
   - Split state into an **Active Working Set** (current shift's active batches, active crates, online machines) and an **Historical Cold Store** (completed runs, old shift logs).
   - Historical records are loaded asynchronously with pagination only when opening the Reports or Audit History tab.
2. **Selective State Subscriptions**:
   - Provide scoped React hooks: `useCuttingState()`, `useFormingState()`, `useQCState()`, and `useSupervisorState()`.
   - Modifying a Forming crate will not trigger renders in Cutting or PPC views.
3. **Virtualized High-Density Grids**:
   - Render only visible table rows (using virtualized windowing) for large crate lists, keeping DOM nodes under 100 elements regardless of inventory size.

---

## 4. Strict Engineering Rules (Zero-Regression Protocol)

To ensure that improvements in one department never break another, all future code changes will adhere to three strict architectural constraints:

### Rule 1: Pure Domain Transaction Handlers
* Every state mutation (e.g., crate generation, scrap deduction, QC return) must be an isolated, pure domain function.
* The function accepts `(currentState, actionPayload)` and returns `newState` with compile-time TypeScript type guards and runtime validation.
* No inline state mutations or cross-cutting side effects within UI components.

### Rule 2: Explicit Inter-Module Boundary Contracts
* Inter-departmental movements must pass through explicit transfer objects (`MaterialTransferManifest`).
* For example, Forming cannot directly modify Cutting's internal state; it only claims crates through an atomic `claimCrateForForming` transaction.
* QC cannot delete Forming runs; it only issues a `recordQCReturnTransaction`.

### Rule 3: Schema Invariance & Automated Sanity Guards
* Prior to committing any state to storage, an automated schema validator checks invariants:
  - Total Blank Pcs = Output Pcs + Scrap Pcs + Balance Pcs.
  - No crate ID can exist in duplicate across active stages.
  - Operator slice meter reading delta $\ge 0$.
* If an invariant fails, the transaction is rejected gracefully with an audit log entry rather than corrupting the system state.

---

## 5. Technical Architecture & Component Hierarchy

```
┌──────────────────────────────────────────────────────────────────────────┐
│                   WÜNDERKRAF ERP ARCHITECTURE MAP                        │
└──────────────────────────────────────────────────────────────────────────┘
                                     │
                  ┌──────────────────┴──────────────────┐
                  ▼                                     ▼
      ┌───────────────────────┐             ┌───────────────────────┐
      │  Operator Floor Kiosk │             │  Supervisor Console   │
      │  • Cutting Kiosk      │             │  • Shift Approvals    │
      │  • Forming Line Kiosk │             │  • Scrap Thresholds   │
      │  • QC Inspection Pad  │             │  • Crate Gatekeeper   │
      │  • Packing Station    │             │  • Gate-Pass Releases │
      └───────────┬───────────┘             └───────────┬───────────┘
                  │                                     │
                  └──────────────────┬──────────────────┘
                                     ▼
        ┌─────────────────────────────────────────────────────────┐
        │            Domain Transaction Bridge (Pure)             │
        │   CuttingHandler │ FormingHandler │ QCHandler           │
        └────────────────────────────┬────────────────────────────┘
                                     ▼
        ┌─────────────────────────────────────────────────────────┐
        │        Memory & Persistence Manager (Partitioned)        │
        │   Active Shift Slice (<25KB)  │ Historical Archive Store │
        └─────────────────────────────────────────────────────────┘
```

---

## 6. Phased Implementation Roadmap

* **Phase 1: Performance Partitioning & Speed Fix**
  - Implement memory partitioning separating active batches from completed history.
  - Add scoped department state hooks to eliminate cross-component re-render lag.
* **Phase 2: Post-Slitting Supervisor Control Room**
  - Build the unified Supervisor Control View with tabbed approval queues for Cutting, Forming, and QC.
  - Add scrap verification gates and digital supervisor authorization signatures.
* **Phase 3: Hardened Crate & QC Traceability Flow**
  - Formalize crate check-in/check-out lifecycle with zero ghost inventory.
  - Integrate operator-attributed QC return tracking with real-time yield recalculation.
* **Phase 4: Packing & Dispatch Gate-Pass Automation**
  - Add box packing barcode generation and final gate-pass release validation.
