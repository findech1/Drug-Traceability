/**
 * ============================================================================
 * MODULE: server/fabricGateway.ts
 * Real Hyperledger Fabric v2.5 Node.js Gateway SDK Client
 * Uses official `@hyperledger/fabric-gateway` and `@grpc/grpc-js` over mTLS.
 * Activated when `FABRIC_ENABLED=true` and peer X.509 credentials exist.
 * ============================================================================
 */

import * as grpc from '@grpc/grpc-js';
import { connect, hash, signers } from '@hyperledger/fabric-gateway';
import type { Contract, Gateway, Identity, Signer } from '@hyperledger/fabric-gateway';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface FabricGatewayConfig {
  enabled: boolean;
  channelName: string;
  chaincodeName: string;
  mspId: string;
  peerEndpoint: string;
  peerHostAlias: string;
  cryptoPath: string;
}

export interface FabricGatewayStatus {
  mode: 'live-fabric-gateway' | 'standby-node-engine';
  fabricEnabled: boolean;
  connected: boolean;
  channelName: string;
  chaincodeName: string;
  mspId: string;
  peerEndpoint: string;
  error?: string;
}

async function getFirstFileInDir(dirPath: string): Promise<string> {
  const entries = await fs.readdir(dirPath);
  if (entries.length === 0) {
    throw new Error(`No certificate/key files found in ${dirPath}`);
  }
  return path.join(dirPath, entries[0]);
}

export class FabricGatewayService {
  private readonly config: FabricGatewayConfig;
  private gateway: Gateway | null = null;
  private grpcClient: grpc.Client | null = null;
  private lastError: string | undefined;

  constructor() {
    this.config = {
      enabled: process.env.FABRIC_ENABLED === 'true',
      channelName: process.env.FABRIC_CHANNEL || 'pharma-ke-channel',
      chaincodeName: process.env.FABRIC_CHAINCODE || 'pharmachain-cc',
      mspId: process.env.FABRIC_MSP_ID || 'DawaLifeMSP',
      peerEndpoint: process.env.FABRIC_PEER_ENDPOINT || 'localhost:7051',
      peerHostAlias: process.env.FABRIC_PEER_HOST_ALIAS || 'peer0.dawa.pharmachain.ke',
      cryptoPath: path.resolve(
        process.env.FABRIC_CRYPTO_PATH ||
          './fabric/network/organizations/peerOrganizations/dawa.pharmachain.ke'
      ),
    };
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  public getStatus(): FabricGatewayStatus {
    return {
      mode: this.gateway ? 'live-fabric-gateway' : 'standby-node-engine',
      fabricEnabled: this.config.enabled,
      connected: Boolean(this.gateway),
      channelName: this.config.channelName,
      chaincodeName: this.config.chaincodeName,
      mspId: this.config.mspId,
      peerEndpoint: this.config.peerEndpoint,
      error: this.lastError,
    };
  }

  private async connectContract(): Promise<Contract> {
    if (this.gateway) {
      const network = this.gateway.getNetwork(this.config.channelName);
      return network.getContract(this.config.chaincodeName);
    }

    const tlsCertPath = path.join(
      this.config.cryptoPath,
      'peers',
      this.config.peerHostAlias,
      'tls',
      'ca.crt'
    );
    const certDir = path.join(
      this.config.cryptoPath,
      'users',
      `User1@${path.basename(this.config.cryptoPath)}`,
      'msp',
      'signcerts'
    );
    const keyDir = path.join(
      this.config.cryptoPath,
      'users',
      `User1@${path.basename(this.config.cryptoPath)}`,
      'msp',
      'keystore'
    );

    const tlsRootCert = await fs.readFile(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    this.grpcClient = new grpc.Client(this.config.peerEndpoint, tlsCredentials, {
      'grpc.ssl_target_name_override': this.config.peerHostAlias,
    });

    const certFile = await getFirstFileInDir(certDir);
    const keyFile = await getFirstFileInDir(keyDir);

    const credentials = await fs.readFile(certFile);
    const privateKeyPem = await fs.readFile(keyFile);
    const privateKey = crypto.createPrivateKey(privateKeyPem);

    const identity: Identity = { mspId: this.config.mspId, credentials };
    const signer: Signer = signers.newPrivateKeySigner(privateKey);

    this.gateway = connect({
      client: this.grpcClient,
      identity,
      signer,
      hash: hash.sha256,
    });

    const network = this.gateway.getNetwork(this.config.channelName);
    return network.getContract(this.config.chaincodeName);
  }

  public async evaluateTransaction(fn: string, ...args: string[]): Promise<string> {
    const contract = await this.connectContract();
    const resultBytes = await contract.evaluateTransaction(fn, ...args);
    return Buffer.from(resultBytes).toString('utf8');
  }

  public async submitTransaction(
    fn: string,
    args: string[],
    transientData?: Record<string, Uint8Array>
  ): Promise<string> {
    const contract = await this.connectContract();
    if (transientData) {
      const resultBytes = await contract.submit(fn, {
        arguments: args,
        transientData,
      });
      return Buffer.from(resultBytes).toString('utf8');
    }
    const resultBytes = await contract.submitTransaction(fn, ...args);
    return Buffer.from(resultBytes).toString('utf8');
  }

  public async checkConnection(): Promise<FabricGatewayStatus> {
    if (!this.config.enabled) {
      return this.getStatus();
    }
    try {
      await this.connectContract();
      this.lastError = undefined;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'Fabric peer unreachable';
      this.close();
    }
    return this.getStatus();
  }

  public close(): void {
    this.gateway?.close();
    this.grpcClient?.close();
    this.gateway = null;
    this.grpcClient = null;
  }
}
