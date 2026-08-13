import { useState } from 'react';

export default function Nav({ Id, Name, view, setView, handleLogout, backToTable, role = sessionStorage.getItem('role') }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // 1. Set dynamic styles and text based on the user's role
  const isEmployee = role === 'employee';
  
  const portalTitle = isEmployee ? 'Officer Portal' : 'Customer Portal';
  const themeColor = isEmployee ? 'text-portal-amber' : 'text-portal-teal';
  const hoverColor = isEmployee ? 'group-hover:text-portal-amber-strong' : 'group-hover:text-portal-teal';
  const focusRing = isEmployee ? 'focus:ring-portal-amber' : 'focus:ring-portal-teal';
  const activeText = isEmployee ? 'text-portal-amber-strong' : 'text-portal-teal';
  return (
    <>
      {/* 1. MOBILE & TABLET TOP HEADER BAR */}
      <div className="md:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center z-30 shrink-0">
        <div>
          <h2 className={`text-lg font-bold ${themeColor}`}>{portalTitle}</h2>
          <p className="text-xs font-mono text-slate-500">ID: {Id}</p>
        </div>
        <button 
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 text-slate-700 hover:text-slate-900 rounded-lg border border-slate-200 focus:outline-none"
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* 2. RESPONSIVE SIDEBAR / MOBILE DRAWER */}
      <aside 
        className={`
          fixed md:static inset-y-0 left-0 z-40
          w-64 bg-white border-r border-slate-200 p-6 
          flex flex-col justify-between overflow-y-auto
          transform transition-transform duration-200 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          shadow-xl md:shadow-none shrink-0
        `}
      >
        <div>
          {/* Header information for desktop view */}
          <div className="hidden md:block">
            <h2 className={`text-xl font-bold ${themeColor}`}>{portalTitle}</h2>
            <p className="text-sm font-mono text-slate-500 mt-1">ID: {Id}</p>
            <p className="text-sm font-mono text-slate-500 mb-8 mt-1">Name: {Name}</p>
          </div>

          {/* User Name display for mobile drawer */}
          <div className="md:hidden mb-6 pb-4 border-b border-slate-100">
            <p className="text-xs font-mono text-slate-500">Name: {Name}</p>
          </div>
          
          <div className="flex flex-col space-y-4">
            
            {/* --- CUSTOMER MENU OPTIONS --- */}
            {!isEmployee && (
              <>
                <label className="flex items-center space-x-3 cursor-pointer group">
                  <input 
                    type="radio" 
                    name="nav" 
                    value="chatbot" 
                    checked={view === 'chatbot'} 
                    onChange={() => {
                      setView('chatbot');
                      setMobileOpen(false);
                    }}
                    className={`w-4 h-4 ${themeColor} ${focusRing}`}
                  />
                  <span className={`font-medium transition-colors ${view === 'chatbot' ? activeText : `text-slate-700 ${hoverColor}`}`}>
                    AI Assistant
                  </span>
                </label>
                
                <label className="flex items-center space-x-3 cursor-pointer group">
                  <input 
                    type="radio" 
                    name="nav" 
                    value="claim" 
                    checked={view === 'claim'} 
                    onChange={() => {
                      setView('claim');
                      setMobileOpen(false);
                    }}
                    className={`w-4 h-4 ${themeColor} ${focusRing}`}
                  />
                  <span className={`font-medium transition-colors ${view === 'claim' ? activeText : `text-slate-700 ${hoverColor}`}`}>
                    File a Claim
                  </span>
                </label>
              </>
            )}

            {/* --- EMPLOYEE MENU OPTIONS --- */}
            {isEmployee && (
              <>
                <label className="flex items-center space-x-3 cursor-pointer group">
                  <input 
                    type="radio" 
                    name="nav" 
                    value="pending" 
                    checked={view === 'pending'} 
                    onChange={() => {
                      setView('pending');
                      if (backToTable) backToTable();
                      setMobileOpen(false);
                    }}
                    className={`w-4 h-4 ${themeColor} ${focusRing}`}
                  />
                  <span className={`font-medium transition-colors ${view === 'pending' ? activeText : `text-slate-700 ${hoverColor}`}`}>
                    Pending Requests
                  </span>
                </label>
                
                <label className="flex items-center space-x-3 cursor-pointer group">
                  <input 
                    type="radio" 
                    name="nav" 
                    value="approved" 
                    checked={view === 'approved'} 
                    onChange={() => {
                      setView('approved');
                      if (backToTable) backToTable();
                      setMobileOpen(false);
                    }}
                    className={`w-4 h-4 ${themeColor} ${focusRing}`}
                  />
                  <span className={`font-medium transition-colors ${view === 'approved' ? activeText : `text-slate-700 ${hoverColor}`}`}>
                    Approved Requests
                  </span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer group">
                  <input 
                    type="radio" 
                    name="nav" 
                    value="rejected" 
                    checked={view === 'rejected'} 
                    onChange={() => {
                      setView('rejected');
                      if (backToTable) backToTable();
                      setMobileOpen(false);
                    }}
                    className={`w-4 h-4 ${themeColor} ${focusRing}`}
                  />
                  <span className={`font-medium transition-colors ${view === 'rejected' ? activeText : `text-slate-700 ${hoverColor}`}`}>
                    Rejected Requests
                  </span>
                </label>
              </>
            )}

          </div>
        </div>

        <button 
          onClick={() => {
            setMobileOpen(false);
            handleLogout();
          }}
          className="text-sm font-semibold text-slate-500 hover:text-red-500 transition-colors text-left pt-6 mt-6 border-t border-slate-100"
        >
          ← Sign Out
        </button>
      </aside>

      {/* 3. MOBILE BACKDROP OVERLAY */}
      {mobileOpen && (
        <div 
          onClick={() => setMobileOpen(false)} 
          className="fixed inset-0 bg-slate-900/40 z-30 md:hidden"
          aria-hidden="true"
        />
      )}
    </>
  );
}