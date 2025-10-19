import C from '@emurgo/cardano-serialization-lib-nodejs';
import { Data } from '@lucid-evolution/lucid';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';

if (fs.existsSync('.env.local')) {
    dotenv.config({ path: '.env.local' });
} else {
    dotenv.config();
}

const DEBUG = false;

// gMAYZ Token Constants
const GMAYZ_CS = 'e46f629f31e4a3c4ba16dd3bc396f24fb222f2776e7d698f2bda5018';
const GMAYZ_TN = '674d41595a';
const GMAYZ_UNIT = GMAYZ_CS + GMAYZ_TN;

const BLOCKFROST_API_KEY = process.env.BLOCKFROST_API_KEY;
if (!BLOCKFROST_API_KEY) throw new Error('Missing BLOCKFROST_API_KEY in .env');

const BASE_URL = 'https://cardano-mainnet.blockfrost.io/api/v0';
const DAPP_API_URL = 'https://dapp.mayz.io/api/funds-with-details/by-params';

const WALLET_ADDRESSES: { name: string; address: string }[] = [
    { name: 'MANUPERSONAL', address: 'addr1q93ahkwqtghpe4megvrps26cnd0nmqxkq24jsenexsc7suc4pxw3akg47zvj9kkmdu952aff9qnx5xx07gg6f22ufdxswlu0kv' },
    { name: 'MANU MAYZ', address: 'addr1q8nxqd7lzyfluen6slh5ggy5vnn0atqgm8at9d8sp4h9gu6r76h9vjpm78e4ffyl0rr2ccjhgvqvr0dun343wxx94ueqm6tem8' },
    { name: 'FEDE', address: 'addr1qyazlw25zq3tjkegdpe22y9as2ffpmy8ep4pkpskhz5pj6py97yhj07etqm0n4r6282h0d80mwrrkhsc7x5l5cq57qxsathzfl' },
    { name: 'MAYZ OFFICIAL', address: 'addr1qxf0vp30qg9p3umn9pwvqf028fcv2ye2j2fyg6ydd9k9t9zry0szdxwvzdv2p7zapcc7warkxwrvf284nudvunw579sq2q27sc' },
    // Add more wallets here as needed
];

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

async function getWithLog(url: string, label: string, params: any = {}): Promise<any> {
    if (DEBUG) console.log(`📡 Calling: ${url}`);
    const response = await axios.get(url, {
        headers: { project_id: BLOCKFROST_API_KEY },
        params,
    });
    return response.data;
}

function getByPath(obj: any, path: (string | number)[]): any {
    let current = obj;
    for (const key of path) {
        if (current == null) return undefined;
        current = current[key];
    }
    return current;
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
): boolean {
    try {
        const fieldPKH = getByPath(datum, pkhPath);
        const stakeField = getByPath(datum, stakePath);

        if (DEBUG) {
            console.log(`[DEBUG] Comparing PKH: ${fieldPKH} === ${pkh}`);
            console.log(`[DEBUG] Comparing Stake: ${stakeField} === ${stake}`);
        }

        return fieldPKH === pkh && stakeField === stake;
    } catch (err) {
        if (DEBUG) console.warn(`[DEBUG] Error matching datum: ${err}`);
        return false;
    }
}

async function getGMAYZFromWalletHoldings(walletAddress: string): Promise<bigint> {
    const utxos = await getWithLog(`${BASE_URL}/addresses/${walletAddress}/utxos`, `Wallet Holdings`, {
        count: 100,
    });

    let total = 0n;
    for (const utxo of utxos) {
        for (const amt of utxo.amount) {
            if (amt.unit === GMAYZ_UNIT) {
                total += BigInt(amt.quantity);
            }
        }
    }

    return total;
}

async function getGMAYZFromContract(
    contract: any,
    pkh: string,
    stake: string
): Promise<bigint> {
    if (DEBUG) console.log(`\n🔍 Analyzing contract: ${contract.name}`);
    
    const utxos = await getWithLog(`${BASE_URL}/addresses/${contract.address}/utxos`, `UTXOs for ${contract.name}`, {
        count: 100,
    });

    let total = 0n;
    let matchCount = 0;

    for (const utxo of utxos) {
        const utxoId = `${utxo.tx_hash}#${utxo.output_index}`;

        let datum: any = null;
        if (utxo.inline_datum) {
            try {
                datum = Data.from(utxo.inline_datum);
            } catch (e) {
                if (DEBUG) console.warn(`[✗] Inline datum parse error → ${e}`);
                continue;
            }
        } else if (utxo.data_hash) {
            try {
                const fetched = await getWithLog(`${BASE_URL}/scripts/datum/${utxo.data_hash}`, `Datum ${utxoId}`);
                datum = fetched.json_value;
            } catch {
                if (DEBUG) console.warn(`[✗] Failed to fetch datum for ${utxoId}`);
                continue;
            }
        } else {
            continue;
        }

        const matches = matchDatumToPKHs(datum, pkh, stake, contract.pkhPath, contract.stakePath);

        if (matches) {
            matchCount++;
            if (DEBUG) console.log(`[${contract.name}] ✅ MATCH → ${utxoId}`);

            for (const amt of utxo.amount) {
                if (amt.unit === GMAYZ_UNIT) {
                    total += BigInt(amt.quantity);
                }
            }
        }
    }

    if (DEBUG) console.log(`[${contract.name}] Matched UTXOs: ${matchCount}, gMAYZ: ${total}`);
    return total;
}

async function getGMAYZFromCreatedFunds(pkh: string): Promise<{ total: bigint; funds: any[] }> {
    console.log(`\n🔍 Querying API for funds created by PKH: ${pkh}`);

    try {
        const response = await axios.post(
            DAPP_API_URL,
            {
                paramsFilter: {
                    $and: [
                        {
                            _creator: pkh,
                            'fdTokenGov_AC.CS': GMAYZ_CS,
                            'fdTokenGov_AC.TN': GMAYZ_TN,
                        },
                    ],
                },
                fieldsForSelect: {
                    name: true,
                    fdTokenGov_AC: true,
                    fdRequiredTokenGov: true,
                },
                doCallbackAfterLoad: false,
                loadRelations: {
                    investUnit_id: false,
                },
                checkRelations: false,
            },
            {
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
            }
        );

        const funds = response.data;
        let total = 0n;

        console.log(`✅ Found ${funds.length} fund(s) created by this wallet`);

        for (const fund of funds) {
            const required = BigInt(fund.fdRequiredTokenGov || '0');
            total += required;
            console.log(`   → Fund: ${fund.name}, gMAYZ locked: ${required.toString()}`);
        }

        return { total, funds };
    } catch (error) {
        console.error(`⚠️ Error fetching funds from API:`, error);
        return { total: 0n, funds: [] };
    }
}

function formatGMAYZ(amount: bigint): string {
    const decimals = 6;
    const divisor = BigInt(10 ** decimals);
    const whole = amount / divisor;
    const fraction = amount % divisor;
    return `${whole}.${fraction.toString().padStart(decimals, '0')}`;
}

async function main() {
    console.log('🚀 Starting gMAYZ Balance Calculator\n');
    console.log(`📍 gMAYZ Token: ${GMAYZ_CS}.${GMAYZ_TN}\n`);

    for (const wallet of WALLET_ADDRESSES) {
        const { pkh, stake } = extractHashesFromAddress(wallet.address);

        console.log(`\n${'='.repeat(80)}`);
        console.log(`📦 Wallet: ${wallet.name}`);
        console.log(`   Address: ${wallet.address}`);
        console.log(`   PKH: ${pkh}`);
        console.log(`   Stake: ${stake}`);
        console.log(`${'='.repeat(80)}`);

        // 1. Direct wallet holdings
        console.log(`\n🔸 Direct Wallet Holdings:`);
        const holdingsGMAYZ = await getGMAYZFromWalletHoldings(wallet.address);
        console.log(`   → gMAYZ: ${formatGMAYZ(holdingsGMAYZ)}`);

        // 2. Locked in contracts
        console.log(`\n🔸 Locked in Contracts:`);
        let contractsTotal = 0n;
        const contractBreakdown: { name: string; amount: bigint }[] = [];

        for (const contract of CONTRACTS) {
            const contractGMAYZ = await getGMAYZFromContract(contract, pkh, stake);
            if (contractGMAYZ > 0n) {
                contractsTotal += contractGMAYZ;
                contractBreakdown.push({ name: contract.name, amount: contractGMAYZ });
                console.log(`   → ${contract.name}: ${formatGMAYZ(contractGMAYZ)}`);
            }
        }

        if (contractBreakdown.length === 0) {
            console.log(`   → No gMAYZ found in contracts`);
        }

        // 3. Locked in created funds
        console.log(`\n🔸 Locked in Created Funds:`);
        const { total: fundsGMAYZ, funds } = await getGMAYZFromCreatedFunds(pkh);
        console.log(`   → Total gMAYZ in created funds: ${formatGMAYZ(fundsGMAYZ)}`);

        // 4. Grand total
        const grandTotal = holdingsGMAYZ + contractsTotal + fundsGMAYZ;

        console.log(`\n${'─'.repeat(80)}`);
        console.log(`📊 SUMMARY for ${wallet.name}:`);
        console.log(`   Direct Holdings:     ${formatGMAYZ(holdingsGMAYZ).padStart(20)} gMAYZ`);
        console.log(`   Locked in Contracts: ${formatGMAYZ(contractsTotal).padStart(20)} gMAYZ`);
        console.log(`   Locked in Funds:     ${formatGMAYZ(fundsGMAYZ).padStart(20)} gMAYZ`);
        console.log(`   ${'─'.repeat(76)}`);
        console.log(`   TOTAL:               ${formatGMAYZ(grandTotal).padStart(20)} gMAYZ`);
        console.log(`${'─'.repeat(80)}`);
    }

    console.log(`\n✅ gMAYZ balance calculation complete.\n`);
}

main().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
