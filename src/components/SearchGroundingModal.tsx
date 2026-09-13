import React, { useState } from 'react';
import { Globe, Search, Loader2, ExternalLink, Sparkles, BookOpen, AlertCircle, X, ShieldCheck } from 'lucide-react';
import { querySearchGrounding, SearchGroundingResponse } from '../lib/searchGrounding';

interface SearchGroundingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SearchGroundingModal: React.FC<SearchGroundingModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState<'paper_rates' | 'compliance' | 'machinery' | 'general'>('paper_rates');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<SearchGroundingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (overrideQuery?: string) => {
    const q = overrideQuery || query;
    if (!q.trim()) return;

    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const data = await querySearchGrounding(q, topic);
      setResponse(data);
    } catch (err: any) {
      console.error('Search grounding error:', err);
      setError(err.message || 'Failed to search online intelligence.');
    } finally {
      setIsLoading(false);
    }
  };

  const presetQueries = [
    {
      topic: 'paper_rates' as const,
      text: 'Current Virgin Kraft & Cupstock Paper Board price per MT (ITC, Century, JK)'
    },
    {
      topic: 'compliance' as const,
      text: 'FSSAI & BIS standards for biodegradable paper cutlery & tableware migration limits'
    },
    {
      topic: 'machinery' as const,
      text: 'Optimal heater temperature and pressure for paper spoon hydraulic thermoforming dies'
    },
    {
      topic: 'paper_rates' as const,
      text: 'Raw paper reel GSM thickness comparison for export grade cutlery (240 vs 280 vs 320 GSM)'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-rose-600 p-1 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
          <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#1a365d] m-0">Paper Industry Grounded Intelligence</h3>
              <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-2 py-0.5 rounded">
                gemini-3.5-flash + Google Search
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live Google Search Grounding for raw paper prices, GSM norms, cutlery compliance & maintenance
            </p>
          </div>
        </div>

        {/* Topic Selector Tabs */}
        <div className="flex flex-wrap gap-1.5 mb-3.5">
          {[
            { id: 'paper_rates', label: '📊 Paper Rates & Mills' },
            { id: 'compliance', label: '📜 Food Safety & Compliance' },
            { id: 'machinery', label: '⚙️ Tooling & Machines' },
            { id: 'general', label: '🌐 General Search' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTopic(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                topic === tab.id
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input Box */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search live paper rates, mill prices, GSM standards, or machine troubleshooting..."
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={isLoading || !query.trim()}
            className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer flex-shrink-0"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>Search Live</span>
          </button>
        </div>

        {/* Suggested Queries */}
        <div className="mb-5">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
            Quick Research Queries:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {presetQueries.map((pq, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setTopic(pq.topic);
                  setQuery(pq.text);
                  handleSearch(pq.text);
                }}
                className="text-left text-xs bg-slate-50 hover:bg-teal-50 hover:border-teal-200 border border-slate-200 p-2 rounded-lg text-slate-700 transition cursor-pointer flex items-start gap-1.5"
              >
                <span className="text-teal-600 font-bold">›</span>
                <span className="line-clamp-1">{pq.text}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Loading Spinner */}
        {isLoading && (
          <div className="py-10 text-center text-teal-800">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-teal-600" />
            <div className="text-xs font-bold">Querying Google Search Grounding with Gemini 3.5 Flash...</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Synthesizing live web intelligence and citations</div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg mb-4 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Search Grounded Result */}
        {response && (
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-teal-800 mb-2 uppercase tracking-wide">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                <span>Grounded Live Intelligence Summary:</span>
              </div>
              <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                {response.result}
              </div>
            </div>

            {/* Citations & Sources */}
            {response.groundingMetadata?.groundingChunks &&
              response.groundingMetadata.groundingChunks.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-3.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2 uppercase">
                    <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                    <span>Grounding Citations & Sources:</span>
                  </div>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {response.groundingMetadata.groundingChunks.map((chunk, idx) => {
                      const web = chunk.web;
                      if (!web) return null;
                      return (
                        <a
                          key={idx}
                          href={web.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between text-xs text-blue-700 hover:text-blue-900 bg-blue-50/60 p-2 rounded-lg transition"
                        >
                          <span className="truncate mr-2 font-medium">{web.title || web.uri}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
};
