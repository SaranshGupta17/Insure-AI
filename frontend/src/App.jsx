import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import EmployeeDashboard from './components/officer/EmployeeDashboard';
import CustomerDashboard from './components/customer/CustomerDashboard';
import { Analytics } from "@vercel/analytics/next"

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/customer" element={<CustomerDashboard />} />
        <Route path="/employee" element={<EmployeeDashboard />} />
        
      </Routes>
    </Router>
  );
}

export default App;
