import { GroundingMetadata } from '../types';

export interface SearchGroundingResponse {
  success: boolean;
  result: string;
  groundingMetadata?: GroundingMetadata;
  error?: string;
}

export async function querySearchGrounding(
  query: string,
  topic: 'paper_rates' | 'compliance' | 'machinery' | 'general' = 'general'
): Promise<SearchGroundingResponse> {
  const response = await fetch('/api/ai/search-grounding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, topic })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Search failed' }));
    throw new Error(errorData.error || `Search query failed with status ${response.status}`);
  }

  return response.json();
}
