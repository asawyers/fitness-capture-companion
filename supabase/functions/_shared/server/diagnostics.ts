export type FailurePhase = 'claim' | 'history' | 'agent' | 'schema' | 'validation' | 'apply';
export type FailureDiagnostic = {
  phase: FailurePhase;
  category: 'database' | 'provider' | 'timeout' | 'refusal' | 'schema' | 'validation' | 'unknown';
  providerCode?: string;
  status?: number;
};
// Copy known protocol identifiers only, never arbitrary error text or values.
const safeCodes = new Set(['invalid_json_schema','invalid_request_error','invalid_api_key','insufficient_quota','rate_limit_exceeded','model_not_found','context_length_exceeded','unsupported_parameter','unsupported_value','invalid_value','server_error','content_policy_violation','40001','PT409','23514','23503','23505','42501','22023','PGRST202']);
export function failureDiagnostic(phase: FailurePhase, error: unknown): FailureDiagnostic {
  const value = typeof error === 'object' && error !== null ? error as Record<string,unknown> : {};
  const status = typeof value.status === 'number' && Number.isInteger(value.status) && value.status >= 400 && value.status <= 599 ? value.status : undefined;
  const providerCode = typeof value.code === 'string' && safeCodes.has(value.code) ? value.code : undefined;
  const category = phase === 'claim' || phase === 'history' || phase === 'apply' ? 'database'
    : phase === 'schema' || phase === 'validation' ? phase
    : ['TimeoutError','AbortError','APIConnectionTimeoutError','ModelTimeoutError'].includes(String(value.name)) ? 'timeout'
    : value.name === 'ModelRefusalError' ? 'refusal'
    : status !== undefined || providerCode !== undefined ? 'provider' : 'unknown';
  return {phase,category,...(providerCode ? {providerCode} : {}),...(status !== undefined ? {status} : {})};
}
