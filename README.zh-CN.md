<div align="center">

# 🦄 NARWHAL Forms

**像对话一样自然的表单 —— 加密、去中心化、完全归你所有。**

基于 **Sui**、**Seal**、**Walrus** 原生构建的隐私优先反馈与表单平台。

[![Sui](https://img.shields.io/badge/Built%20on-Sui-4DA2FF?style=flat-square)](https://sui.io)
[![Walrus](https://img.shields.io/badge/Storage-Walrus-00C1A0?style=flat-square)](https://www.walrus.xyz)
[![Seal](https://img.shields.io/badge/Encryption-Seal-FF6B6B?style=flat-square)](https://seal-docs.wal.app)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Network](https://img.shields.io/badge/Network-Testnet-purple?style=flat-square)](#)

[English](./README.md) · [简体中文](./README.zh-CN.md)

</div>

---

## ✨ 项目简介

**NARWHAL** 是一个去中心化表单平台。所有表单结构、回复、截图和视频都以**内容寻址**的方式保存在 **Walrus** 上，可校验、按表单组织。敏感内容由 **Seal** 进行**门限加密**，唯一的链上凭证是你完全拥有的 **Sui** 对象。

无需信任任何服务器，即可优雅地收集 Bug 反馈、问卷调查、申请表、内测注册、用户访谈 —— 一次只问一个问题，体验如对话般顺滑。

## 🎯 核心特性

- 🔒 **端到端加密** —— 基于 Seal 派生密钥的 AES‑GCM 加密，只有表单创建者和白名单管理员可解密。
- 🧩 **混合加密模式** —— 可整份回复加密，也可仅将单个字段标记为「敏感」字段。
- 🐋 **Walrus 作为存储底座** —— 表单结构、回复、截图、视频都是内容寻址的 Walrus blob。
- 🛡️ **Sui 作为可信账本** —— `AdminCap` 是链上对象，白名单是 Move 状态，`seal_approve` 是任何人都可审计的纯函数。
- 🎨 **优雅的对话式 UX** —— 一次一题，10 种打磨过的字段类型开箱即用。
- 👥 **细粒度访问控制** —— 公开/私密表单、钱包准入、白名单、防重复提交、多管理员支持。
- 📊 **内建分诊功能** —— 优先级、标签、内部备注（按提交记录），支持批量更新。
- 🔑 **一次签名批量解密** —— 通过 Seal `SessionKey`，管理员只需一次签名即可批量审阅回复。

## 🏗️ 项目结构

```
narwhal-forms/
├── contract/                          # Sui Move 智能合约
│   └── narwhal/
│       ├── sources/
│       │   ├── forms.move            # 表单共享对象 + AdminCap
│       │   ├── submissions.move      # 提交记录（动态字段）+ 批量操作
│       │   └── access.move           # seal_approve 访问策略
│       ├── tests/                    # Move 单元测试
│       ├── Move.toml
│       └── Published.toml            # 各网络已发布的 packageId
└── frontend/                          # Next.js 16 + React 19 前端
    ├── app/                          # App Router 页面
    │   ├── page.tsx                  # 落地页
    │   ├── dashboard/                # 表单管理面板
    │   ├── forms/new/                # 表单构建器
    │   └── forms/[id]/               # 提交与管理视图
    ├── components/
    │   ├── fields/                   # 字段渲染器（10 种类型）
    │   └── ui/                       # shadcn/ui 基础组件
    └── lib/
        ├── config.ts                 # 网络 / packageId / Walrus / Seal 配置
        ├── sui.ts                    # Sui 客户端 + 交易工具
        ├── seal.ts                   # Seal 加解密 + SessionKey
        ├── walrus.ts                 # Walrus blob 上传 / 下载
        ├── schema.ts                 # 表单 / 字段 Schema（Zod）
        └── responses.ts              # 回复序列化 / 反序列化
```

### 技术栈一览

| 层级           | 技术                                                   | 作用                                          |
|----------------|--------------------------------------------------------|-----------------------------------------------|
| 智能合约       | Sui **Move 2024**                                      | 表单对象、白名单、`seal_approve`              |
| 存储           | **Walrus**（testnet / mainnet）                        | 表单结构、回复、附件                          |
| 加密           | **Seal**（门限 = 2）                                    | 字段级与整体加密                              |
| 前端           | **Next.js 16**、React 19、TypeScript 5                  | App Router DApp                               |
| 钱包与数据     | `@mysten/dapp-kit-react`、`@mysten/sui`、React Query    | 钱包连接、查询、Mutation                      |
| UI             | Tailwind CSS v4、shadcn/ui、Radix、Framer Motion        | 对话式 UI、动效                               |
| 表单 / 校验    | `react-hook-form`、`zod`                                | 表单校验                                      |

## 🧱 智能合约模块

链上层由三个最小化的 Move 模块组成：

- **`narwhal::forms`** —— `Form` 共享对象（schema blob 指针、隐私与准入开关、白名单、管理员、提交计数器）以及只属于创建者的 `AdminCap`。提供 `create_and_share`、`update_schema`、`update_title`、`set_archived`、`add_admin`、`add_allowlist`、`set_allow_duplicate` 等接口。
- **`narwhal::submissions`** —— 每条回复以**动态字段**形式挂在父 Form 上。支持优先级、标签、内部备注 blob，以及批量管理员操作（`batch_set_priority`、`batch_set_tag`、`batch_clear_notes`，单笔交易最多 256 条）。
- **`narwhal::access`** —— 纯净的 Seal 策略。`seal_approve` 校验 Seal Identity 前缀必须匹配 Form ID，且发送方必须是创建者或白名单管理员。

真正的表单结构和回复内容都存放在 Walrus 上；链上只保留 blob 指针和 `seal_approve` 所需的访问元数据。

## 🚀 快速开始

### 环境要求

- **Node.js** 20+、**pnpm**（或 npm）
- **Sui CLI**（[安装指南](https://docs.sui.io/guides/developer/getting-started/sui-install)）
- 一个 Sui 钱包（Sui Wallet、Suiet 等），并准备好 **testnet** SUI

### 1. 克隆仓库

```bash
git clone https://github.com/JasonRUAN/narwhal-forms.git
cd narwhal-forms
```

### 2.（可选）发布你自己的 Move 包

仓库已预先发布了 testnet 版本，详见 [`contract/narwhal/Published.toml`](./contract/narwhal/Published.toml)。如需自行部署：

```bash
cd contract/narwhal
sui client switch --env testnet
sui client publish --gas-budget 200000000
```

将得到的 `packageId` 通过 `NEXT_PUBLIC_PACKAGE_ID` 配置到前端（见下文）。

### 3. 启动前端

```bash
cd frontend
pnpm install            # 或 npm install
pnpm dev                # http://127.0.0.1:3000
```

### 4. 环境变量

在 `frontend/.env.local` 中创建：

```bash
# 仅当你自行部署合约时需要；否则将使用 lib/config.ts 中内置的 testnet packageId。
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_PACKAGE_ID=0x...

# 可选覆盖
NEXT_PUBLIC_SUI_FULLNODE_URL=https://fullnode.testnet.sui.io:443
NEXT_PUBLIC_WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
NEXT_PUBLIC_WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space
NEXT_PUBLIC_SUI_EXPLORER=https://suiscan.xyz
NEXT_PUBLIC_WALRUS_EXPLORER=https://walruscan.com
```

## 🧪 运行 Move 测试

```bash
cd contract/narwhal
sui move test
```

## 🧬 字段类型

NARWHAL 内置 10 种打磨过的字段类型：

| #  | 类型           | 说明                                              |
|----|----------------|---------------------------------------------------|
| 01 | `short_text`   | 单行短文本                                        |
| 02 | `rich_text`    | 支持 Markdown 的长文本                            |
| 03 | `number`       | 数字输入                                          |
| 04 | `dropdown`     | 单选下拉列表                                      |
| 05 | `checkbox`     | 多选项                                            |
| 06 | `star_rating`  | 1–5 星评分                                        |
| 07 | `screenshot`   | 图片上传（存储为 Walrus blob）                    |
| 08 | `video`        | 视频上传（存储为 Walrus blob）                    |
| 09 | `url`          | URL 校验输入                                      |
| 10 | `confirm`      | 是 / 否 确认                                      |

任意字段都可标记为「**必填**」和/或「**敏感**」（即在存储时使用 Seal 加密）。

## 🔐 隐私模型

- **公开表单** → schema 与回复都是 Walrus 上的明文 blob。
- **私密表单** → 整份回复在上传前由 Seal 加密。
- **敏感字段** → 仅对单个 JSON 路径使用 Seal 加密，其余部分保持明文（混合模式）。
- **解密流程** → Seal Key Server 会 dry‑run 调用 `seal_approve`，只有**创建者**或**白名单管理员**才能拿到密钥。
- **防重复 / 白名单** → 在 `submissions::submit` 中链上强制（需要 `require_wallet=true`）。

## 🤝 贡献指南

欢迎贡献！重大改动请先开 Issue 讨论。

1. Fork 本仓库
2. 创建特性分支（`git checkout -b feat/amazing`）
3. 提交修改（`git commit -m 'feat: add amazing thing'`）
4. 推送分支（`git push origin feat/amazing`）
5. 提交 Pull Request

## 📚 参考资源

- [Sui 官方文档](https://docs.sui.io)
- [Seal 官方文档](https://seal-docs.wal.app/)
- [Walrus 官方文档](https://docs.wal.app/)
- [@mysten/dapp-kit](https://sdk.mystenlabs.com/dapp-kit)

## 📄 开源协议

[MIT](./LICENSE) © NARWHAL Collective

---

<div align="center">

**Transmitted from Walrus sessions · ⌖ 2026 · narwhal collective**

*会聆听的独角鲸之牙。* 🐋

</div>
