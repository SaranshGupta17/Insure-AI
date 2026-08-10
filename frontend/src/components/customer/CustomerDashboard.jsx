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
  const [customerName] = useState(() => sessionStorage.getItem('name') );

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
    <div className="flex h-screen bg-slate-50">
      {/* 1. Inject the Navigation Component */}
      <Nav 
        Id={customerId} 
        Name={customerName} 
        view={view} 
        setView={setView} 
        handleLogout={handleLogout} 
      />

      {/* 2. Main Content Area */}
      <main className="flex-1 flex flex-col p-8">
        
        {/* Conditional Rendering based on the 'view' state */}
        {view === 'chatbot' ? (
          
          /* CHATBOT UI */
          <div className="flex flex-col h-full max-w-4xl mx-auto w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-100 px-6 py-2 border-b border-slate-200 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Agents Online
              </span>
            </div>

            <div className="flex-1 p-6 overflow-y-auto bg-slate-50 flex flex-col space-y-6 scroll-smooth">
              {chatHistory.length === 0 ? (
                <div className="text-center text-slate-400 mt-10">
                  <p className="text-lg font-medium">Multi-Agent Insurance Assistant</p>
                  <p className="text-sm mt-2">I can check your personal database records, search company policy documents, or just chat!</p>
                  <div className="mt-4 flex justify-center gap-2 text-xs">
                    <span className="px-2 py-1 text-portal-teal">Try: "</span>
                    <span 
                      className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100"
                      onClick={(e) => {
                        setQuery(e.target.innerText)
                        
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.cursor = 'pointer'
                        
                      }}
                    >What is my vehicle number?</span>
                      
                    <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100"
                      onClick={(e) => {
                        setQuery(e.target.innerText)
                        
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.cursor = 'pointer'
                      }}
                    >How do I file a claim?</span>

                  </div>
                </div>
              ) : (
                chatHistory.map((msg, idx) => (
                  <div key={idx} className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'self-end' : 'self-start'}`}>
                    <div className={`p-4 rounded-2xl ${msg.role === 'user' ? 'bg-portal-teal text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'}`}>
                      {msg.content}
                    </div>

                    {msg.role === 'bot' && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2 pl-2 border-l-2 border-portal-teal/30">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Drive Reference Snippets:</p>
                        <div className="flex flex-col gap-2">
                          {msg.sources.map((sourceText, sourceIdx) => (
                            <div key={sourceIdx} className="text-xs text-slate-600 bg-portal-teal/5 p-2 rounded border border-portal-teal/10 italic line-clamp-3">
                              "{sourceText}"
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
              {isLoading && (
                <div className="text-slate-500 self-start ml-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleChatSubmit} className="p-4 bg-white border-t border-slate-200 flex gap-4 items-center">
              <input 
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask a question..."
                className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-portal-teal transition-shadow disabled:bg-slate-100"
                disabled={isLoading}
              />
              <button 
                type="submit" 
                disabled={isLoading}
                className="px-8 py-3 bg-portal-teal text-white font-semibold rounded-xl hover:bg-portal-teal-strong transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-portal-teal/20"
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
