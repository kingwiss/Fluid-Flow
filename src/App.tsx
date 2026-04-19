/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HashRouter, Routes, Route } from 'react-router-dom';
import CustomerApp from './pages/CustomerApp';
import DriverDashboard from './pages/DriverDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route path="/" element={<CustomerApp />} />
          <Route path="/driver" element={<DriverDashboard />} />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  );
}


