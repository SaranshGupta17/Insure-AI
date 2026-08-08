import {} from 'react';

export default function Nav({ Id, Name, view, setView, handleLogout, backToTable, role = sessionStorage.getItem('role') }) {
  // 1. Set dynamic styles and text based on the user's role
  const isEmployee = role === 'employee';
  
  const portalTitle = isEmployee ? 'Officer Portal' : 'Customer Portal';
  const themeColor = isEmployee ? 'text-portal-amber' : 'text-portal-teal';
  const hoverColor = isEmployee ? 'group-hover:text-portal-amber-strong' : 'group-hover:text-portal-teal';
  const focusRing = isEmployee ? 'focus:ring-portal-amber' : 'focus:ring-portal-teal';
  const activeText = isEmployee ? 'text-portal-amber-strong' : 'text-portal-teal';

  return (
    <aside className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col justify-between">
      <div>
        <h2 className={`text-xl font-bold ${themeColor}`}>{portalTitle}</h2>
        <p className="text-sm font-mono text-slate-500 mt-1">ID: {Id}</p>
        <p className="text-sm font-mono text-slate-500 mb-8 mt-1">Name: {Name}</p>
        
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
                  onChange={() => setView('chatbot')}
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
                  onChange={() => setView('claim')}
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
                    setView('pending')
                    backToTable()
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
                    setView('approved')
                    backToTable()
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
                    setView('rejected')
                    backToTable()
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
        onClick={handleLogout}
        className="text-sm font-semibold text-slate-500 hover:text-red-500 transition-colors text-left"
      >
        ← Sign Out
      </button>
    </aside>
  );
}