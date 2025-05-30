import C from '@emurgo/cardano-serialization-lib-nodejs';
import { Data } from '@lucid-evolution/lucid';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const BLOCKFROST_API_KEY = process.env.BLOCKFROST_API_KEY!;
const API_URL = 'https://cardano-mainnet.blockfrost.io/api/v0';
const GMAYZ_POLICY = process.env.GMAYZ_POLICY!;
const GMAYZ_ASSET_NAME_HEX = process.env.GMAYZ_ASSET_NAME_HEX!;
const GMAYZ_UNIT = `${GMAYZ_POLICY}${GMAYZ_ASSET_NAME_HEX}`;

// Define aquí tus contratos con sus paths para pkh y stake en el datum
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

type Utxo = {
  tx_hash: string;
  output_index: number;
  inline_datum?: string;
  data_hash?: string;
  amount: { unit: string; quantity: string }[];
};

type DumpEntry = {
  contract: string;
  utxoId: string;
  pkh: string | null;
  stake: string | null;
  amounts: { unit: string; quantity: string }[];
};

/**
 * Convierte hash de stake (hex) a dirección bech32 (stake1...)
 */
function hexToStakeAddress(hex: string): string {
  const bytes = Buffer.from(hex, 'hex');
  const keyHash = C.Ed25519KeyHash.from_bytes(bytes);
  const stakeCred = C.StakeCredential.from_keyhash(keyHash);
  const rewardAddr = C.RewardAddress.new(1, stakeCred);
  return rewardAddr.to_address().to_bech32();
}

/**
 * Accede recursivamente a un campo de datum
 */
function getByPath(obj: any, path: (string | number)[]): any {
  return path.reduce((acc, key) => acc?.[key], obj);
}

/**
 * Obtiene UTXOs de un address de contrato
 */
async function getUtxos(address: string): Promise<Utxo[]> {
  const res = await axios.get(`${API_URL}/addresses/${address}/utxos`, {
    headers: { project_id: BLOCKFROST_API_KEY },
  });
  return res.data;
}

/**
 * Resuelve el datum, ya sea inline o por data_hash
 */
async function resolveDatum(utxo: Utxo): Promise<any | null> {
  if (utxo.inline_datum) {
    try {
      return Data.from(utxo.inline_datum);
    } catch {
      return null;
    }
  }
  if (utxo.data_hash) {
    try {
      const res = await axios.get(
        `${API_URL}/scripts/datum/${utxo.data_hash}`,
        { headers: { project_id: BLOCKFROST_API_KEY } }
      );
      return res.data.json_value;
    } catch {
      return null;
    }
  }
  return null;
}

async function main() {
  const dump: DumpEntry[] = [];

  for (const contract of CONTRACTS) {
    console.log(`🔍 Escaneando ${contract.name} @ ${contract.address}`);
    const utxos = await getUtxos(contract.address);

    for (const utxo of utxos) {
      const datum = await resolveDatum(utxo);
      if (!datum) continue;

      const pkhField = getByPath(datum, contract.pkhPath) ?? null;
      const rawStake = getByPath(datum, contract.stakePath) ?? null;
      const stakeAddr = typeof rawStake === 'string' ? hexToStakeAddress(rawStake) : null;
      const utxoId = `${utxo.tx_hash}#${utxo.output_index}`;

      dump.push({
        contract: contract.name,
        utxoId,
        pkh: pkhField,
        stake: stakeAddr,
        amounts: utxo.amount,
      });
    }
  }

  // Escribe el dump completo a disco, convirtiendo BigInt a string
  // Filtrar solo GMAYZ
	const gmayzDump = dump
	  .map(e => ({
		...e,
		amounts: e.amounts.filter(a => a.unit === GMAYZ_UNIT)
	  }))
	  .filter(e => e.amounts.length > 0);
	fs.writeFileSync(
	  'gmayzDump.json',
	  JSON.stringify(
		gmayzDump,
		(_key, value) => (typeof value === 'bigint' ? value.toString() : value),
		2
	  )
	);
	console.log('✅ gmayzDump.json creado con', gmayzDump.length, 'entradas');
	console.log('GMAYZ_UNIT usada:', GMAYZ_UNIT);
}

main().catch(err => {
  console.error('❌ Error en dumpAll:', err);
  process.exit(1);
});
