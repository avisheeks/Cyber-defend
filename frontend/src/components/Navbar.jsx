import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FiMenu, FiX, FiShield } from 'react-icons/fi';

const Navbar = () => {
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 w-full px-8 py-4 flex justify-between items-center z-50 bg-transparent backdrop-blur-sm">
      {/* Logo */}
      <Link to="/" className="flex items-center">
        <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center mr-2">
          <FiShield className="text-white text-xl" />
        </div>
        <span className="text-white font-semibold text-2xl ml-2">EdgeSentinel</span>
      </Link>
      
      {/* Desktop Navigation */}
      <div className="hidden md:flex items-center gap-8">
        <Link to="/" className="text-white hover:text-gray-300 transition-colors">
          Home
        </Link>
        <Link to="/about" className="text-white hover:text-gray-300 transition-colors">
          About
        </Link>
        <Link to="/how-it-works" className="text-white hover:text-gray-300 transition-colors">
          How It Works
        </Link>
        <Link to="/pricing" className="text-white hover:text-gray-300 transition-colors">
          Pricing
        </Link>
        <Link to="/blog" className="text-white hover:text-gray-300 transition-colors">
          Blog
        </Link>
        <Link to="/contact" className="text-white hover:text-gray-300 transition-colors">
          Contact
        </Link>
        
        {/* Direct Alerts Page Link */}
        <Link to="/alerts-simple" className="text-white bg-purple-700 hover:bg-purple-800 px-3 py-1 rounded transition-colors">
          Direct Alerts
        </Link>

        {user ? (
          <button
            onClick={signOut}
            className="ml-4 px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors font-medium"
          >
            Sign Out
          </button>
        ) : (
          <Link
            to="/auth"
            className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors font-medium"
          >
            Try Now
          </Link>
        )}
      </div>
      
      {/* Mobile menu button */}
      <button 
        className="md:hidden text-white"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
      </button>
      
      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-gray-900/95 backdrop-blur-sm py-4 px-8">
          <div className="flex flex-col gap-4">
            <Link 
              to="/" 
              className="text-white hover:text-gray-300 transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Home
            </Link>
            <Link 
              to="/about" 
              className="text-white hover:text-gray-300 transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              About
            </Link>
            <Link 
              to="/how-it-works" 
              className="text-white hover:text-gray-300 transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              How It Works
            </Link>
            <Link 
              to="/pricing" 
              className="text-white hover:text-gray-300 transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Pricing
            </Link>
            <Link 
              to="/blog" 
              className="text-white hover:text-gray-300 transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Blog
            </Link>
            <Link 
              to="/contact" 
              className="text-white hover:text-gray-300 transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Contact
            </Link>
            
            {/* Direct Alerts Page Link */}
            <Link 
              to="/alerts-simple" 
              className="text-white bg-purple-700 hover:bg-purple-800 py-2 px-3 rounded transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Direct Alerts
            </Link>
            
            {user ? (
              <button
                onClick={() => {
                  signOut();
                  setMobileMenuOpen(false);
                }}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors font-medium"
              >
                Sign Out
              </button>
            ) : (
              <Link
                to="/auth"
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Try Now
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar; 