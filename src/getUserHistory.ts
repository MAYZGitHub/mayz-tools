import C from '@emurgo/cardano-serialization-lib-nodejs';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';

if (fs.existsSync('.env.local')) {
    dotenv.config({ path: '.env.local' });
} else {
    dotenv.config();
}

const DAPP_API_URL = 'https://dapp.mayz.io/api';

// User wallet address to query - CHANGE THIS TO THE WALLET YOU WANT TO QUERY
const USER_WALLET_ADDRESS = 'addr1q93ahkwqtghpe4megvrps26cnd0nmqxkq24jsenexsc7suc4pxw3akg47zvj9kkmdu952aff9qnx5xx07gg6f22ufdxswlu0kv';

// Configure the funds you want to query
const FUNDS_TO_QUERY = [
    {
        id: '68546467e324e6b50d6651aa',
        name: 'CDEX',
        policyCS: 'fba03fec6fe3e948446ac01578ddbbdb9f4bcebd2d4eb18f285868dc',
    },
    {
        id: '687a9c693f7439a906a207f7',
        name: 'CTOOL',
        policyCS: '23b267d4504fffec8ee38e81a9bc3947429f1b25b51de6df2831b593',
    },
];

function extractHashesFromAddress(address: string): { pkh: string; stake: string } {
    const parsed = C.Address.from_bech32(address);
    const base = C.BaseAddress.from_address(parsed);
    if (!base) throw new Error('Only BaseAddress format is supported');

    const pkh = Buffer.from(base.payment_cred().to_keyhash()!.to_bytes()).toString('hex');
    const stake = Buffer.from(base.stake_cred().to_keyhash()!.to_bytes()).toString('hex');

    return { pkh, stake };
}

async function getWalletByPKH(pkh: string): Promise<any> {
    try {
        const response = await axios.post(
            `${DAPP_API_URL}/wallets/by-params`,
            {
                paramsFilter: {
                    paymentPKH: pkh,
                },
                fieldsForSelect: {},
                doCallbackAfterLoad: false,
                loadRelations: {},
                checkRelations: false,
            },
            {
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
            }
        );

        if (response.data && response.data.length > 0) {
            return response.data[0];
        }
        return null;
    } catch (error) {
        console.error(`❌ Error fetching wallet by PKH:`, error);
        return null;
    }
}

async function getHistoryDelegationsUser(pkh: string, fundId: string): Promise<any[]> {
    try {
        const response = await axios.post(
            `${DAPP_API_URL}/history-delegations-user/by-params`,
            {
                paramsFilter: {
                    $and: [{ user: pkh }, { fund_id: fundId }],
                },
                fieldsForSelect: {},
                doCallbackAfterLoad: false,
                loadRelations: {},
                checkRelations: false,
            },
            {
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
            }
        );
        return response.data || [];
    } catch (error) {
        console.error(`❌ Error fetching delegations history for user:`, error);
        return [];
    }
}

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
}

function formatNumber(value: string | number, width: number = 15): string {
    if (typeof value === 'string') {
        const num = BigInt(value);
        return num.toString().padStart(width, ' ');
    }
    return value.toString().padStart(width, ' ');
}

function printDelegationsTable(delegations: any[]) {
    console.log(`${'─'.repeat(140)}`);
    console.log(`📊 USER DELEGATIONS HISTORY:`);
    console.log(`${'─'.repeat(140)}`);

    // Header
    console.log(
        'Date       '.padEnd(12) +
            '| ' +
            'New Deleg'.padStart(16) +
            ' | ' +
            'Total User'.padStart(16) +
            ' | ' +
            'Total All'.padStart(16) +
            ' | ' +
            'New Avail Comm User'.padStart(16) +
            ' | ' +
            'Total Avail Comm User'.padStart(16)
    );
    console.log(`${'─'.repeat(140)}`);

    // Rows
    for (const delegation of delegations) {
        console.log(
            formatDate(delegation.date).padEnd(12) +
                '| ' +
                formatNumber(delegation.newDelegationsUser, 16) +
                ' | ' +
                formatNumber(delegation.totalDelegationsUser, 16) +
                ' | ' +
                formatNumber(delegation.totalDelegationsAll, 16) +
                ' | ' +
                formatNumber(delegation.newAvailableCommissionsUser, 16) +
                ' | ' +
                formatNumber(delegation.totalAvailableCommissionsUser, 16)
        );
    }
    console.log(`${'─'.repeat(140)}\n`);
}

async function getUserDelegationsHistory() {
    console.log('🚀 Starting Get User Delegations History Script\n');
    console.log(`📍 API URL: ${DAPP_API_URL}\n`);
    console.log(`👤 User Wallet Address: ${USER_WALLET_ADDRESS}\n`);
    console.log(`📋 Querying ${FUNDS_TO_QUERY.length} fund(s)\n`);

    // Extract PKH from address
    const { pkh, stake } = extractHashesFromAddress(USER_WALLET_ADDRESS);
    console.log(`🔑 Payment PKH: ${pkh}`);
    console.log(`🔑 Stake Key:   ${stake}\n`);

    // Get wallet from database
    console.log(`🔸 Fetching wallet from database...`);
    const wallet = await getWalletByPKH(pkh);

    if (!wallet) {
        console.log(`❌ No wallet found for PKH: ${pkh}`);
        return;
    }

    console.log(`✅ Found wallet with ID: ${wallet._DB_id}\n`);

    // Iterate through each fund
    for (const fund of FUNDS_TO_QUERY) {
        console.log(`\n${'='.repeat(140)}`);
        console.log(`📦 Fund: ${fund.name}`);
        console.log(`   ID:        ${fund.id}`);
        console.log(`   Policy CS: ${fund.policyCS}`);
        console.log(`${'='.repeat(140)}\n`);

        // Get delegations history for this fund
        console.log(`🔸 Fetching delegations history for user in this fund...`);
        const delegations = await getHistoryDelegationsUser(pkh, fund.id);
        console.log(`✅ Found ${delegations.length} delegation record(s)\n`);

        if (delegations.length > 0) {
            printDelegationsTable(delegations);
        } else {
            console.log(`   No delegations history found for this user in this fund.\n`);
        }
    }

    console.log(`\n${'='.repeat(140)}`);
    console.log(`\n✅ Get User Delegations History script complete.\n`);
}

getUserDelegationsHistory().catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
});
