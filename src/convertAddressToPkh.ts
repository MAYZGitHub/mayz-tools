import C from '@emurgo/cardano-serialization-lib-nodejs';

export function pubKeyHashToAddress(network: number, pkh: string, stakePkh?: string) {
    console.log('pubKeyHashToAddress - pkh: ' + pkh);
    const keyHash = C.Ed25519KeyHash.from_hex(pkh);
    let stekeKeyHash;
    if (stakePkh !== undefined && stakePkh !== '') {
        stekeKeyHash = C.Ed25519KeyHash.from_hex(stakePkh);
    } else {
        stekeKeyHash = undefined;
    }
    const bech32 = Ed25519KeyHashToAddress(network, keyHash, stekeKeyHash);
    return bech32;
}

export function Ed25519KeyHashToAddress(network: number, keyHash: C.Ed25519KeyHash, stakeKeyHash?: C.Ed25519KeyHash) {
    let address;

    if (stakeKeyHash !== undefined) {
        address = C.BaseAddress.new(network, C.StakeCredential.from_keyhash(keyHash), C.StakeCredential.from_keyhash(stakeKeyHash));
    } else {
        address = C.EnterpriseAddress.new(network, C.StakeCredential.from_keyhash(keyHash));
    }

    const bech32 = address.to_address().to_bech32(undefined);

    return bech32;
}


async function run() {
    const address = pubKeyHashToAddress (0,'4a7f481cf94777e442f3c6d5be7206f11d6041302a9d9ebff9aded4f','b70c1852f881584693c30c29d5850b7d4b759620efeb1ffaa0e737b9','')
    console.log('Address: ' + address);
}

run();
