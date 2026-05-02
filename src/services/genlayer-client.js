const axios = require('axios');
const config = require('../config');
const evaluationsRepo = require('../repositories/evaluations');

class GenLayerClient {
  constructor() {
    this.rpcUrl = config.GENLAYER_RPC_URL;
    this.contractAddress = config.NOMI_SINGULARITY_CONTRACT_ADDRESS;
  }

  isConfigured() {
    return !!(this.rpcUrl && this.contractAddress);
  }

  async selectWinner(evaluationId, candidatesPayload) {
    if (!this.isConfigured()) {
      throw new Error('GenLayer is not configured.');
    }
    const candidatesJson = JSON.stringify(candidatesPayload);
    const txResult = await this._write('select_winner', [evaluationId, candidatesJson]);
    const result = await this._view('get_evaluation', [evaluationId]);
    const parsed = result ? JSON.parse(result) : {};

    evaluationsRepo.saveEvaluation({
      evaluationId, taskType: 'select_winner',
      month: candidatesPayload.month || '',
      inputSummary: candidatesPayload, result: parsed,
      confidence: parsed.confidence || 0, txHash: txResult?.tx_hash || null,
    });
    return parsed;
  }

  async evaluatePost(evaluationId, postPayload) {
    if (!this.isConfigured()) throw new Error('GenLayer is not configured.');
    const postJson = JSON.stringify(postPayload);
    const txResult = await this._write('evaluate_post', [evaluationId, postJson]);
    const result = await this._view('get_evaluation', [evaluationId]);
    const parsed = result ? JSON.parse(result) : {};

    evaluationsRepo.saveEvaluation({
      evaluationId, taskType: 'evaluate_post',
      month: postPayload.week ? postPayload.week.substring(0, 7) : '',
      inputSummary: postPayload, result: parsed,
      confidence: parsed.quality_score || 0, txHash: txResult?.tx_hash || null,
    });
    return parsed;
  }

  async getEvaluation(evaluationId) {
    if (!this.isConfigured()) return null;
    try {
      const r = await this._view('get_evaluation', [evaluationId]);
      return r ? JSON.parse(r) : null;
    } catch { return null; }
  }

  async _write(method, args) {
    const res = await axios.post(this.rpcUrl, {
      jsonrpc: '2.0', method: 'call_contract_function',
      params: { contract_address: this.contractAddress, function_name: method, function_args: args },
      id: Date.now(),
    }, { timeout: 120000 });
    if (res.data?.error) throw new Error(`RPC error: ${JSON.stringify(res.data.error)}`);
    return res.data?.result || {};
  }

  async _view(method, args) {
    const res = await axios.post(this.rpcUrl, {
      jsonrpc: '2.0', method: 'call_contract_view_function',
      params: { contract_address: this.contractAddress, function_name: method, function_args: args },
      id: Date.now(),
    }, { timeout: 30000 });
    if (res.data?.error) throw new Error(`RPC error: ${JSON.stringify(res.data.error)}`);
    return res.data?.result || null;
  }
}

module.exports = new GenLayerClient();
