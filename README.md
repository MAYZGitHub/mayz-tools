# MAYZ Tools

This repository contains utility scripts to explore and analyze holdings and locked tokens for wallets in the MAYZ Protocol on Cardano.

## 📦 What it does

- Calculates wallet current holdings and locked tokens across smart contracts.
- Displays asset values in ADA and USD using price oracles.
- Summarizes each wallet and global totals.
- Supports CSV generation and stake address extraction.

## 📂 Available scripts

```
"convertAddressToPkh": "TS_NODE_PROJECT='tsconfig.json' tsx ./src/convertAddressToPkh.ts",
"extractStakeAddress": "TS_NODE_PROJECT='tsconfig.json' tsx ./src/extractStakeAddress.ts",
"getMAYZHolders": "TS_NODE_PROJECT='tsconfig.json' tsx ./src/getMAYZHolders.ts",
"balanceWallets": "TS_NODE_PROJECT='tsconfig.json' tsx ./src/balanceWallets.ts"
```

## 🛠️ Usage

1. Clone the repo and install dependencies:

```
npm install
```

2. Copy the `.env.example` to `.env` and set your Blockfrost API key and any wallet addresses to scan:

```
BLOCKFROST_API_KEY=your_key_here
WALLET_ADDRESSES="WALLET1:addr1q93ahk...,WALLET2:addr1q8nxqd...,WALLET3:addr1q8nxqd..."
```

3. Run the main script:

```
npm run balanceWallets
```

4. For holders and stake info:

- `getMAYZHolders`: Fetches and stores all gMAYZ holders.
- `extractStakeAddress`: Parses addresses from `files/HOLDERS GMAYZ.txt` and extracts stake data.
- `convertAddressToPkh`: Encodes PKH and optional stake into base address (edit values directly in the file).

## ✅ Example

Final logs include totals per wallet, holdings vs locked, token breakdowns, and USD values.

Try it with your own wallets and feel free to create a branch to experiment with adding reward calculations.
