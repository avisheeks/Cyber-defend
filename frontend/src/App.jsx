import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import HomePage from './components/HomePage';
import Dashboard from './components/Dashboard';
import ThreatAnalysis from './components/ThreatAnalysis';
import NetworkMonitor from './components/NetworkMonitor';
import EnhancedNetworkMonitor from './components/EnhancedNetworkMonitor';
import Auth from './components/Auth';
import Footer from './components/Footer';
import SimpleAlertsPage from './pages/SimpleAlertsPage';

const App = () => {
  return (
    <Router>
      <AuthProvider>
        <div className="flex flex-col min-h-screen bg-[#0B0B0F]">
          <Navbar />
          <main className="flex-grow">
            <Routes>
              {/* Public routes */}
              <Route path="/auth" element={<Auth />} />
              
              {/* Direct alert monitoring page - no auth required */}
              <Route path="/alerts-simple" element={<SimpleAlertsPage />} />
              
              {/* Protected routes */}
              <Route path="/" element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              } />
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/threats/:threatId" element={
                <ProtectedRoute>
                  <ThreatAnalysis />
                </ProtectedRoute>
              } />
              
              {/* Use our enhanced network monitor instead of the original */}
              <Route path="/network" element={
                <ProtectedRoute>
                  <EnhancedNetworkMonitor />
                </ProtectedRoute>
              } />
              
              {/* Keep the original network monitor available at a different URL */}
              <Route path="/network-old" element={
                <ProtectedRoute>
                  <NetworkMonitor />
                </ProtectedRoute>
              } />
              
              {/* Placeholder routes for navbar links */}
              <Route path="/about" element={
                <ProtectedRoute>
                  <div className="min-h-screen pt-20 px-8 text-white">
                    <h1 className="text-4xl font-bold mb-6">About Us</h1>
                    <p>Learn more about our cybersecurity threat detection platform.</p>
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/how-it-works" element={
                <ProtectedRoute>
                  <div className="min-h-screen pt-20 px-8 text-white">
                    <h1 className="text-4xl font-bold mb-6">How It Works</h1>
                    <p>Discover how our AI-powered threat detection system protects your network.</p>
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/pricing" element={
                <ProtectedRoute>
                  <div className="min-h-screen pt-20 px-8 text-white">
                    <h1 className="text-4xl font-bold mb-6">Pricing</h1>
                    <p>View our flexible pricing plans for businesses of all sizes.</p>
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/blog" element={
                <ProtectedRoute>
                  <div className="min-h-screen pt-20 px-8 text-white">
                    <h1 className="text-4xl font-bold mb-6">Blog</h1>
                    <p>Read our latest articles about cybersecurity trends and best practices.</p>
                  </div>
                </ProtectedRoute>
              } />
              <Route path="/contact" element={
                <ProtectedRoute>
                  <div className="min-h-screen pt-20 px-8 text-white">
                    <h1 className="text-4xl font-bold mb-6">Contact Us</h1>
                    <p>Get in touch with our team for support or inquiries.</p>
                  </div>
                </ProtectedRoute>
              } />
              
              {/* Catch-all route redirects to home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </AuthProvider>
    </Router>
  );
};

export default App; 