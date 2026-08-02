import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function CustomerDashboard() {
  const backendUrl = import.meta.env.VITE_API_BASE_URL;
  const navigate = useNavigate();

  // PATCH 1: Retrieve customerId from sessionStorage (survives refresh)
  const [customerId] = useState(() => sessionStorage.getItem('identifier'));
  const [customerName] = useState(() => sessionStorage.getItem('name'));

  // PATCH 2: Create a reference to auto-scroll the chat
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!customerId) {
      navigate('/');
    }
  }, [customerId, navigate]);

  const [view, setView] = useState('chatbot');
  const [query, setQuery] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // PATCH 3: Automatically scroll to bottom whenever chatHistory or isLoading changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isLoading]);

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
        // Attach the token to the Headers
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const { answer, source_documents } = response.data;

      setChatHistory((prev) => [
        ...prev,
        {
          role: 'bot',
          content: answer,
          sources: source_documents || []
        }
      ]);
    } catch (error) {
      console.error("Chat API Error:", error);
      setChatHistory((prev) => [
        ...prev,
        { 
          role: 'bot', 
          content: `Error: ${error.response?.data?.detail || error.message || "Unable to connect to the server."}` 
        }
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
      {/* Vertical Navigation Bar */}
      <aside className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col justify-between">
        <div>
          <h2 className="text-xl font-bold text-portal-teal">Customer Portal</h2>
          <p className="text-sm font-mono text-slate-500 mt-1">ID: {customerId}</p>
          <p className="text-sm font-mono text-slate-500 mb-8 mt-1">Name: {customerName}</p>
          
          <div className="flex flex-col space-y-4">
            <label className="flex items-center space-x-3 cursor-pointer group">
              <input 
                type="radio" 
                name="nav" 
                value="chatbot" 
                checked={view === 'chatbot'} 
                onChange={() => setView('chatbot')}
                className="w-4 h-4 text-portal-teal focus:ring-portal-teal"
              />
              <span className="text-slate-700 font-medium group-hover:text-portal-teal transition-colors">AI Assistant</span>
            </label>
            
            <label className="flex items-center space-x-3 cursor-pointer group">
              <input 
                type="radio" 
                name="nav" 
                value="claim" 
                checked={view === 'claim'} 
                onChange={() => setView('claim')}
                className="w-4 h-4 text-portal-teal focus:ring-portal-teal"
              />
              <span className="text-slate-700 font-medium group-hover:text-portal-teal transition-colors">File a Claim</span>
            </label>
          </div>
        </div>

        {/* Logout Button */}
        <button 
          onClick={handleLogout}
          className="text-sm font-semibold text-slate-500 hover:text-red-500 transition-colors text-left"
        >
          ← Sign Out
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col p-8">
        {view === 'chatbot' ? (
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
                    <span className="px-2 py-1 bg-portal-teal/10 text-portal-teal rounded-md border border-portal-teal/20">Try: "What is my vehicle number?"</span>
                    <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100">Try: "How do I file a claim?"</span>
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
                  <span className="text-sm ml-1">Agents are thinking...</span>
                </div>
              )}
              
              {/* Invisible div to scroll into view */}
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
          <div className="flex-1 flex items-center justify-center">
            <h2 className="text-2xl text-slate-500 font-medium">File Claim Form UI goes here.</h2>
          </div>
        )}
      </main>
    </div>
  );
}