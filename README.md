# MAYZ Tools

A collection of standalone scripts to analyze wallet holdings and locked assets in the MAYZ Protocol. Each script works independently and serves a specific purpose.

## Setup

1. Install dependencies

```
npm install
```

2. Create a `.env` file from `.env.example`. You’ll need to add your Blockfrost key and optionally wallet addresses.

---

## Scripts

### 🧮 balanceWallets

Calculates per wallet:
- Current UTXO holdings
- Locked tokens in known MAYZ contracts
- Token value in ADA and USD

Shows summaries per contract, per wallet, and global.

Run:
```
npm run balanceWallets
```

---

### 🪙 getMAYZHolders

Fetches all gMAYZ token holders from Blockfrost and writes them as CSV in the `files/` folder.

Run:
```
npm run getMAYZHolders
```

---

### 🥩 extractStakeAddress

Parses stake addresses from a text file (like `files/HOLDERS GMAYZ.txt`) and creates multiple CSV outputs mapping stake keys and balances.

Run:
```
npm run extractStakeAddress
```

---

### 🔁 convertAddressToPkh

Converts hardcoded PKH and stake PKH into a full bech32 wallet address.

You can edit the `src/convertAddressToPkh.ts` to test different key hashes.

Run:
```
npm run convertAddressToPkh
```

---

## Example Output

The output of `balanceWallets` includes:

- 🔸 Current Holdings
- 🔸 Contract Balances (SwapOffer, Delegation, Staking, etc.)
- 🔹 Subtotal Locked
- 🔸 TOTAL Wallet (Holdings + Locked)
- Global Totals across all wallets

Each line shows quantity, ADA price, total ADA value and total USD:

```
→ MAYZ [4d41595a]: 50000000000 (₳ 0.003512) | ₳ 175.600000 | $145.22
```

You can test it using any address in `.env`. 