<div align="center">

# 🦄 NARWHAL Forms

**Forms that feel like a conversation — encrypted, decentralized, and owned by you.**

A privacy‑first feedback & forms platform built natively on **Sui**, **Seal**, and **Walrus**.

[![Sui](https://img.shields.io/badge/Built%20on-Sui-4DA2FF?style=flat-square)](https://sui.io)
[![Walrus](https://img.shields.io/badge/Storage-Walrus-00C1A0?style=flat-square)](https://www.walrus.xyz)
[![Seal](https://img.shields.io/badge/Encryption-Seal-FF6B6B?style=flat-square)](https://seal-docs.wal.app)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Network](https://img.shields.io/badge/Network-Testnet-purple?style=flat-square)](#)

[English](./README.md) · [简体中文](./README.zh-CN.md)

</div>

---

## ✨ Overview

**NARWHAL** is a decentralized forms platform where every schema, every response, every screenshot or video lives on **Walrus** — content‑addressed, verifiable, organised by form. Sensitive answers are **threshold‑encrypted with Seal**, and the only on‑chain receipts are **Sui** objects you fully own.

Build bug reports, surveys, applications, beta sign‑ups, customer interviews — collected one beautiful question at a time, without ever asking you to trust a server.

## 🎯 Key Features

- 🔒 **End‑to‑end encryption** — AES‑GCM with Seal‑derived keys; only the form creator and allowlisted admins can decrypt.
- 🧩 **Hybrid encryption modes** — encrypt the entire response, or just mark individual fields as *sensitive*.
- 🐋 **Walrus as the spine** — schemas, responses, screenshots and videos are stored as content‑addressed Walrus blobs.
- 🛡️ **Sui as the ledger** — `AdminCap` is an on‑chain object, allowlists are Move state, `seal_approve` is an auditable pure function.
- 🎨 **Beautiful, conversational UX** — one question at a time, 10 polished field types out of the box.
- 👥 **Granular access control** — public/private forms, wallet‑gated submissions, allowlists, anti‑duplicate enforcement, multi‑admin support.
- 📊 **Triage built in** — priority, tags, internal notes (per submission), with batch updates.
- 🔑 **One‑prompt batch decrypt** — Seal `SessionKey` lets admins review many responses with a single signature.

## 🏗️ Architecture

```
narwhal-forms/
├── contract/                          # Sui Move smart contracts
│   └── narwhal/
│       ├── sources/
│       │   ├── forms.move            # Form shared object + AdminCap
│       │   ├── submissions.move      # Submission dynamic fields + batch ops
│       │   └── access.move           # seal_approve policy
│       ├── tests/                    # Move unit tests
│       ├── Move.toml
│       └── Published.toml            # Published packageId by network
└── frontend/                          # Next.js 16 + React 19 dApp
    ├── app/                          # App router pages
    │   ├── page.tsx                  # Landing page
    │   ├── dashboard/                # Forms dashboard
    │   ├── forms/new/                # Form builder
    │   └── forms/[id]/               # Submit & admin views
    ├── components/
    │   ├── fields/                   # Field renderers (10 types)
    │   └── ui/                       # shadcn/ui primitives
    └── lib/
        ├── config.ts                 # Network / package / Walrus / Seal config
        ├── sui.ts                    # Sui client + tx helpers
        ├── seal.ts                   # Seal encrypt / decrypt + SessionKey
        ├── walrus.ts                 # Walrus blob upload / download
        ├── schema.ts                 # Form / field schemas (Zod)
        └── responses.ts              # Response (de)serialization
```

### Stack at a glance

| Layer            | Tech                                                   | Role                                        |
|------------------|--------------------------------------------------------|---------------------------------------------|
| Smart contracts  | Sui **Move 2024**                                      | Form objects, allowlists, `seal_approve`    |
| Storage          | **Walrus** (testnet/mainnet)                           | Schemas, responses, attachments             |
| Encryption       | **Seal** (threshold = 2)                               | Field‑ and response‑level encryption        |
| Frontend         | **Next.js 16**, React 19, TypeScript 5                 | App Router dApp                             |
| Wallet & data    | `@mysten/dapp-kit-react`, `@mysten/sui`, React Query   | Wallet connection, queries, mutations       |
| UI               | Tailwind CSS v4, shadcn/ui, Radix, Framer Motion       | Conversational UI, animations               |
| Forms / schemas  | `react-hook-form`, `zod`                               | Validation                                  |

## 🧱 Smart Contract Modules

The on‑chain layer is split into three minimal Move modules:

- **`narwhal::forms`** — `Form` shared object (schema blob pointer, privacy & gating flags, allowlist, admins, submission counter) and the owner‑only `AdminCap`. Provides `create_and_share`, `update_schema`, `update_title`, `set_archived`, `add_admin`, `add_allowlist`, `set_allow_duplicate`, etc.
- **`narwhal::submissions`** — Per‑response records stored as **dynamic fields** on the parent form. Supports priority, tags, internal note blobs, plus batched admin updates (`batch_set_priority`, `batch_set_tag`, `batch_clear_notes`, max 256/tx).
- **`narwhal::access`** — Pure Seal policy. `seal_approve` validates the identity prefix matches the form ID and that the sender is the creator or an allowlisted admin.

The actual form schema and answers live on Walrus; the chain only stores the blob pointer plus the access metadata required by `seal_approve`.

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ and **pnpm** (or npm)
- **Sui CLI** ([install](https://docs.sui.io/guides/developer/getting-started/sui-install))
- A Sui wallet (Sui Wallet, Suiet, etc.) with **testnet** SUI

### 1. Clone

```bash
git clone https://github.com/JasonRUAN/narwhal-forms.git
cd narwhal-forms
```

### 2. (Optional) Publish your own Move package

The repo ships with a pre‑published testnet package — see [`contract/narwhal/Published.toml`](./contract/narwhal/Published.toml). To deploy your own:

```bash
cd contract/narwhal
sui client switch --env testnet
sui client publish --gas-budget 200000000
```

Copy the resulting `packageId` and set it via `NEXT_PUBLIC_PACKAGE_ID` (see below).

### 3. Run the frontend

```bash
cd frontend
pnpm install            # or: npm install
pnpm dev                # http://127.0.0.1:3000
```

### 4. Environment variables

Create `frontend/.env.local`:

```bash
# Required only if you publish your own contract; otherwise the bundled testnet
# packageId in lib/config.ts is used.
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_PACKAGE_ID=0x...

# Optional overrides
NEXT_PUBLIC_SUI_FULLNODE_URL=https://fullnode.testnet.sui.io:443
NEXT_PUBLIC_WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
NEXT_PUBLIC_WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space
NEXT_PUBLIC_SUI_EXPLORER=https://suiscan.xyz
NEXT_PUBLIC_WALRUS_EXPLORER=https://walruscan.com
```

## 🧪 Testing the Move package

```bash
cd contract/narwhal
sui move test
```

## 🧬 Field Types

NARWHAL ships with 10 polished field types out of the box:

| #  | Type           | Description                                      |
|----|----------------|--------------------------------------------------|
| 01 | `short_text`   | Single‑line answer                               |
| 02 | `rich_text`    | Markdown‑aware long answer                       |
| 03 | `number`       | Numeric input                                    |
| 04 | `dropdown`     | Single‑choice list                               |
| 05 | `checkbox`     | Multi‑select options                             |
| 06 | `star_rating`  | 1–5 star rating                                  |
| 07 | `screenshot`   | Image upload (stored as a Walrus blob)           |
| 08 | `video`        | Video upload (stored as a Walrus blob)           |
| 09 | `url`          | Validated URL input                              |
| 10 | `confirm`      | Yes/no confirmation                              |

Any field can be marked **required** and/or **sensitive** (Seal‑encrypted at rest).

## 🔐 Privacy Model

- **Public form** → schema and responses are plaintext blobs on Walrus.
- **Private form** → the entire response envelope is encrypted with Seal before upload.
- **Sensitive fields** → individual JSON paths are wrapped with Seal, the rest of the response stays cleartext (hybrid mode).
- **Decryption** → `seal_approve` is dry‑run by Seal key servers; only the **creator** or **allowlisted admin** receives keys.
- **Anti‑duplicate / allowlist** → enforced on‑chain in `submissions::submit` (requires `require_wallet=true`).

## 🤝 Contributing

Contributions are welcome! Please open an issue first to discuss any major change.

1. Fork the repo
2. Create your feature branch (`git checkout -b feat/amazing`)
3. Commit your changes (`git commit -m 'feat: add amazing thing'`)
4. Push to the branch (`git push origin feat/amazing`)
5. Open a Pull Request

## 📚 Resources

- [Sui Documentation](https://docs.sui.io)
- [Seal Documentation](https://seal-docs.wal.app/)
- [Walrus Documentation](https://docs.wal.app/)
- [@mysten/dapp-kit](https://sdk.mystenlabs.com/dapp-kit)

## 📄 License

[MIT](./LICENSE) © NARWHAL Collective

---

<div align="center">

**Transmitted from Walrus sessions · ⌖ 2026 · narwhal collective**

*The tusk that listens.* 🐋

</div>
