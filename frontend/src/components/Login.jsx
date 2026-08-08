import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const roles = [
  {
    value: 'customer',
    label: 'Customer',
    description: 'Review policies, claims, and support for your account.'
  },
  {
    value: 'employee',
    label: 'Insurance employee',
    description: 'Open the operations workspace for assisted service.'
  }
];

const normalizeId = (value) => value.toUpperCase().replace(/\s+/g, '');

const validateCustomerId = (value) => {
  const normalizedValue = normalizeId(value);
  if (!normalizedValue) return 'Enter your Customer ID to continue.';
  if (!/^CUST-\d{4}$/.test(normalizedValue)) return 'Use the format CUST-1001.';
  return '';
};

const validateemployeeId = (value) => {
  const normalizedValue = normalizeId(value);
  if (!normalizedValue) return 'Enter your Employee ID to continue.';
  if (!/^EMP\d{4}$/.test(normalizedValue)) return 'Use the format EMP1001.';
  return '';
};

const Login = () => {
  const [role, setRole] = useState('customer');
  
  const [customerId, setCustomerId] = useState('');
  const [customerIdError, setCustomerIdError] = useState('');

  const [employeeId, setemployeeId] = useState('');
  const [employeeIdError, setemployeeIdError] = useState('');

  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleRoleChange = (nextRole) => {
    setRole(nextRole);
    setCustomerIdError('');
    setemployeeIdError('');
    setPinError('');
    setFormError('');
  };

  const handleCustomerIdChange = (event) => {
    const nextCustomerId = normalizeId(event.target.value);
    setCustomerId(nextCustomerId);
    if (customerIdError) {
      setCustomerIdError(validateCustomerId(nextCustomerId));
    }
  };

  const handleemployeeIdChange = (event) => {
    const nextId = normalizeId(event.target.value);
    setemployeeId(nextId);
    if (employeeIdError) setemployeeIdError(validateemployeeId(nextId));
  };

  const handleLogin = async (event) => { // <-- Note the 'async' keyword!
    event.preventDefault();
    setFormError('');
    setPinError('');
    if (!pin.trim()) {
        setPinError('Please enter your PIN.');
    }
    else if (!/^\d{3,4}$/.test(pin)) {
      setPinError('PIN must be exactly 3 or 4 digits.');
      return;
    }

    if (role === 'customer') {
      const validationError = validateCustomerId(customerId);
      setCustomerIdError(validationError);

     if (validationError || !pin.trim()) return;
    }else {
      const validationError = validateemployeeId(employeeId);
      setemployeeIdError(validationError);
      if (validationError) return;
    }
    try {
      setIsSubmitting(true);

      // 1. Prepare the data to send to FastAPI
      const payload = {
        role: role,
        identifier: role === 'customer' ? normalizeId(customerId) : normalizeId(employeeId),
        pin: pin
      };

      // 2. Call the FastAPI backend!
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, payload);

      // 3. If successful, save the REAL cryptographic token to sessionStorage
      sessionStorage.setItem('token', response.data.token);
      sessionStorage.setItem('role', response.data.role);
      sessionStorage.setItem('identifier', response.data.identifier);
      sessionStorage.setItem('name', response.data.name);
      // if(role === "employee"){
      //   sessionStorage.setItem("selectedClaimId",null);
      // }

      // 4. Route to the correct dashboard
      if (role === 'customer') {
        navigate('/customer');
      } else {
        navigate('/employee');
      }
    } catch (error) {
      console.error('Login Error:', error);
      // Display the actual error message from FastAPI (e.g., "Invalid Customer ID")
      setFormError(
        error.response?.data?.detail || 'Cannot connect to server. Is server running?'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitLabel = role === 'customer'
    ? 'Continue to customer dashboard'
    : 'Continue to employee dashboard';

  return (
    <main className="relative min-h-screen overflow-hidden bg-portal-paper text-portal-ink selection:bg-portal-teal/15">
      <div className="relative mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 gap-10 px-6 py-8 sm:px-10 lg:grid-cols-[1.06fr_0.94fr] lg:items-center lg:gap-20 lg:px-14 lg:py-10">
        <section className="flex flex-col justify-between lg:min-h-155" aria-labelledby="portal-title">
          <header className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-portal-ink text-sm font-extrabold tracking-tight text-white shadow-portal-mark">
                IP
              </div>
              <div>
                <p className="text-sm font-extrabold tracking-tight text-portal-ink">Insurance Portal</p>
                <p className="text-xs font-medium text-portal-muted">Secure access for every policy journey</p>
              </div>
            </div>
          </header>

          <div className="max-w-xl py-10 lg:py-0">
            <h1 id="portal-title" className="max-w-lg text-4xl font-extrabold leading-[1.08] tracking-[-0.04em] text-portal-ink sm:text-5xl">
              Your coverage, clearly within reach.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-portal-muted sm:text-lg">
              Choose the access that matches your role. We will take you directly to the workspace you need.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:max-w-lg">
              <div className="border-l-2 border-portal-teal pl-4">
                <p className="text-sm font-extrabold text-portal-ink">Clear next steps</p>
                <p className="mt-1 text-sm leading-6 text-portal-muted">Start with the right dashboard, without extra navigation.</p>
              </div>
              <div className="border-l-2 border-portal-amber pl-4">
                <p className="text-sm font-extrabold text-portal-ink">Built for care</p>
                <p className="mt-1 text-sm leading-6 text-portal-muted">Simple access for customers and service teams.</p>
              </div>
            </div>
          </div>

          <footer className="flex flex-col gap-2 border-t border-portal-border/80 pt-5 text-xs leading-5 text-portal-muted sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} Insurance Portal</span>
            <span>Need help? Contact your insurance office.</span>
          </footer>
        </section>

        <section className="relative">
          <div className="rounded-portal-card border border-portal-border bg-white p-6 sm:p-8">
            <div className="border-b border-portal-border/80 pb-6">
              <h2 className="text-2xl font-extrabold tracking-[-0.03em] text-portal-ink">Choose your access</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-portal-muted">We will route you to the right place based on your role.</p>
            </div>

            <form onSubmit={handleLogin} className="mt-7 space-y-6" noValidate>
              <fieldset>
                <legend className="mb-3 text-sm font-extrabold text-portal-ink">Select your role</legend>
                <div role="radiogroup" aria-label="Access role" className="grid gap-3 sm:grid-cols-2">
                  {roles.map((roleOption) => {
                    const isSelected = role === roleOption.value;
                    return (
                      <label key={roleOption.value} className="group relative block cursor-pointer">
                        <input
                          type="radio"
                          name="role"
                          value={roleOption.value}
                          checked={isSelected}
                          onChange={() => handleRoleChange(roleOption.value)}
                          className="peer sr-only"
                        />
                        <span className={`flex min-h-32 flex-col justify-between rounded-portal-control border p-4 transition duration-150 ease-out group-hover:border-portal-teal/60 peer-focus-visible:ring-4 peer-focus-visible:ring-portal-teal/15 ${isSelected ? 'border-portal-teal bg-portal-teal/5' : 'border-portal-border bg-white'}`}>
                          <span className="flex items-center justify-end gap-3">
                            <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${isSelected ? 'border-portal-teal' : 'border-portal-border'}`}>
                              <span className={`h-2.5 w-2.5 rounded-full bg-portal-teal transition-transform ${isSelected ? 'scale-100' : 'scale-0'}`} />
                            </span>
                          </span>
                          <span>
                            <span className="mt-4 block text-sm font-extrabold text-portal-ink">{roleOption.label}</span>
                            <span className="mt-1 block text-xs leading-5 text-portal-muted">{roleOption.description}</span>
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="space-y-4">
                {/* CUSTOMER ID INPUT (Only shown for Customer) */}
                {role === 'customer' ? (
                  <div>
                    <label htmlFor="customer-id" className="mb-2 flex items-center justify-between gap-3 text-sm font-extrabold text-portal-ink">
                      <span>Customer ID</span>
                      <span className="text-xs font-semibold text-portal-muted">Required</span>
                    </label>
                    <input
                      id="customer-id"
                      name="customerId"
                      type="text"
                      inputMode="text"
                      autoComplete="username"
                      spellCheck="false"
                      value={customerId}
                      onChange={handleCustomerIdChange}
                      onBlur={() => setCustomerIdError(validateCustomerId(customerId))}
                      aria-invalid={Boolean(customerIdError)}
                      aria-describedby={customerIdError ? 'customer-id-hint customer-id-error' : 'customer-id-hint'}
                      className="w-full rounded-portal-control border border-portal-border bg-portal-paper px-4 py-3 text-base font-semibold tracking-[0.04em] text-portal-ink outline-none transition placeholder:font-medium placeholder:tracking-normal placeholder:text-portal-muted/70 hover:border-portal-teal/60 focus:border-portal-teal focus:ring-4 focus:ring-portal-teal/15"
                      required
                    />
                    <p id="customer-id-hint" className="mt-2 text-xs leading-5 text-portal-muted">Use the ID shown on your policy correspondence.</p>
                    {customerIdError && (
                      <p id="customer-id-error" role="alert" className="mt-2 text-xs font-bold leading-5 text-portal-error">
                        {customerIdError}
                      </p>
                    )}
                  </div>
                ):(
                  <div>
                    <label htmlFor="employee-id" className="mb-2 flex items-center justify-between gap-3 text-sm font-extrabold text-portal-ink">
                      <span>Employee ID</span>
                      <span className="text-xs font-semibold text-portal-muted">Required</span>
                    </label>
                    <input
                      id="employee-id"
                      name="employeeId"
                      type="text"
                      inputMode="text"
                      autoComplete="username"
                      spellCheck="false"
                      value={employeeId}
                      onChange={handleemployeeIdChange}
                      onBlur={() => setemployeeIdError(validateemployeeId(employeeId))}
                      aria-invalid={Boolean(employeeIdError)}
                      aria-describedby={employeeIdError ? 'employee-id-hint employee-id-error' : 'employee-id-hint'}
                      className="w-full rounded-portal-control border border-portal-border bg-portal-paper px-4 py-3 text-base font-semibold tracking-[0.04em] text-portal-ink outline-none transition placeholder:font-medium placeholder:tracking-normal placeholder:text-portal-muted/70 hover:border-portal-teal/60 focus:border-portal-teal focus:ring-4 focus:ring-portal-teal/15"
                      required
                    />
                    <p id="employee-id-hint" className="mt-2 text-xs leading-5 text-portal-muted">Use your assigned internal employee ID.</p>
                    {employeeIdError && (
                      <p id="employee-id-error" role="alert" className="mt-2 text-xs font-bold leading-5 text-portal-error">
                        {employeeIdError}
                      </p>
                    )}
                  </div>
                )}

                {/* PIN INPUT (Shown for BOTH Customer and employee) */}
                <div>
                  <label htmlFor="user-pin" className="mb-2 flex items-center justify-between gap-3 text-sm font-extrabold text-portal-ink">
                    <span>Secure PIN</span>
                    <span className="text-xs font-semibold text-portal-muted">Required</span>
                  </label>
                  <input
                    id="user-pin"
                    name="pin"
                    type="password"
                    inputMode="numeric"
                    placeholder="••••"
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value);
                      if (pinError) setPinError('');
                    }}
                    aria-invalid={Boolean(pinError)}
                    className="w-full rounded-portal-control border border-portal-border bg-portal-paper px-4 py-3 text-base font-semibold tracking-widest text-portal-ink outline-none transition placeholder:font-medium placeholder:tracking-normal placeholder:text-portal-muted/70 hover:border-portal-teal/60 focus:border-portal-teal focus:ring-4 focus:ring-portal-teal/15"
                    required
                  />
                  {pinError && (
                    <p role="alert" className="mt-2 text-xs font-bold leading-5 text-portal-error">
                      {pinError}
                    </p>
                  )}
                </div>
              </div>
              
              {formError && (
                <p role="alert" className="rounded-portal-control border border-portal-error/20 bg-portal-error/5 px-4 py-3 text-sm font-semibold leading-6 text-portal-error">
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-portal-control bg-portal-teal px-5 py-3 text-sm font-extrabold text-white shadow-portal-button transition duration-150 hover:bg-portal-teal-strong hover:shadow-portal-button-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-portal-teal disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Opening dashboard…' : submitLabel}
                {!isSubmitting && (
                  <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h13m-5-5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Login;