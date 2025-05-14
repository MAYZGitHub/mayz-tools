import fs from 'fs';
import axios from 'axios';
import C from '@emurgo/cardano-serialization-lib-nodejs';
import dotenv from 'dotenv';

// Cargamos variables de entorno desde .env
dotenv.config();

const BLOCKFROST_API_KEY = process.env.BLOCKFROST_API_KEY;
if (!BLOCKFROST_API_KEY) throw new Error('BLOCKFROST_API_KEY is missing in .env file.');

const ASSET_POLICY = 'e46f629f31e4a3c4ba16dd3bc396f24fb222f2776e7d698f2bda5018';
const ASSET_NAME_HEX = '674d41595a'; // Hex para "gMAYZ"
const ASSET = ASSET_POLICY + ASSET_NAME_HEX;
const BASE_URL = 'https://cardano-mainnet.blockfrost.io/api/v0';

interface Holder {
    address: string;
    quantity: string;
}

async function fetchAllHolders(): Promise<Holder[]> {
    let holders: Holder[] = [];
    let page = 1;
    const count = 100;

    while (true) {
        const response = await axios.get(
            `${BASE_URL}/assets/${ASSET}/addresses`,
            {
                params: { count, page, order: 'asc' },
                headers: { project_id: BLOCKFROST_API_KEY }
            }
        );

        const data: Holder[] = response.data;
        if (data.length === 0) break;

        holders = holders.concat(data);
        page++;
    }

    return holders;
}

function extractStakeAddress(address: string): string | null {
    try {
        const addr = C.Address.from_bech32(address);
        const baseAddr = C.BaseAddress.from_address(addr);

        if (baseAddr) {
            const stakeCred = baseAddr.stake_cred();
            const stakeAddr = C.RewardAddress.new(
                addr.network_id(),
                stakeCred
            );
            return stakeAddr.to_address().to_bech32();
        }

        return null; // No es una dirección base
    } catch (error) {
        console.error(`Invalid address encountered: ${address}`);
        return null;
    }
}

async function main() {
    const holders = await fetchAllHolders();

    const csvLines = ["wallet_address,stake_address,amount"];

    for (const holder of holders) {
        const walletAddress = holder.address;
        const stakeAddress = extractStakeAddress(walletAddress) || 'N/A';
        const amount = holder.quantity;

        csvLines.push(`${walletAddress},${stakeAddress},${amount}`);
    }

    const csvContent = csvLines.join("\n");
    fs.writeFileSync('files/holders_with_stake_wallet_amount.csv', csvContent);

    console.log("Archivo CSV generado correctamente: holders_with_stake_wallet_amount.csv");
}

main().catch(err => console.error(err));
