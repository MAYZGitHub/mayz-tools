import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';

if (fs.existsSync('.env.local')) {
    dotenv.config({ path: '.env.local' });
} else {
    dotenv.config();
}

const DAPP_API_URL = 'https://dapp.mayz.io/api';

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

async function getHistoryDeposits(fundId: string): Promise<any[]> {
    try {
        const response = await axios.post(
            `${DAPP_API_URL}/history-deposits/by-params`,
            {
                paramsFilter: {
                    fund_id: fundId,
                },
                fieldsForSelect: {},
                sort: { date: 1 }, // ascending order
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

        return response.data;
    } catch (error) {
        console.error(`❌ Error fetching deposits for fund ${fundId}:`, error);
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
                sort: { date: 1 }, // ascending order
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

        return response.data;
    } catch (error) {
        console.error(`❌ Error fetching delegations for fund ${fundId}:`, error);
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

function printSummaryTable(deposits: any[], delegations: any[]) {
    console.log(`${'─'.repeat(160)}`);
    console.log(`📊 SUMMARY:`);
    console.log(`${'─'.repeat(160)}`);

    // Header
    console.log(
        'Date       '.padEnd(12) +
            '| ' +
            'Months'.padStart(6) +
            ' | ' +
            'New Deposits'.padStart(15) +
            ' | ' +
            'Total Deposits'.padStart(15) +
            ' | ' +
            'New Commiss'.padStart(15) +
            ' | ' +
            'Total Commiss'.padStart(15) +
            ' | ' +
            'New Delegations'.padStart(18) +
            ' | ' +
            'Total Delegations'.padStart(18)
    );
    console.log(`${'─'.repeat(160)}`);

    // Create a map of delegations by date for easy lookup
    const delegationsMap = new Map();
    for (const delegation of delegations) {
        delegationsMap.set(formatDate(delegation.date), delegation);
    }

    // Rows - iterate through deposits and match with delegations
    for (const deposit of deposits) {
        const date = formatDate(deposit.date);
        const delegation = delegationsMap.get(date);

        console.log(
            date.padEnd(12) +
                '| ' +
                deposit.monthsRemaining.toString().padStart(6) +
                ' | ' +
                formatNumber(deposit.newDeposits) +
                ' | ' +
                formatNumber(deposit.totalDeposits) +
                ' | ' +
                formatNumber(deposit.newCommissions) +
                ' | ' +
                formatNumber(deposit.totalCommissions) +
                ' | ' +
                formatNumber(delegation?.newDelegations || '0').padStart(18) +
                ' | ' +
                formatNumber(delegation?.totalDelegations || '0').padStart(18)
        );
    }
    console.log(`${'─'.repeat(160)}\n`);
}

function printDetailTable(deposits: any[], delegations: any[]) {
    console.log(`${'─'.repeat(140)}`);
    console.log(`📊 DETAIL:`);
    console.log(`${'─'.repeat(140)}`);

    // Create a map of delegations by date for easy lookup
    const delegationsMap = new Map();
    for (const delegation of delegations) {
        delegationsMap.set(formatDate(delegation.date), delegation);
    }

    for (const deposit of deposits) {
        const date = formatDate(deposit.date);
        const delegation = delegationsMap.get(date);

        // Line 1: Date
        console.log('📅 ' + date);

        // Line 2: Months and basic deposit info
        console.log(
            '   Months: ' +
                deposit.monthsRemaining.toString().padStart(2) +
                ' | ' +
                'New Deposits:'.padEnd(18) +
                formatNumber(deposit.newDeposits, 16) +
                ' | ' +
                'Total Deposits:'.padEnd(18) +
                formatNumber(deposit.totalDeposits, 16)
        );

        // Line 3: Commissions
        console.log(
            '              ' +
                '| ' +
                'New Commiss:'.padEnd(18) +
                formatNumber(deposit.newCommissions, 16) +
                ' | ' +
                'Total Commiss:'.padEnd(18) +
                formatNumber(deposit.totalCommissions, 16) +
                ' | ' +
                'Commiss/Month:'.padEnd(18) +
                formatNumber(deposit.totalCommissions_Release_PerMonth_1e6, 16)
        );

        // Line 4: Delegations
        console.log(
            '              ' +
                '| ' +
                'New Delegations:'.padEnd(18) +
                formatNumber(delegation?.newDelegations || '0', 16) +
                ' | ' +
                'Total Delegations:'.padEnd(18) +
                formatNumber(delegation?.totalDelegations || '0', 16)
        );

        // Line 5: Collected commissions
        console.log(
            '              ' +
                '| ' +
                'NewColl → Prot:'.padEnd(18) +
                formatNumber(deposit.newCommissions_Collected_Protocol, 16) +
                ' | ' +
                'Mgrs:'.padEnd(18) +
                formatNumber(deposit.newCommissions_Collected_Managers, 16) +
                ' | ' +
                'Deleg:'.padEnd(18) +
                formatNumber(deposit.newCommissions_Collected_Delegators, 16)
        );

        // Line 6: Total collected commissions
        console.log(
            '              ' +
                '| ' +
                'TotColl → Prot:'.padEnd(18) +
                formatNumber(deposit.totalCommissions_Collected_Protocol, 16) +
                ' | ' +
                'Mgrs:'.padEnd(18) +
                formatNumber(deposit.totalCommissions_Collected_Managers, 16) +
                ' | ' +
                'Deleg:'.padEnd(18) +
                formatNumber(deposit.totalCommissions_Collected_Delegators, 16)
        );

        // Line 7: New available commissions
        console.log(
            '              ' +
                '| ' +
                'NewAvail → Prot:'.padEnd(18) +
                formatNumber(deposit.newAvailableCommissions_Protocol, 16) +
                ' | ' +
                'Mgrs:'.padEnd(18) +
                formatNumber(deposit.newAvailableCommissions_Managers, 16) +
                ' | ' +
                'Deleg:'.padEnd(18) +
                formatNumber(deposit.newAvailableCommissions_Delegators, 16)
        );

        // Line 8: Total available commissions
        console.log(
            '              ' +
                '| ' +
                'TotAvail → Prot:'.padEnd(18) +
                formatNumber(deposit.totalAvailableCommissions_Protocol, 16) +
                ' | ' +
                'Mgrs:'.padEnd(18) +
                formatNumber(deposit.totalAvailableCommissions_Managers, 16) +
                ' | ' +
                'Deleg:'.padEnd(18) +
                formatNumber(deposit.totalAvailableCommissions_Delegators, 16)
        );

        console.log(`${'-'.repeat(140)}`);
    }
    console.log(`\n`);
}

async function getFundsHistory() {
    console.log('🚀 Starting Get Funds History Script\n');
    console.log(`📍 API URL: ${DAPP_API_URL}\n`);
    console.log(`📋 Querying ${FUNDS_TO_QUERY.length} fund(s)\n`);

    for (const fund of FUNDS_TO_QUERY) {
        console.log(`\n${'='.repeat(150)}`);
        console.log(`📦 Fund: ${fund.name}`);
        console.log(`   ID:        ${fund.id}`);
        console.log(`   Policy CS: ${fund.policyCS}`);
        console.log(`${'='.repeat(150)}\n`);

        // Get deposits and delegations history
        console.log(`🔸 Fetching History...`);
        const deposits = await getHistoryDeposits(fund.id);
        const delegations = await getHistoryDelegations(fund.id);
        console.log(`✅ Found ${deposits.length} deposit(s) and ${delegations.length} delegation(s)\n`);

        if (deposits.length > 0 || delegations.length > 0) {
            printSummaryTable(deposits, delegations);
            printDetailTable(deposits, delegations);
        } else {
            console.log(`   No history found for this fund.\n`);
        }

        console.log(`\n`);
    }

    console.log(`${'='.repeat(150)}`);
    console.log(`\n✅ Get Funds History script complete.\n`);
}

getFundsHistory().catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
});
