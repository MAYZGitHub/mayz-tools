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

// User wallet address to query
const USER_WALLET_ADDRESS = 'addr1q93ahkwqtghpe4megvrps26cnd0nmqxkq24jsenexsc7suc4pxw3akg47zvj9kkmdu952aff9qnx5xx07gg6f22ufdxswlu0kv';

// Funds to query
const FUNDS_TO_QUERY = [
    {
        name: 'CDEX',
        id: '68546467e324e6b50d6651aa',
        policyCS: 'fba03fec6fe3e948446ac01578ddbbdb9f4bcebd2d4eb18f285868dc',
    },
    {
        name: 'CTOOL',
        id: '687a9c693f7439a906a207f7',
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

async function getHistoryDeposits(fundId: string): Promise<any[]> {
    try {
        const response = await axios.post(
            `${DAPP_API_URL}/history-deposits/by-params`,
            {
                paramsFilter: {
                    fund_id: fundId,
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
        console.error(`❌ Error fetching deposits history:`, error);
        return [];
    }
}

async function getHistoryDelegations(fundId: string): Promise<any[]> {
    try {
        const response = await axios.post(
            `${DAPP_API_URL}/history-delegations/by-params`,
            {
                paramsFilter: {
                    fund_id: fundId,
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
        console.error(`❌ Error fetching delegations history:`, error);
        return [];
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
        console.error(`❌ Error fetching user delegations history:`, error);
        return [];
    }
}

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
}

function formatNumber(value: string | number, width: number = 16): string {
    if (typeof value === 'string') {
        const num = BigInt(value);
        return num.toString().padStart(width, ' ');
    }
    return value.toString().padStart(width, ' ');
}

function printCombinedHistory(deposits: any[], delegations: any[], userDelegations: any[]) {
    // Create a map of dates from deposits and delegations
    const dateMap = new Map<string, any>();

    // Add all deposits
    for (const deposit of deposits) {
        const date = formatDate(deposit.date);
        if (!dateMap.has(date)) {
            dateMap.set(date, { deposit: null, delegation: null, userDelegation: null });
        }
        dateMap.get(date)!.deposit = deposit;
    }

    // Add all delegations
    for (const delegation of delegations) {
        const date = formatDate(delegation.date);
        if (!dateMap.has(date)) {
            dateMap.set(date, { deposit: null, delegation: null, userDelegation: null });
        }
        dateMap.get(date)!.delegation = delegation;
    }

    // Add all user delegations
    for (const userDel of userDelegations) {
        const date = formatDate(userDel.date);
        if (dateMap.has(date)) {
            dateMap.get(date)!.userDelegation = userDel;
        }
    }

    // Sort dates
    const sortedDates = Array.from(dateMap.keys()).sort();

    console.log(`${'─'.repeat(190)}`);
    console.log(`📊 COMBINED FUND & USER HISTORY:`);
    console.log(`${'─'.repeat(190)}`);

    // Header
    console.log(
        'Date       '.padEnd(12) +
            '| ' +
            'Months'.padStart(6) +
            ' | ' +
            'New Deposits'.padStart(16) +
            ' | ' +
            'Total Deposits'.padStart(16) +
            ' | ' +
            'New Commiss'.padStart(15) +
            ' | ' +
            'Total Commiss'.padStart(15) +
            ' | ' +
            'New Delegations'.padStart(16) +
            ' | ' +
            'Total Delegations'.padStart(16) +
            ' | ' +
            'User New Del'.padStart(16) +
            ' | ' +
            'User Total Del'.padStart(16) +
            ' | ' +
            'User Total All'.padStart(16) +
            ' | ' +
            'User New Comm'.padStart(16) +
            ' | ' +
            'User Tot Comm'.padStart(16)
    );
    console.log(`${'─'.repeat(190)}`);

    // Rows
    for (const date of sortedDates) {
        const entry = dateMap.get(date)!;

        const monthsRemaining = entry.deposit?.monthsRemaining || 0;
        const newDeposits = entry.deposit?.newDeposits || 0;
        const totalDeposits = entry.deposit?.totalDeposits || 0;
        const newDelegations = entry.delegation?.newDelegations || 0;
        const totalDelegations = entry.delegation?.totalDelegations || 0;

        const newCommissions = entry.deposit?.newCommissions || 0;
        const totalCommissions = entry.deposit?.totalCommissions || 0;

        // Use user values only if we have data for this date, otherwise show empty
        const userNewDel = entry.userDelegation ? formatNumber(entry.userDelegation.newDelegationsUser || 0, 16) : ''.padStart(16);
        const userTotalDel = entry.userDelegation ? formatNumber(entry.userDelegation.totalDelegationsUser || 0, 16) : ''.padStart(16);
        const userTotalAll = entry.userDelegation ? formatNumber(entry.userDelegation.totalDelegationsAll || 0, 16) : ''.padStart(16);
        const userNewComm = entry.userDelegation ? formatNumber(entry.userDelegation.newAvailableCommissionsUser || 0, 16) : ''.padStart(16);
        const userTotComm = entry.userDelegation ? formatNumber(entry.userDelegation.totalAvailableCommissionsUser || 0, 16) : ''.padStart(16);

        console.log(
            date.padEnd(12) +
                '| ' +
                monthsRemaining.toString().padStart(6) +
                ' | ' +
                formatNumber(newDeposits, 16) +
                ' | ' +
                formatNumber(totalDeposits, 16) +
                ' | ' +
                formatNumber(newCommissions, 16) +
                ' | ' +
                formatNumber(totalCommissions, 16) +
                ' | ' +
                formatNumber(newDelegations, 16) +
                ' | ' +
                formatNumber(totalDelegations, 16) +
                ' | ' +
                userNewDel +
                ' | ' +
                userTotalDel +
                ' | ' +
                userTotalAll +
                ' | ' +
                userNewComm +
                ' | ' +
                userTotComm
        );
    }
    console.log(`${'─'.repeat(190)}\n`);
}

async function getFundsAndUserHistory() {
    console.log('🚀 Starting Get Funds & User History Script\n');
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
        console.log(`\n${'='.repeat(190)}`);
        console.log(`📦 Fund: ${fund.name}`);
        console.log(`   ID:        ${fund.id}`);
        console.log(`   Policy CS: ${fund.policyCS}`);
        console.log(`${'='.repeat(190)}\n`);

        // Get all histories
        console.log(`🔸 Fetching histories...`);
        const [deposits, delegations, userDelegations] = await Promise.all([getHistoryDeposits(fund.id), getHistoryDelegations(fund.id), getHistoryDelegationsUser(pkh, fund.id)]);

        console.log(`✅ Found ${deposits.length} deposit(s), ${delegations.length} delegation(s), ${userDelegations.length} user delegation(s)\n`);

        if (deposits.length > 0 || delegations.length > 0) {
            printCombinedHistory(deposits, delegations, userDelegations);
        } else {
            console.log(`   No history found for this fund.\n`);
        }
    }

    console.log(`\n${'='.repeat(190)}`);
    console.log(`\n✅ Get Funds & User History script complete.\n`);
}

getFundsAndUserHistory().catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
});
