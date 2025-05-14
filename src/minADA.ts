// import { UTxO } from 'lucid-cardano';
import { addAssetsList, calculateMinAda, calculateMinAdaOfAssets, calculateMinAdaOfUTxO, calculateNumAssetsAndPIDS } from '../../src/lib/MayzSmartDB/Commons/index.exports';
import { strToHex } from '../../src/lib/SmartDB/Commons/utils';

const assetsADA = {
    ['lovelace']: 1n,
};
const assetsMulti1 = {
    ['d5dec6074942b36b50975294fd801f7f28c907476b1ecc1b57c916e1' + strToHex('tk01')]: 1n,
};
const assetsMulti1WithADA = addAssetsList([assetsADA, assetsMulti1]);

const assetsMulti2 = {
    ['d5dec6074942b36b50975294fd801f7f28c907476b1ecc1b57c916e1' + strToHex('tk01tk01tk01')]: 1n,
};

const assetsMulti3 = addAssetsList([assetsADA, assetsMulti1, assetsMulti2]);

const datum =
    'd8799fd8799f581cd3453f3693c96c135226c00deafdc464067d12cb3c0287b44116811b581cfc4b4f6440bafdb46c008dcad7338b094254b1c10a7cc2bd4ed2b40b581ce44c67c53e593671792cc27f095bbcc69aaee2ff1b4d875bdbff5cabd87a801a0001de841a07a162a71ae27fdfd90000011a006e7e72ffff';

async function run() {
    const result1 = calculateMinAdaOfAssets(assetsADA);

    const UTxO: Partial<any> = {
        assets: assetsADA,
        datum: datum,
    };
    const result2 = calculateMinAdaOfUTxO(UTxO);

}