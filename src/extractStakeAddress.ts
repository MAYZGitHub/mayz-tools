import fs from 'fs';
import C from '@emurgo/cardano-serialization-lib-nodejs';

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

        return null; // Evitamos otras direcciones (por ej., script addresses o pointer addresses)
    } catch (error) {
        console.error(`Invalid address encountered: ${address}`);
        return null;
    }
}

async function main() {
    const input = fs.readFileSync('files/HOLDERS GMAYZ.txt', 'utf8');
    const addresses = JSON.parse(input);

    const stakeAddressMap: Record<string, number> = {};

    for (const { address, quantity } of addresses) {
        const stakeAddr = extractStakeAddress(address);
        if (stakeAddr) {
            const amount = parseInt(quantity, 10);
            stakeAddressMap[stakeAddr] = (stakeAddressMap[stakeAddr] || 0) + amount;
        }
    }

    const csvLines = ["stake_address,amount"];
    for (const [stake, totalAmount] of Object.entries(stakeAddressMap)) {
        csvLines.push(`${stake},${totalAmount}`);
    }

    const csvContent = csvLines.join("\n");

    fs.writeFileSync('files/stake_addresses_with_amount.csv', csvContent);
    console.log("Archivo CSV generado correctamente: stake_addresses_with_amount.csv");
}

main();
