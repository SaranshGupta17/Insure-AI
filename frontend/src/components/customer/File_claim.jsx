import { useState, useEffect } from 'react';
import axios from 'axios';

export default function FileClaim() {

   const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
   const [customerId] = useState(() => sessionStorage.getItem('identifier'));

  // Form State
  const [policyNumber, setPolicyNumber] = useState('');
  const [incidentDate, setIncidentDate] = useState('');
  const [rcDocument, setRcDocument] = useState(null);
  
  // Incident Details State
  const [incidentType, setIncidentType] = useState('accident');
  const [customIncidentType, setCustomIncidentType] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState(null);
  
  // NEW: Splitting Burglary, Housebreaking, or Theft Specific State into 3 distinct files
  const [firDoc, setFirDoc] = useState(null);
  const [ntrDoc, setNtrDoc] = useState(null);
  const [rtoDoc, setRtoDoc] = useState(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Toast Notification State
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast({ show: false, message: '', type: '' });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  const showToast = (message, type) => {
    setToast({ show: true, message, type });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setToast({ show: false, message: '', type: '' });

    // 1. Create a FormData object to handle files and text
    const formData = new FormData();
    formData.append('customer_id', customerId);
    formData.append('policy_no', policyNumber); // Matched backend name
    formData.append('incident_date', incidentDate);
    formData.append('incident_type', incidentType);
    
    if (rcDocument) formData.append('rc_document', rcDocument);

    // 2. Append conditional fields based on incident type
    if (incidentType === 'Burglary, Housebreaking, or Theft') {
      if (firDoc) formData.append('fir_document', firDoc);
      if (ntrDoc) formData.append('ntr_document', ntrDoc);
      if (rtoDoc) formData.append('rto_document', rtoDoc);
    } else {
      if (customIncidentType) formData.append('custom_incident_type', customIncidentType);
      if (description) formData.append('description', description);
      
      // Handle multiple evidence files
      if (evidenceFiles) {
        Array.from(evidenceFiles).forEach(file => {
          formData.append('evidence_files', file);
        });
      }
    }

    const token = sessionStorage.getItem('token');

    try {
      console.log("Submitting claim...");
      // 3. Send as multipart/form-data
      const response = await axios.post(`${backendUrl}/file_claim`, formData, {
        headers: {'Authorization': `Bearer ${token}` , 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        showToast("Claim successfully submitted!", "success");
        // Optional: Reset form state here
        setPolicyNumber('');
        setIncidentDate('');
        setRcDocument(null);
        setIncidentType('accident');
        setCustomIncidentType('');
        setDescription('');
        setEvidenceFiles(null);
        setFirDoc(null);
        setNtrDoc(null);
        setRtoDoc(null);
        // Reset file inputs visually by finding them in the DOM
        document.querySelectorAll('input[type="file"]').forEach(input => input.value = '');
      } 
      else {
        showToast(response.data.error || "Submission failed", "error");
      }
    } 
    catch (error) {
      console.error(error);
      showToast(error.response?.data?.detail || "An error occurred while uploading.", "error");
    } 
    finally {
      setIsSubmitting(false);
    }
  };

  // Helper class for styling file inputs
  const fileInputStyles = "w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-portal-teal/10 file:text-portal-teal hover:file:bg-portal-teal/20 transition-colors cursor-pointer border border-slate-300 rounded-xl px-2 py-2 bg-white";

  return (

    <div className="relative">
      {/* TOAST NOTIFICATION (Fixed to top-right of viewport) */}
      <div 
        className={`fixed top-6 right-6 z-50 transform transition-all duration-300 ease-in-out ${
          toast.show ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
        }`}
      >
        {toast.show && (
          <div className={`px-6 py-4 rounded-xl shadow-lg border font-semibold flex items-center gap-3 min-w-75 ${
            toast.type === 'success' 
              ? 'bg-white border-green-200 text-green-700' 
              : 'bg-white border-red-200 text-red-700'
          }`}>
            {/* Simple icon based on type */}
            {toast.type === 'success' ? (
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {toast.message}
          </div>
        )}
      </div>

      <div className="max-w-3xl mx-auto w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mt-4 overflow-y-auto max-h-[85vh]">
        <div className="border-b border-slate-200 pb-5 mb-6">
          <h2 className="text-2xl font-bold text-slate-800">File a New Claim</h2>
          <p className="text-slate-500 mt-1">All fields are mandatory to process your request.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* BASIC DETAILS */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Policy Number <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                placeholder="e.g. POL-12345"
                value={policyNumber}
                onChange={(e) => setPolicyNumber(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-portal-teal"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Incident Date <span className="text-red-500">*</span></label>
              <input 
                type="date" 
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-portal-teal text-slate-700"
                required
              />
            </div>
          </div>

          {/* 1. RC UPLOAD */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wide">1. Vehicle Documents</h3>
            <label className="block text-sm font-semibold text-slate-700 mb-2">RC (Registration Certificate) Upload <span className="text-red-500">*</span></label>
            <input 
              type="file" 
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setRcDocument(e.target.files[0])}
              className={fileInputStyles}
              required
            />
          </div>

          {/* 2. INCIDENT DETAILS */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-5">
            <h3 className="text-sm font-bold text-slate-800 mb-1 uppercase tracking-wide">2. Incident Details</h3>
            
            {/* 2.1 INCIDENT TYPE */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Incident Type <span className="text-red-500">*</span>
              </label>
              <select 
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-portal-teal bg-white font-medium text-slate-700"
                required
              >
                <option value="accidental_external">Accidental External Means</option>
                <option value="Burglary, Housebreaking, or Theft">Burglary, Housebreaking, or Theft</option>
                <option value="Fire, Explosion, Self Ignition, or Lightning">Fire, Explosion, Self Ignition, or Lightning</option>
                <option value="Riot or Strike">Riot and Strike</option>
                <option value="Earthquake (Fire & Shock Damage)">Earthquake (Fire & Shock Damage)</option>
                <option value="Flood, Typhoon, Hurricane, Storm, Tempest, Inundation, Cyclone, Hailstorm, Frost">Flood, Typhoon, Hurricane, Storm, Tempest, Inundation, Cyclone, Hailstorm, Frost</option>
                <option value="malicious_act">Malicious Act</option>
                <option value="terrorist_activity">Terrorist Activity</option>
                <option value="transit">Transit (by Road, Rail, Inland-Waterway, Lift, Elevator, or Air)</option>
                <option value="landslide_rockslide">Landslide or Rockslide</option>
                <option value="other">Other</option>
              </select>
            </div>

          {/* 2.1.1 CUSTOM INCIDENT TYPE (Shows only if 'other' is selected) */}
          {incidentType === 'other' && (
            <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Please Specify Incident Type <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                placeholder="e.g., Tree fell on parked car"
                value={customIncidentType}
                onChange={(e) => setCustomIncidentType(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-portal-teal text-slate-700 bg-white"
                required={incidentType === 'other'}
              />
            </div>
          )}

            {/* CONDITIONAL RENDERING */}
            {incidentType === 'Burglary, Housebreaking, or Theft' ? (
              
              /* 3. Burglary, Housebreaking, or Theft SPECIFIC FIELDS (SPLIT INTO 3) */
              <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-300 space-y-5">
                <div className="bg-portal-amber/10 border border-portal-amber/30 rounded-xl p-4 mb-4">
                  <p className="text-sm text-portal-amber-strong font-medium">
                    <strong>Burglary, Housebreaking, or Theft Protocol:</strong> You must provide all three legal documents to process a vehicle Burglary, Housebreaking, or Theft claim.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    3.1 FIR (First Information Report) <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="file" 
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setFirDoc(e.target.files[0])}
                    className={fileInputStyles}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    3.2 NTR (Non-Traceable Report) <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="file" 
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setNtrDoc(e.target.files[0])}
                    className={fileInputStyles}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    3.3 RTO Documents <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="file" 
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setRtoDoc(e.target.files[0])}
                    className={fileInputStyles}
                    required
                  />
                </div>
              </div>

            ) : (
              
              /* 2.2 & 2.3 STANDARD INCIDENT FIELDS */
              <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">2.2 Incident Description <span className="text-red-500">*</span></label>
                  <textarea 
                    rows="4"
                    placeholder="Please describe exactly what happened..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-portal-teal resize-none bg-white"
                    required
                  ></textarea>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">2.3 Evidence Photos or Videos <span className="text-red-500">*</span></label>
                  <input 
                    type="file" 
                    multiple
                    accept="image/*,video/*"
                    onChange={(e) => setEvidenceFiles(e.target.files)}
                    className={fileInputStyles}
                    required
                  />
                </div>
              </div>
            )}
          </div>

          {/* SUBMIT */}
          <div className="pt-4">
            <button 
              type="submit" 
              onSubmit={handleSubmit}
              className="w-full py-4 bg-portal-teal text-white font-extrabold rounded-xl hover:bg-portal-teal-strong transition-colors shadow-md shadow-portal-teal/20 text-lg"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Submitting Request...
                </span>
              ) : 'Submit Claim Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}