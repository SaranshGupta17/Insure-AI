// chatbot.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// Import our new components
import Nav from '../Nav';
import FileClaim from './File_claim';

export default function Chatbot() {
  const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  const navigate = useNavigate();

  const [customerId] = useState(() => sessionStorage.getItem('identifier'));
  const [customerName] = useState(() => sessionStorage.getItem('name'));

  const messagesEndRef = useRef(null);
  
   useEffect(() => {
    if (!customerId) {
      navigate('/');
    }
  }, [customerId, navigate]);

  // View state controls whether we show the Chatbot or the Claim Form
  const [view, setView] = useState('chatbot');
  
  // Chat state
  const [query, setQuery] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (view === 'chatbot') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isLoading, view]);

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    const userMessage = { role: 'user', content: query };
    setChatHistory((prev) => [...prev, userMessage]);
    setQuery('');
    setIsLoading(true);

    const token = sessionStorage.getItem('token');
    try {
      const response = await axios.post(`${backendUrl}/chat`, {
        query: userMessage.content,
        customer_id: customerId 
      },{
        headers: { 'Authorization': `Bearer ${token}` }
      });
  
      const { answer, source_documents } = response.data;

      setChatHistory((prev) => [
        ...prev,
        { role: 'bot', content: answer, sources: source_documents || [] }
      ]);
    } catch (error) {
      console.error("Chat API Error:", error);
      setChatHistory((prev) => [
        ...prev,
        { role: 'bot', content: `Error: ${error.response?.data?.detail || error.message}` }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.clear();
    navigate('/');
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen h-screen bg-slate-50 overflow-hidden">
      {/* 1. Navigation Component */}
      <Nav 
        Id={customerId} 
        Name={customerName} 
        view={view} 
        setView={setView} 
        handleLogout={handleLogout} 
      />

      {/* 2. Main Content Area */}
      <main className="flex-1 flex flex-col p-2.5 sm:p-6 md:p-8 overflow-y-auto min-w-0">
        
        {/* Conditional Rendering based on 'view' state */}
        {view === 'chatbot' ? (
          
          /* CHATBOT UI */
          <div className="flex flex-col h-[calc(100dvh-5.5rem)] md:h-full max-w-4xl mx-auto w-full bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Header Badge */}
            <div className="bg-slate-100 px-3.5 sm:px-6 py-2 sm:py-2.5 border-b border-slate-200 flex items-center gap-2 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[11px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider">
                Agents Online
              </span>
            </div>

            {/* Message Area */}
            <div className="flex-1 p-3 sm:p-6 overflow-y-auto bg-slate-50 flex flex-col space-y-3 sm:space-y-6 scroll-smooth">
              {chatHistory.length === 0 ? (
                <div className="text-center text-slate-400 my-auto py-6 sm:py-8 px-2">
                  <p className="text-base sm:text-lg font-medium text-slate-700">Multi-Agent Insurance Assistant</p>
                  <p className="text-xs sm:text-sm mt-1.5 text-slate-500 max-w-md mx-auto">
                    I can check your personal database records, search company policy documents, or just chat!
                  </p>
                  
                  {/* Suggestion Chips */}
                  <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2 text-xs">
                    <span className="text-slate-400 hidden sm:inline">Try:</span>
                    <div className="flex flex-wrap justify-center gap-2">
                      <button
                        type="button"
                        className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors text-left text-xs font-medium cursor-pointer active:scale-95"
                        onClick={(e) => setQuery(e.currentTarget.innerText)}
                      >
                        What is my vehicle number?
                      </button>
                        
                      <button
                        type="button"
                        className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors text-left text-xs font-medium cursor-pointer active:scale-95"
                        onClick={(e) => setQuery(e.currentTarget.innerText)}
                      >
                        How do I file a claim?
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                chatHistory.map((msg, idx) => (
                  <div key={idx} className={`flex flex-col max-w-[90%] sm:max-w-[82%] ${msg.role === 'user' ? 'self-end' : 'self-start'}`}>
                    <div className={`p-3 sm:p-4 text-xs sm:text-sm rounded-2xl break-words leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-portal-teal text-white rounded-tr-sm shadow-sm' 
                        : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'
                    }`}>
                      {msg.content}
                    </div>

                    {msg.role === 'bot' && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2 pl-2.5 border-l-2 border-portal-teal/40">
                        <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Drive Reference Snippets:
                        </p>
                        <div className="flex flex-col gap-1.5">
                          {msg.sources.map((sourceText, sourceIdx) => (
                            <div key={sourceIdx} className="text-[11px] sm:text-xs text-slate-600 bg-portal-teal/5 p-2 rounded-lg border border-portal-teal/10 italic line-clamp-3">
                              "{sourceText}"
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}

              {/* Typing Indicator */}
              {isLoading && (
                <div className="bg-white border border-slate-200 px-3 py-2.5 rounded-2xl rounded-tl-sm self-start flex items-center gap-1.5 shadow-sm">
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Form */}
            <form onSubmit={handleChatSubmit} className="p-2.5 sm:p-4 bg-white border-t border-slate-200 flex gap-2 items-center shrink-0">
              <input 
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask a question..."
                className="flex-1 min-w-0 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-portal-teal transition-shadow disabled:bg-slate-100 placeholder:text-slate-400"
                disabled={isLoading}
              />
              <button 
                type="submit" 
                disabled={isLoading || !query.trim()}
                className="px-4 sm:px-8 py-2.5 sm:py-3 bg-portal-teal text-white font-semibold text-xs sm:text-sm rounded-xl hover:bg-portal-teal-strong transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-portal-teal/20 shrink-0"
              >
                Send
              </button>
            </form>
          </div>

        ) : (
          
          /* FILE CLAIM UI */
          <FileClaim />
          
        )}
      </main>
    </div>
  );
}