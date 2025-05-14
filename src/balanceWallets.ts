import C from '@emurgo/cardano-serialization-lib-nodejs';
import { Data } from '@lucid-evolution/lucid';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';

if (fs.existsSync('.env.local')) {
    dotenv.config({ path: '.env.local' });
} else {
    dotenv.config(); // fallback a .env
}

const DEBUG = false;

type AssetMap = Record<string, bigint>;

const priceCache: Record<string, bigint> = {};
let adaPriceUSD: number | null = null;

const BLOCKFROST_API_KEY = process.env.BLOCKFROST_API_KEY;
if (!BLOCKFROST_API_KEY) throw new Error('Missing BLOCKFROST_API_KEY in .env');

const BASE_URL = 'https://cardano-mainnet.blockfrost.io/api/v0';

const WALLET_ADDRESSES: { name: string; address: string }[] = (process.env.WALLETS || '')
    .split(',')
    .map(entry => {
        const [name, address] = entry.split(':');
        return { name: name.replace(/_/g, ' '), address };
    })
    .filter(entry => entry.name && entry.address);

const CONTRACTS = [
    {
        name: 'SwapOffer Dapp',
        address: 'addr1w8eewkl3zrrlu9mp0gw7lvtd5zavaghsukmf6ynq9668ajc6pzu77',
        pkhPath: ['fields', 0, 'fields', 3],
        stakePath: ['fields', 0, 'fields', 4, 'fields', 0],
    },
    {
        name: 'SwapOffer Gov',
        address: 'addr1w8yev93jyze583nnnvfung94kfxu86wsrexh7m2ylexcqfs7s4kyn',
        pkhPath: ['fields', 0, 'fields', 3],
        stakePath: ['fields', 0, 'fields', 4, 'fields', 0],
    },
    {
        name: 'Delegation Dapp',
        address: 'addr1wxjk575g7dt7efpa74druyyx0ufcnm8wku9gnxust0rsacs8zldfg',
        pkhPath: ['fields', 0, 'fields', 3],
        stakePath: ['fields', 0, 'fields', 4, 'fields', 0],
    },
    {
        name: 'Staking MAYZ',
        address: 'addr1w9cplc68n2q4x3kjaf6djfsm4zhczkuftmx3nqtcpw6rvts74alaf',
        pkhPath: ['fields', 0, 'fields', 0],
        stakePath: ['fields', 0, 'fields', 1, 'fields', 0],
    },
    {
        name: 'Script Dapp',
        address: 'addr1wyq0h2qnx6gz8f652ey92la34h39s8an0m0hmawm0s6qlccl65jxk',
        pkhPath: ['fields', 0, 'fields', 2],
        stakePath: ['fields', 0, 'fields', 3, 'fields', 0],
    },
    {
        name: 'Script Gov',
        address: 'addr1wy6q84t6yuz6878wje04t2mgmtekuqm7kjf6rqsncluleeg8jn37e',
        pkhPath: ['fields', 0, 'fields', 2],
        stakePath: ['fields', 0, 'fields', 3, 'fields', 0],
    },
];

async function sumAssetMap(assets: AssetMap): Promise<{ ada: number; usd: number }> {
    const adaPrice = await getADAUSDPrice();
    let totalLovelace = 0n;

    for (const [unit, qty] of Object.entries(assets)) {
        const unitPriceLovelace = await getTokenPriceInLovelace(unit);
        if (unitPriceLovelace === 0n || unitPriceLovelace == null) continue;
        totalLovelace += unitPriceLovelace * qty;
    }

    const totalADA = Number(totalLovelace) / 1_000_000 ** 2;
    const totalUSD = totalADA * adaPrice;

    return { ada: totalADA, usd: totalUSD };
}

async function formatAssetTotals(assets: AssetMap): Promise<string[]> {
    const lines: string[] = [];
    const adaUSD = await getADAUSDPrice();

    for (const [unit, qty] of Object.entries(assets)) {
        const label =
            unit === 'lovelace'
                ? 'ADA'
                : (() => {
                      const policy = unit.slice(0, 56);
                      const nameHex = unit.slice(56);
                      let nameDecoded = '';
                      try {
                          nameDecoded = `${Buffer.from(nameHex, 'hex').toString('utf8')} [${nameHex}]`;
                      } catch {
                          nameDecoded = `[${nameHex}]`;
                      }
                      return `${policy.slice(0, 4)}...${policy.slice(52, 56)}.${nameDecoded}`;
                  })();

        const pretty = unit === 'lovelace' ? (Number(qty) / 1_000_000).toFixed(6) : qty.toString();

        const unitPriceLovelace = await getTokenPriceInLovelace(unit);
        if (!unitPriceLovelace) {
            lines.push(`→ ${label}: ${pretty}`);
            continue;
        }

        const totalLovelace = unitPriceLovelace * qty;
        const totalADA = Number(totalLovelace) / 1_000_000 ** 2;
        const totalUSD = totalADA * adaUSD;

        lines.push(`→ ${label}: ${pretty} (₳ ${(Number(unitPriceLovelace) / 1_000_000).toFixed(6)}) | ₳ ${totalADA.toFixed(6)} | $${totalUSD.toFixed(2)}`);
    }

    const { ada, usd } = await sumAssetMap(assets);
    lines.push(`→ Total: ₳ ${ada.toFixed(6)} | $${usd.toFixed(2)}`);

    return lines;
}

function getByPath(obj: any, path: (string | number)[]): any {
    return path.reduce((acc, key) => acc?.[key], obj);
}

function mergeAssets(target: AssetMap, src: AssetMap) {
    for (const [unit, qty] of Object.entries(src)) {
        const bigQty = BigInt(qty);
        target[unit] = (target[unit] || 0n) + bigQty;
    }
}

async function getWithLog(url: string, label: string, params: any = {}) {
    if (DEBUG) {
        console.log(`\n[DEBUG][Request → ${label}]`);
        console.log(`→ URL: ${url}`);
        if (Object.keys(params).length > 0) console.log(`→ Params: ${JSON.stringify(params)}`);
    }

    try {
        const res = await axios.get(url, {
            headers: { project_id: BLOCKFROST_API_KEY },
            params,
        });

        if (DEBUG) {
            console.log(`[DEBUG][Response ← ${label}]`);
            console.log(`→ Status: ${res.status}`);
        }

        return res.data;
    } catch (err: any) {
        if (DEBUG) {
            console.warn(`[DEBUG][Error ← ${label}]`);
            console.warn(`→ Status: ${err.response?.status || 'N/A'}`);
        }
        throw err;
    }
}

async function getTokenPriceInLovelace(unit: string): Promise<bigint | null> {
    if (unit === 'lovelace') return 1_000_000n;
    if (priceCache[unit] !== undefined) return priceCache[unit];

    const policy = unit.slice(0, 56);
    const nameHex = unit.slice(56);
    const url = `https://dapp.mayz.io/api/prices/get-priceADAx1e6?CS=${policy}&TN_Hex=${nameHex}&validityMS=100000`;

    try {
        const res = await axios.get(url);
        const priceStr = res.data?.priceADAx1e6;
        if (!priceStr) throw new Error('Missing priceADAx1e6 in response');
        const priceLovelace = BigInt(priceStr);
        priceCache[unit] = priceLovelace;
        return priceLovelace;
    } catch (e: any) {
        console.warn(`⚠️ Failed to fetch price for ${unit} → ${e.message}`);
        priceCache[unit] = 0n;
        return 0n;
    }
}

async function getADAUSDPrice(): Promise<number> {
    if (adaPriceUSD !== null) return adaPriceUSD;

    try {
        const res = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=cardano&vs_currencies=usd');
        adaPriceUSD = res.data!.cardano!.usd! as number;
        return adaPriceUSD;
    } catch (e: any) {
        console.warn(`⚠️ Failed to fetch ADA/USD price → ${e.message}`);
        return 0;
    }
}

function extractHashesFromAddress(address: string): { pkh: string; stake: string } {
    const parsed = C.Address.from_bech32(address);
    const base = C.BaseAddress.from_address(parsed);
    if (!base) throw new Error('Only BaseAddress format is supported');

    const pkh = Buffer.from(base.payment_cred().to_keyhash()!.to_bytes()).toString('hex');
    const stake = Buffer.from(base.stake_cred().to_keyhash()!.to_bytes()).toString('hex');

    return { pkh, stake };
}

function matchDatumToPKHs(
    datum: any,
    pkh: string,
    stake: string,
    pkhPath: (string | number)[],
    stakePath: (string | number)[]
): {
    matches: boolean;
    matchedPKH: boolean;
    matchedStake: boolean;
} {
    try {
        const fieldPKH = getByPath(datum, pkhPath);
        const stakeField = getByPath(datum, stakePath);

        if (DEBUG) {
            console.log(`[DEBUG][matchDatumToPKHs] Comparing:`);
            console.log(`→ PKH Extracted:   ${fieldPKH}`);
            console.log(`→ Stake Extracted: ${stakeField}`);
        }

        const matchedPKH = fieldPKH === pkh;
        const matchedStake = stakeField === stake;
        return { matches: matchedPKH && matchedStake, matchedPKH, matchedStake };
    } catch (err) {
        if (DEBUG) {
            console.warn(`[DEBUG][matchDatumToPKHs] Error → ${err}`);
            console.dir(datum, { depth: 10 });
        }
        return { matches: false, matchedPKH: false, matchedStake: false };
    }
}

async function analyzeContract(contract: any, pkh: string, stake: string): Promise<AssetMap> {
    console.log(`\n🔍 Analyzing contract: ${contract.name}`);
    const utxos = await getWithLog(`${BASE_URL}/addresses/${contract.address}/utxos`, `UTXOs for ${contract.name}`, {
        count: 100,
    });

    let matchCount = 0;
    const assetTotals: AssetMap = {};

    for (const utxo of utxos) {
        const utxoId = `${utxo.tx_hash}#${utxo.output_index}`;
        console.log(`\n[UTXO] Checking: ${utxoId}`);

        let datum: any = null;
        if (utxo.inline_datum) {
            try {
                datum = Data.from(utxo.inline_datum);
                console.log(`[✓] Inline datum parsed`);
                if (DEBUG) {
                    console.log(`[DEBUG][Datum Parsed]`);
                    console.dir(datum, { depth: 10 });
                }
            } catch (e) {
                console.warn(`[✗] Inline datum parse error → ${e}`);
                continue;
            }
        } else if (utxo.data_hash) {
            try {
                const fetched = await getWithLog(`${BASE_URL}/scripts/datum/${utxo.data_hash}`, `Datum ${utxoId}`);
                datum = fetched.json_value;
                console.log(`[✓] Datum fetched by hash`);
                if (DEBUG) {
                    console.log(`[DEBUG][Datum Parsed]`);
                    console.dir(datum, { depth: 10 });
                }
            } catch {
                console.warn(`[✗] Failed to fetch datum for ${utxoId}`);
                continue;
            }
        } else {
            console.log(`[Skip] No datum found`);
            continue;
        }

        const result = matchDatumToPKHs(datum, pkh, stake, contract.pkhPath, contract.stakePath);

        if (result.matchedPKH || result.matchedStake) {
            matchCount++;
            const tag = result.matches ? '✅ MATCH: BOTH' : result.matchedPKH ? '⚠️  MATCH: ONLY PKH' : '⚠️  MATCH: ONLY STAKE';
            console.log(`[${contract.name}] ${tag} → ${utxoId}`);

            for (const amt of utxo.amount) {
                mergeAssets(assetTotals, { [amt.unit]: amt.quantity });
            }

            if (DEBUG) {
                console.log(`[DEBUG][Assets in UTXO]:`);
                for (const a of utxo.amount) {
                    const label = a.unit === 'lovelace' ? 'ADA' : a.unit;
                    const val = a.unit === 'lovelace' ? (Number(a.quantity) / 1_000_000).toFixed(6) : a.quantity;
                    console.log(`→ ${label}: ${val}`);
                }
            }
        } else {
            console.log(`[${contract.name}] ⛔ No match → ${utxoId}`);
        }
    }

    console.log(`\n[${contract.name}] Matched UTXOs: ${matchCount}`);
    console.log(`[${contract.name}] Total assets locked:`);
    for (const [unit, qty] of Object.entries(assetTotals)) {
        const label = unit === 'lovelace' ? 'ADA' : unit;
        const pretty = unit === 'lovelace' ? (Number(qty) / 1_000_000).toFixed(6) : qty.toString();
        console.log(`→ ${label}: ${pretty}`);
    }

    return assetTotals;
}

async function main() {
    console.log('🚀 Starting wallet scan\n');

    const globalHoldings: AssetMap = {};
    const globalLocked: AssetMap = {};
    const globalCombined: AssetMap = {};
    const finalWalletSummaries: {
        wallet: { name: string; address: string };
        contractSummaries: { name: string; totals: AssetMap }[];
        walletTotals: AssetMap;
        holdings: AssetMap;
    }[] = [];

    for (const wallet of WALLET_ADDRESSES) {
        const walletTotals: AssetMap = {};
        const { pkh, stake } = extractHashesFromAddress(wallet.address);

        console.log(`\n📍 Wallet: ${wallet.name} - Address: ${wallet.address}`);
        console.log(`→ PKH:   ${pkh}`);
        console.log(`→ Stake: ${stake}`);

        // Holdings directos
        const holdings: AssetMap = {};
        const utxos = await getWithLog(`${BASE_URL}/addresses/${wallet.address}/utxos`, `Wallet Holdings for ${wallet.name}`);
        for (const utxo of utxos) {
            for (const amt of utxo.amount) {
                mergeAssets(holdings, { [amt.unit]: amt.quantity });
            }
        }

        mergeAssets(globalHoldings, holdings);
        mergeAssets(globalCombined, holdings);

        const contractSummaries: { name: string; totals: AssetMap }[] = [];

        for (const contract of CONTRACTS) {
            const localTotals = await analyzeContract(contract, pkh, stake);
            contractSummaries.push({ name: contract.name, totals: localTotals });
            mergeAssets(walletTotals, localTotals);
            mergeAssets(globalLocked, localTotals);
            mergeAssets(globalCombined, localTotals);
        }

        finalWalletSummaries.push({
            wallet,
            contractSummaries,
            walletTotals,
            holdings,
        });

        // Output inmediato
        console.log(`\n📦 Summary for wallet: ${wallet.name} - Address: ${wallet.address}`);

        console.log(`\n🔸 Current Holdings:`);
        if (Object.keys(holdings).length === 0) {
            console.log('→ No holdings found.');
        } else {
            for (const line of await formatAssetTotals(holdings)) {
                console.log(line);
            }
        }

        for (const { name, totals } of contractSummaries) {
            console.log(`\n🔸 ${name}`);
            if (Object.keys(totals).length === 0) {
                console.log('→ No matched assets.');
            } else {
                for (const line of await formatAssetTotals(totals)) {
                    console.log(line);
                }
            }
        }

        console.log(`\n🔹 Subtotal Locked for wallet: ${wallet.name}`);
        for (const line of await formatAssetTotals(walletTotals)) {
            console.log(line);
        }

        console.log(`\n🔸 TOTAL Wallet (Holdings + Locked):`);
        const walletTotal: AssetMap = { ...walletTotals };
        mergeAssets(walletTotal, holdings);
        for (const line of await formatAssetTotals(walletTotal)) {
            console.log(line);
        }

        console.log('\n====================================================\n');
    }

    // Final summary
    console.log(`\n📊 FINAL SUMMARY PER WALLET AND CONTRACT:`);

    for (const summary of finalWalletSummaries) {
        console.log(`\n📦 Wallet: ${summary.wallet.name} - Address: ${summary.wallet.address}`);

        console.log(`\n🔸 Current Holdings:`);
        if (Object.keys(summary.holdings).length === 0) {
            console.log('→ No holdings found.');
        } else {
            for (const line of await formatAssetTotals(summary.holdings)) {
                console.log(line);
            }
        }

        for (const { name, totals } of summary.contractSummaries) {
            console.log(`\n🔸 ${name}`);
            if (Object.keys(totals).length === 0) {
                console.log('→ No matched assets.');
            } else {
                for (const line of await formatAssetTotals(totals)) {
                    console.log(line);
                }
            }
        }

        console.log(`\n🔹 Subtotal Locked for wallet: ${summary.wallet.name}`);
        for (const line of await formatAssetTotals(summary.walletTotals)) {
            console.log(line);
        }

        console.log(`\n🔸 TOTAL Wallet (Holdings + Locked):`);
        const walletTotal: AssetMap = { ...summary.walletTotals };
        mergeAssets(walletTotal, summary.holdings);
        for (const line of await formatAssetTotals(walletTotal)) {
            console.log(line);
        }

        console.log('\n----------------------------------------------------\n');
    }

    // Global total
    console.log(`\n🏁 Global Totals:`);

    console.log(`\n🔸 Holdings across all wallets:`);
    for (const line of await formatAssetTotals(globalHoldings)) {
        console.log(line);
    }

    console.log(`\n🔸 Locked in contracts across all wallets:`);
    for (const line of await formatAssetTotals(globalLocked)) {
        console.log(line);
    }

    console.log(`\n🔸 TOTAL (Holdings + Locked):`);
    for (const line of await formatAssetTotals(globalCombined)) {
        console.log(line);
    }

    console.log('\n✅ Scan complete.\n');
}

main().catch((err) => {
    console.error('❌ Fatal error:', err.message || err);
});
