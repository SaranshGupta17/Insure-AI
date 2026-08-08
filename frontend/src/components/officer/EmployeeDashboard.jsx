import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';


// Import the specific Nav for the Employee Dashboard
import Nav from '../Nav';
import ClaimDashboard from './ClaimDasboard';

export default function EmployeeDashboard() {
  const backendUrl = import.meta.env.VITE_API_BASE_URL;
  const navigate = useNavigate();

  // 1. Retrieve officer credentials from sessionStorage
  const [employeeId] = useState(() => sessionStorage.getItem('identifier'));
  const [employeeName] = useState(() => sessionStorage.getItem('name') || 'Insurance Officer');
  
  // 2. Protect the route: redirect to login if not authenticated
  useEffect(() => {
    if (!employeeId) {
      navigate('/');
    }
  }, [employeeId, navigate]);

  // 3. View, Search, and Data State
  const [view, setView] = useState('pending'); // 'pending', 'approved', 'rejected'
  const [searchQuery, setSearchQuery] = useState('');
  
  // NEW: State to hold database claims
  const [claims, setClaims] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // State to track which claim is currently being reviewed
  const [selectedClaimId, setSelectedClaimId] = useState(null)
  // useState(() => {
  //   const savedId = sessionStorage.getItem("selectedClaimId");
  //   return savedId === "null" ? null : savedId;
  // });

  // 4. Fetch Claims from Backend on Component Mount
  useEffect(() => {
    const fetchClaims = async () => {
      try {
        setIsLoading(true);

        const token = sessionStorage.getItem('token');

        // Note: You will need to create this GET route in your FastAPI backend later
        const response = await axios.get(`${backendUrl}/api/claims`, {
          headers: { 'Authorization': `Bearer ${token}`,"ngrok-skip-browser-warning": "69420" }
        });
        
        // Assuming the backend returns an array of claims
        setClaims(response.data.claims || response.data);
        setError(null);
      } catch (err) {
        console.error("Error fetching claims:", err);
        setError("Failed to load claims from the database.");
      } finally {
        setIsLoading(false);
      }
    };

    if (employeeId) {
      fetchClaims();
    }
  }, [employeeId, backendUrl,view]);

  const handleLogout = () => {
    sessionStorage.clear();
    navigate('/');
  };

  // 5. Filter the claims based on BOTH the radio button view and the search query
  const displayedClaims = claims.filter(claim => {
    // Safely handle status case matching (e.g., matching 'forwarded' or 'Pending' to 'pending')
    const currentStatus = (claim.claim_status || '').toLowerCase();
    
    // Determine if the claim status matches the current view tab
    let matchesView = false;
    if (view === 'pending' && (currentStatus === 'pending' || currentStatus === 'forwarded' || currentStatus === 'flagged')) {
      matchesView = true;
    } else if (view === 'approved' && currentStatus === 'approved') {
      matchesView = true;
    } else if (view === 'rejected' && currentStatus === 'rejected') {
      matchesView = true;
    }

    // Check if the customer_id includes the search query (case-insensitive)
    const matchesSearch = (claim.customer_id || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesView && matchesSearch;
  });

  // Helper to color-code status badges
  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'pending' || s === 'forwarded' || s === 'flagged') return 'bg-amber-100 text-amber-700 border-amber-200';
    if (s === 'approved') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (s === 'rejected') return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const handleReviewClaim = (claimId) => {
    setSelectedClaimId(claimId); 
    // sessionStorage.setItem("selectedClaimId", claimId); // Save it here
  };

  const handleBackToTable = () => {
    setSelectedClaimId(null); 
    // sessionStorage.removeItem("selectedClaimId"); // Safely remove it instead of saving "null"
  };

  return (
    <div className="flex h-screen bg-slate-50">
      
      {/* 1. Inject the Employee Navigation Component */}
      <Nav 
        Id={employeeId} 
        Name={employeeName} 
        view={view} 
        setView={setView} 
        handleLogout={handleLogout} 
        backToTable = {handleBackToTable}
        // setSelectedClaimId = {setSelectedClaimId}
      />

      {/* 2. Main Content Area */}
      <main className="flex-1 flex flex-col p-8 overflow-y-auto">
        
        {/* Conditional Rendering: Show ClaimDashboard OR the Table */}
        {selectedClaimId ? (
          
          <ClaimDashboard 
            claimId={selectedClaimId} 
            onBack={handleBackToTable} 
            setView = {setView}
          />

        ) : (
          <>
            {/* Header section (Only visible when table is showing) */}
            <header className="mb-6 flex justify-between items-end">
              <div>
                <h1 className="text-3xl font-bold text-slate-800 capitalize">
                  {view} Requests
                </h1>
                <p className="text-slate-500 mt-2">
                  Review and manage {view} claim submissions from customers.
                </p>
              </div>
              
              {/* Search Bar UI */}
              <div className="w-72">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search by Customer ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-portal-teal/50 focus:border-portal-teal text-sm transition-shadow"
                  />
                </div>
              </div>
            </header>

            {/* Dynamic Table UI */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center flex-1 min-h-100">
                  <svg className="animate-spin h-10 w-10 text-portal-teal mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-slate-500 font-medium">Fetching claims from database...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center flex-1 min-h-100">
                  <div className="bg-red-50 text-red-600 p-6 rounded-xl border border-red-200 text-center max-w-md">
                    <svg className="mx-auto h-10 w-10 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="font-bold text-lg mb-1">Connection Error</p>
                    <p className="text-sm">{error}</p>
                    <button 
                      onClick={() => window.location.reload()} 
                      className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                    >
                      Retry Connection
                    </button>
                  </div>
                </div>
              ) : displayedClaims.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 min-h-100">
                  <div className="text-center text-slate-400">
                    <svg className="mx-auto h-12 w-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-lg font-medium">
                      {searchQuery ? `No ${view} requests match "${searchQuery}"` : `No ${view} requests found.`}
                    </p>
                    <p className="text-sm mt-1">{searchQuery ? "Try a different Customer ID." : "You're all caught up!"}</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-sm text-slate-500 uppercase tracking-wider">
                        <th className="px-6 py-4 font-semibold">Claim ID</th>
                        <th className="px-6 py-4 font-semibold">Customer ID</th>
                        <th className="px-6 py-4 font-semibold">Customer Name</th>
                        <th className="px-6 py-4 font-semibold">Policy No.</th>
                        <th className="px-6 py-4 font-semibold">Type</th>
                        <th className="px-6 py-4 font-semibold">Date</th>
                        <th className="px-6 py-4 font-semibold text-center">Status</th>
                        <th className="px-6 py-4 font-semibold text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayedClaims.map((claim) => (
                        <tr key={claim.claim_id} className="hover:bg-slate-50 transition-colors" >
                          <td className="px-6 py-4 font-mono text-sm text-slate-700 font-medium">{claim.claim_id}</td>
                          <td className="px-6 py-4 font-mono text-sm text-portal-teal font-medium">{claim.customer_id}</td>
                          <td className="px-6 py-4 text-sm text-slate-800 font-semibold">{claim.customer_name}</td>
                          <td className="px-6 py-4 font-mono text-sm text-slate-500">{claim.policy_no}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{claim.incident_type}</td>
                          <td className="px-6 py-4 text-sm text-slate-500">{claim.claim_date}</td>
                          
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-block px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full border ${getStatusBadge(claim.claim_status)}`}>
                              {claim.claim_status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button 
                              className="text-sm p-2 font-semibold text-portal-amber hover:bg-slate-100 cursor-pointer border border-slate-200 rounded-md transition-colors shadow-sm"
                              onClick={()=>{handleReviewClaim(claim.claim_id)}}
                            >
                              Review →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}