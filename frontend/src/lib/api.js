const API_BASE = '/api';
export async function fetchAPI(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, { headers: { 'Content-Type': 'application/json', ...options.headers }, ...options });
  if (!response.ok) throw new Error(`API Error: ${response.status}`);
  return response.json();
}
export const api = {
  getCases: () => fetchAPI('/cases/'),
  getCase: (id) => fetchAPI(`/cases/${id}`),
  analyzeAutopsy: (id) => fetchAPI(`/analysis/autopsy/${id}`),
  estimateTOD: (id) => fetchAPI(`/analysis/tod/${id}`),
  getExplainability: (id) => fetchAPI(`/analysis/explainability/${id}`),
  getTimeline: (id) => fetchAPI(`/timeline/${id}`),
  getGraph: (id) => fetchAPI(`/graph/${id}`),
  getRisk: (id) => fetchAPI(`/risk/${id}`),
  query: (question, caseId) => fetchAPI('/query/', { method: 'POST', body: JSON.stringify({ question, case_id: caseId }) }),
  getQuerySuggestions: () => fetchAPI('/query/suggestions'),
  getAgentsStatus: () => fetchAPI('/agents/status'),
  runAgentAnalysis: (id) => fetchAPI(`/agents/analysis/${id}`),
  getChainOfCustody: (id) => fetchAPI(`/custody/${id}`),
  getHealth: () => fetchAPI('/health'),
  getStats: () => fetchAPI('/stats'),
};
