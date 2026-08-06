import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Import the specific Nav for the Employee Dashboard
import Nav from './nav';

// --- MOCK DATA (We will replace this with a real Axios call to FastAPI later) ---
const mockClaims = [
  { id: 'CLM-1001', customerName: 'Alice Smith', policy: 'POL-12345', type: 'Vehicle Accident', date: '2023-10-12', status: 'pending' },
  { id: 'CLM-1002', customerName: 'Bob Johnson', policy: 'POL-67890', type: 'Property Damage', date: '2023-10-10', status: 'approved' },
  { id: 'CLM-1003', customerName: 'Charlie Davis', policy: 'POL-11223', type: 'Vehicle Theft', date: '2023-10-14', status: 'pending' },
  { id: 'CLM-1004', customerName: 'Diana Prince', policy: 'POL-44556', type: 'Medical', date: '2023-09-28', status: 'rejected' },
  { id: 'CLM-1005', customerName: 'Evan Wright', policy: 'POL-99887', type: 'Vehicle Accident', date: '2023-10-15', status: 'pending' },
];

export default function EmployeeDashboard() {
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

  // 3. View state controls which list we are looking at (default to 'pending')
  const [view, setView] = useState('pending');

  const handleLogout = () => {
    sessionStorage.clear();
    navigate('/');
  };

  // Filter the claims based on the selected radio button view
  const displayedClaims = mockClaims.filter(claim => claim.status === view);

  // Helper to color-code status badges
  const getStatusBadge = (status) => {
    if (status === 'pending') return 'bg-amber-100 text-amber-700 border-amber-200';
    if (status === 'approved') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status === 'rejected') return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
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
      />

      {/* 2. Main Content Area */}
      <main className="flex-1 flex flex-col p-8 overflow-y-auto">
        
        {/* Header section similar to the Customer Dashboard */}
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800 capitalize">
            {view} Requests
          </h1>
          <p className="text-slate-500 mt-2">
            Review and manage {view} claim submissions from customers.
          </p>
        </header>

        {/* Dynamic Table UI */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1">
          
          {displayedClaims.length === 0 ? (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <div className="text-center text-slate-400">
                <p className="text-lg font-medium">No {view} requests found.</p>
                <p className="text-sm mt-2">You're all caught up!</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-sm text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4 font-semibold">Claim ID</th>
                    <th className="px-6 py-4 font-semibold">Customer</th>
                    <th className="px-6 py-4 font-semibold">Policy No.</th>
                    <th className="px-6 py-4 font-semibold">Type</th>
                    <th className="px-6 py-4 font-semibold">Date</th>
                    <th className="px-6 py-4 font-semibold text-center">Status</th>
                    <th className="px-6 py-4 font-semibold text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedClaims.map((claim) => (
                    <tr key={claim.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-mono text-sm text-slate-700 font-medium">{claim.id}</td>
                      <td className="px-6 py-4 text-sm text-slate-800 font-semibold">{claim.customerName}</td>
                      <td className="px-6 py-4 font-mono text-sm text-slate-500">{claim.policy}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{claim.type}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{claim.date}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-block px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full border ${getStatusBadge(claim.status)}`}>
                          {claim.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button className="text-sm font-semibold text-portal-amber hover:text-portal-amber-strong transition-colors">
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
      </main>
    </div>
  );
}