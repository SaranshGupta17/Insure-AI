import { useState, useEffect } from 'react';
import axios from 'axios';

export default function ClaimDashboard({ claimId, onBack, setView }) {
  
  const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  const employee_id = sessionStorage.getItem("identifier")

  const [claimData, setClaimData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // States for handling the approval/rejection flow
  const [approvalStatus, setApprovalStatus] = useState("Pending");
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    const fetchClaimDetails = async () => {
      try {
        setIsLoading(true);
        const token = sessionStorage.getItem('token');
        
        // You will need to build this specific route in FastAPI: /api/claims/{claimId}
        const response = await axios.get(`${backendUrl}/review/claims/${claimId}`, {
          headers: { 'Authorization': `Bearer ${token}`, "ngrok-skip-browser-warning": "69420" }
        });

        setClaimData(response.data);
        setError(null);
      } catch (err) {
        console.error("Error fetching claim details:", err);
        setError("Failed to load claim details from the database.");
      } finally {
        setIsLoading(false);
      }
    };

    if (claimId) {
      fetchClaimDetails();
    }
  }, [claimId, backendUrl,approvalStatus]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center h-full min-h-125">
        <svg className="animate-spin h-10 w-10 text-portal-teal mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-slate-500 font-medium">Loading comprehensive claim dossier...</p>
      </div>
    );
  }

  if (error || !claimData) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center h-full min-h-125">
        <div className="text-center text-slate-500">
          <p className="text-lg font-medium text-red-500 mb-2">{error || "Claim not found"}</p>
          <button onClick={onBack} className="text-portal-teal hover:underline">← Return to Dashboard</button>
        </div>
      </div>
    );
  }

  // Updated to receive the optional rejectionReason
  const handleApproval = async (claim_id, newStatus, reason = null) => {
    try {
      // Uncomment and adjust this when your backend route is ready:
      
      const token = sessionStorage.getItem('token');
      const response = await axios.post(
        `${backendUrl}/officer/approvalaction`,
        { 
          claim_id: claim_id, 
          claim_status: newStatus, 
          rejection_reason: reason,
          employee_id:employee_id
        },
        { headers: { 'Authorization': `Bearer ${token}`,"ngrok-skip-browser-warning": "69420" } }
      );
      
      if(response){
        setView(newStatus.toLowerCase() == "forwarded" ? "pending" : newStatus.toLowerCase())
      }
      
      // Update local state to trigger a refresh of the claim data
      setApprovalStatus(newStatus);
      setClaimData(prev => ({...prev, claim_status: newStatus}));
      setIsRejecting(false); 
      setRejectionReason("");
    } catch (e) {
      console.error("Failed to update status", e);
      alert("Failed to update claim status. Please try again.");
    }
  }

  //document renderer using direct URLs
  const renderDocument = (urlData, title) => {

    // If the data is an array ["https://..."], extract the first string
    const url = Array.isArray(urlData) ? urlData[0] : urlData;

    // Safety check: ensure we now have a valid string
    if (!url || typeof url !== 'string') {
      return null;
    }

    console.log(url)
    // We split the URL at the '?' and check the actual path
    const urlWithoutParams = url.split('?')[0].toLowerCase();
    const isPdf = urlWithoutParams.endsWith('.pdf');

    console.log(isPdf)
    return (
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
        <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">{title}</h4>
        
        <div className="flex-1 w-full bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center min-h-62.5 relative group">
          {isPdf ? (
            // 🔥 Fix 2: Use an <object> tag which handles PDFs better than <iframe> for signed URLs
            <object 
              data={url} 
              type="application/pdf" 
              className="w-full h-full min-h-75"
            >
              {/* Fallback if the browser blocks embedding the signed URL */}
              <div className="flex flex-col items-center justify-center p-6 text-center">
                <svg className="w-12 h-12 text-slate-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <p className="text-sm text-slate-500 mb-4">Preview not available.</p>
                <button 
                  onClick={() => window.open(url, '_blank')}
                  className="px-4 py-2 bg-portal-teal text-white text-sm font-bold rounded-lg hover:bg-portal-teal-strong transition-colors"
                >
                  View PDF
                </button>
              </div>
            </object>
          ) : (
            <img src={url} alt={title} className="w-full h-full object-cover max-h-75" loading="lazy" />
          )}
        </div>

        {/* Super simple window.open for URLs */}
        <button 
          onClick={() => window.open(url, '_blank')}
          className="flex items-center justify-center gap-2 w-full mt-3 py-2 bg-portal-teal/10 text-portal-teal hover:bg-portal-teal/20 text-sm font-bold rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          Open in New Tab
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top Navigation / Action Bar */}
      <div className="flex items-center justify-between mb-6">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Requests
        </button>
        
        {/* CONDITIONAL ACTION BAR */}
        {claimData.claim_status === "Pending" ? (
          isRejecting ? (
            /* --- REJECTION INPUT UI --- */
            <div className="flex-1 max-w-2xl bg-white p-3 rounded-xl border border-red-200 shadow-sm flex items-start gap-3 animate-in fade-in slide-in-from-right-4 duration-1000">
              <textarea 
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="State the reason for rejecting this claim (sent to customer)..."
                className="flex-1 p-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 resize-none h-20"
              />
              <div className="flex flex-col gap-2 min-w-28">
                <button 
                  disabled={!rejectionReason.trim()}
                  onClick={() => handleApproval(claimData.claim_id, "Rejected", rejectionReason)}
                  className="px-3 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Confirm Reject
                </button>
                <button 
                  onClick={() => {
                    setIsRejecting(false);
                    setRejectionReason("");
                  }}
                  className="px-3 py-2 bg-slate-100 text-slate-600 text-sm font-bold rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* --- STANDARD ACTION BUTTONS --- */
            <div className="flex gap-3 mt-1">
              <button 
                className="px-4 py-2 bg-red-50 text-red-600 font-semibold rounded-lg border border-red-200 hover:bg-red-100 transition-colors"
                onClick={() => setIsRejecting(true)}
              >
                Reject Claim
              </button>

              {/* Conditional Forward or Approve Button */}
              { claimData.incident_type != "Burglary, Housebreaking, or Theft" ? (
                <button 
                  className="px-4 py-2 bg-emerald-500 text-white font-semibold rounded-lg shadow-sm hover:bg-emerald-600 transition-colors"
                  onClick={() => handleApproval(claimData.claim_id, "Approved", null)}
                >Approve Claim
                </button> 
              ):(
                <button 
                  className="px-4 py-2 bg-emerald-500 text-white font-semibold rounded-lg shadow-sm hover:bg-emerald-600 transition-colors"
                  onClick={() => handleApproval(claimData.claim_id, "Forwarded", null)}
                >Forward Claim
                </button>
              )}
            </div>
          )
        ) : null}
      </div>

      {/* Main Dossier Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex-1 overflow-y-auto overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-800 text-white p-6 border-b border-slate-200 flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-bold font-mono tracking-tight">{claimData.claim_id}</h2>
            <p className="text-slate-400 mt-1 flex items-center gap-2">
              Submitted on: <span className="text-slate-200 font-medium">{claimData.claim_date}</span>
            </p>
          </div>
          
            {
              claimData.claim_status == "Rejected" ? (
              <div className='h-full flex flex-col justify-around items-end'>
                <span className="px-4 py-1.5 bg-red-700 rounded-full text-sm font-bold uppercase tracking-widest border border-slate-600">
                  {claimData.claim_status}
                </span>
                <p className="text-slate-400 mt-1 flex items-center gap-2">
                  {claimData.claim_status} By: <span className="text-slate-200 font-medium">{claimData.employee_id ? claimData.employee_id : claimData.action_by}</span>
                </p>
              </div>
              ): claimData.claim_status == "Approved" ? (
              <div className='h-full flex flex-col justify-between items-end'>
                <span className="px-4 py-1.5 bg-green-600 rounded-full text-sm font-bold uppercase tracking-widest border border-slate-600">
                  {claimData.claim_status}
                </span>
                <p className="text-slate-400 mt-1 flex items-center gap-2">
                  {claimData.claim_status} By: <span className="text-slate-200 font-medium">{claimData.employee_id ? claimData.employee_id : claimData.action_by}</span>
                </p>
              </div>
              ): claimData.claim_status == "Forwarded" ? (
              <div className='h-full flex flex-col justify-between items-end'>
                <span className="px-4 py-1.5 bg-slate-700 rounded-full text-sm font-bold uppercase tracking-widest border border-slate-600">
                  {claimData.claim_status}
                </span>
                <p className="text-slate-400 mt-1 flex items-center gap-2">
                  {claimData.claim_status} By: <span className="text-slate-200 font-medium">{claimData.employee_id ? claimData.employee_id : claimData.action_by}</span>
                </p>
              </div>
              ): (
                <span className="px-4 py-1.5 bg-slate-700 rounded-full text-sm font-bold uppercase tracking-widest border border-slate-600">
                  {claimData.claim_status}
                </span>
              )
            }
            
          
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* LEFT COLUMN */}
          <div className="space-y-8">
            
            {/* 1. Customer Details */}
            <section>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 pb-2 border-b border-slate-200 flex items-center gap-2">
                <svg className="w-4 h-4 text-portal-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                1. Customer Details
              </h3>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-500 text-sm">Customer ID</span>
                  <span className="font-mono font-medium text-slate-800">{claimData.customer_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 text-sm">Name</span>
                  <span className="font-semibold text-slate-800">{claimData.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 text-sm">Policy Number</span>
                  <span className="font-mono font-medium text-portal-teal">{claimData.policy_no}</span>
                </div>
              </div>
            </section>

            {/* 3. Vehicle Details */}
            <section>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 pb-2 border-b border-slate-200 flex items-center gap-2">
                <svg className="w-4 h-4 text-portal-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                3. Vehicle Details
              </h3>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-500 text-sm">Registration No.</span>
                  <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border">{claimData.car_number || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 text-sm">Model</span>
                  <span className="font-medium text-slate-800">{claimData.vehicle_model || 'N/A'}</span>
                </div>
              </div>
            </section>
            
            {/* 5. Incident Details */}
            <section>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 pb-2 border-b border-slate-200 flex items-center gap-2">
                <svg className="w-4 h-4 text-portal-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                5. Incident Details
              </h3>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 text-sm">Date of Incident</span>
                  <span className="font-medium text-slate-800">{claimData.incident_date}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 text-sm">Incident Type</span>
                  <span className="font-medium text-slate-800 capitalize">{claimData.incident_type}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-sm block mb-2">Description provided by customer</span>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 text-sm text-slate-700 leading-relaxed italic wrap-break-word whitespace-pre-wrap">
                    "{claimData.description || 'No description provided.'}"
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN (AI Agent Space) */}
          <div className="h-full">
            
            {/* 2. AI Generated Summary */}
            <section className="h-full flex flex-col">
              <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wider mb-4 pb-2 border-b border-indigo-200 flex items-center gap-2 shrink-0">
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                2. AI Agent Analysis
              </h3>
              
              <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 flex-1">
                
                {/* 2.1 Policy Match Badge */}
                <div className="mb-5 flex items-center justify-between bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                  <span className="text-sm font-semibold text-slate-600">Policy Coverage Status</span>
                  {claimData.summary?.is_covered === true ? (
                     <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold uppercase rounded-lg">Covered Match</span>
                  ) : claimData.summary?.is_covered === false ? (
                     <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold uppercase rounded-lg">Not Covered</span>
                  ) : (
                     <span className="px-3 py-1 bg-slate-200 text-slate-600 text-xs font-bold uppercase rounded-lg">Awaiting Analysis</span>
                  )}
                </div>

                {/* 2.2 AI Message */}
                <div className="mb-5">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">AI Message</h4>
                  <p className="text-slate-700 text-sm leading-relaxed bg-white p-4 rounded-xl border border-indigo-100">
                    {claimData.summary?.message || "The AI agent has not generated an analysis for this claim yet."}
                  </p>
                </div>

                {/* 2.3 Policy References */}
                <div>
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">Policy Book References</h4>
                  <ul className="space-y-2">
                    {claimData.summary?.policy_references?.length > 0 ? (
                      claimData.summary.policy_references.map((ref, idx) => (
                        <li key={idx} className="flex gap-2 text-sm text-slate-600 bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                          <span className="text-indigo-400 mt-0.5">•</span>
                          <span className="font-mono text-xs leading-relaxed">{ref}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-sm text-slate-500 italic">No references cited.</li>
                    )}
                  </ul>
                </div>
                
              </div>
            </section>

          </div>
        </div>

        {/* 6. Documents & Evidence Section*/}
        <div className="p-6 border-t border-slate-200 bg-slate-50">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-6 pb-2 border-b border-slate-200 flex items-center gap-2">
            <svg className="w-5 h-5 text-portal-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
            6. Documents & Evidence
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            
            {/* 1. ALWAYS SHOW RC DOCUMENT */}
            {/* (Assuming you switched to _url from my previous Signed URL fix. If you are still using _byte, just change rc_url to rc_byte, etc.) */}
            {claimData.rc_url && renderDocument(claimData.rc_url, "Registration Certificate (RC)")}
            
            {/* 2. CONDITIONAL RENDERING BASED ON INCIDENT TYPE */}
            {claimData.incident_type === 'Burglary, Housebreaking, or Theft' ? (
              
              /* IF THEFT: Show Legal Documents */
              <>
                {claimData.fir_url && renderDocument(claimData.fir_url, "FIR Document")}
                {claimData.ntr_url && renderDocument(claimData.ntr_url, "Non-Traceable Report (NTR)")}
                {claimData.rto_url && renderDocument(claimData.rto_url, "RTO Document")}
              </>

            ) : (
              
              /* IF NOT THEFT: Show Standard Evidence Files */
              <>
                {claimData.evidence_urls && claimData.evidence_urls.length > 0 && 
                  claimData.evidence_urls.map((evidence_url, index) => (
                    <div key={index}>
                      {renderDocument(evidence_url, `Evidence File ${index + 1}`)}
                    </div>
                  ))
                }
              </>

            )}
          </div>

          {/* Fallback if absolutely no files exist */}
          {!claimData.rc_url && !claimData.fir_url && !claimData.ntr_url && !claimData.rto_url && (!claimData.evidence_urls || claimData.evidence_urls.length === 0) && (
            <div className="text-center p-8 text-slate-500 italic bg-white rounded-xl border border-slate-200">
              No documents were uploaded with this claim.
            </div>
          )}
        </div>            
                    

      </div>
    </div>
  );
}