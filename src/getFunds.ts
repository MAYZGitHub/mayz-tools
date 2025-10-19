import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';

if (fs.existsSync('.env.local')) {
    dotenv.config({ path: '.env.local' });
} else {
    dotenv.config();
}

const DAPP_API_URL = 'https://dapp.mayz.io/api/funds-with-details/by-params';

async function getFunds() {
    console.log('🚀 Starting Get Funds Script\n');
    console.log(`📍 API URL: ${DAPP_API_URL}\n`);

    try {
        const response = await axios.post(
            DAPP_API_URL,
            {
                paramsFilter: {},
                fieldsForSelect: {
                    id: true,
                    name: true,
                    fdFundPolicy_CS: true,
                    fdFundFT_TN_Hex: true,
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

        console.log(`✅ Found ${funds.length} fund(s)\n`);
        console.log(`${'='.repeat(100)}`);

        for (const fund of funds) {
            // console.log(`\n📦 Fund: ${JSON.stringify(fund)}`);
            const id = fund._DB_id || 'N/A';
            const name = fund.name || 'Unnamed Fund';
            const policyCS = fund.fdFundPolicy_CS || 'N/A';
            const tokenName = fund.fdFundFT_TN_Hex || 'N/A';

            console.log(`\n📦 Fund: ${name}`);
            console.log(`   ID:        ${id}`);
            console.log(`   Policy CS: ${policyCS}`);
            console.log(`   Token Name: ${tokenName}`);
            console.log(`   ${'-'.repeat(96)}`);
        }

        console.log(`\n${'='.repeat(100)}`);
        console.log(`\n✅ Get Funds script complete.\n`);
    } catch (error) {
        console.error(`❌ Error fetching funds from API:`, error);
        process.exit(1);
    }
}

getFunds().catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
});
