const { createAccount, createClient } = require('genlayer-js');
const { localnet, studionet, testnetAsimov, testnetBradbury } = require('genlayer-js/chains');
const { TransactionStatus } = require('genlayer-js/types');
const config = require('../config');
const evaluationsRepo = require('../repositories/evaluations');

const CHAINS = {
  localnet,
  studionet,
  asimov: testnetAsimov,
  testnetAsimov,
  bradbury: testnetBradbury,
  testnetBradbury,
};

function inferChainName(rpcUrl) {
  if (/studio\.genlayer\.com/i.test(rpcUrl)) return 'studionet';
  if (/asimov/i.test(rpcUrl)) return 'testnetAsimov';
  if (/bradbury/i.test(rpcUrl)) return 'testnetBradbury';
  return 'localnet';
}

function parseEvaluationResult(result) {
  if (!result) return {};
  if (typeof result === 'string') return JSON.parse(result);
  return result;
}

function normalizePrivateKey(privateKey) {
  if (!privateKey) return '';
  return privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
}

class GenLayerClient {
  constructor() {
    this.network = config.GENLAYER_NETWORK;
    this.rpcUrl = config.GENLAYER_RPC_URL;
    this.privateKey = config.GENLAYER_PRIVATE_KEY;
    this.contractAddress = config.NOMI_SINGULARITY_CONTRACT_ADDRESS;
    this.client = null;
    this.account = null;
  }

  isConfigured() {
    return !!(this.rpcUrl && this.contractAddress);
  }

  async selectWinner(evaluationId, candidatesPayload) {
    if (!this.isConfigured()) {
      throw new Error('GenLayer is not configured.');
    }
    const txHash = await this._write('select_winner', [evaluationId, candidatesPayload]);
    const result = await this._view('get_evaluation', [evaluationId]);
    const parsed = parseEvaluationResult(result);

    evaluationsRepo.saveEvaluation({
      evaluationId, taskType: 'select_winner',
      month: candidatesPayload.month || '',
      inputSummary: candidatesPayload, result: parsed,
      confidence: parsed.confidence || 0, txHash,
    });
    return parsed;
  }

  async evaluatePost(evaluationId, postPayload) {
    if (!this.isConfigured()) throw new Error('GenLayer is not configured.');
    const txHash = await this._write('evaluate_post', [evaluationId, postPayload]);
    const result = await this._view('get_evaluation', [evaluationId]);
    const parsed = parseEvaluationResult(result);

    evaluationsRepo.saveEvaluation({
      evaluationId, taskType: 'evaluate_post',
      month: postPayload.week ? postPayload.week.substring(0, 7) : '',
      inputSummary: postPayload, result: parsed,
      confidence: parsed.quality_score || 0, txHash,
    });
    return parsed;
  }

  async getEvaluation(evaluationId) {
    if (!this.isConfigured()) return null;
    try {
      const r = await this._view('get_evaluation', [evaluationId]);
      return r ? parseEvaluationResult(r) : null;
    } catch { return null; }
  }

  _getClient() {
    if (this.client) return this.client;

    const chainName = this.network || inferChainName(this.rpcUrl);
    const chain = CHAINS[chainName];
    if (!chain) {
      throw new Error(`Unsupported GenLayer network "${chainName}". Use localnet, studionet, testnetAsimov, or testnetBradbury.`);
    }

    this.account = this.privateKey ? createAccount(normalizePrivateKey(this.privateKey)) : null;
    this.client = createClient({
      chain,
      endpoint: this.rpcUrl,
      ...(this.account ? { account: this.account } : {}),
    });
    return this.client;
  }

  async _write(method, args) {
    if (!this.privateKey) {
      throw new Error('GENLAYER_PRIVATE_KEY is required for GenLayer writeContract calls.');
    }

    const client = this._getClient();
    const txHash = await client.writeContract({
      address: this.contractAddress,
      functionName: method,
      args,
      value: 0n,
    });

    await client.waitForTransactionReceipt({
      hash: txHash,
      status: TransactionStatus.ACCEPTED,
      fullTransaction: false,
    });

    return txHash;
  }

  async _view(method, args) {
    const client = this._getClient();
    return client.readContract({
      address: this.contractAddress,
      functionName: method,
      args,
    });
  }
}

module.exports = new GenLayerClient();
