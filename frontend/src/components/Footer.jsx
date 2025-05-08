import React from 'react';
import { Link } from 'react-router-dom';
import { FiShield, FiGithub, FiTwitter, FiLinkedin } from 'react-icons/fi';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-black/50 backdrop-blur-sm py-10 px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-6 md:mb-0">
            <Link to="/" className="flex items-center text-white text-2xl font-bold tracking-wider">
              <FiShield className="mr-2 h-6 w-6" />
              NeuralGuard
            </Link>
            <p className="text-gray-500 mt-2">
              Advanced Cybersecurity Threat Detection
            </p>
          </div>
          
          <div className="flex flex-wrap gap-8">
            <Link to="/about" className="text-gray-400 hover:text-white transition-colors">
              About
            </Link>
            <Link to="/how-it-works" className="text-gray-400 hover:text-white transition-colors">
              How It Works
            </Link>
            <Link to="/pricing" className="text-gray-400 hover:text-white transition-colors">
              Pricing
            </Link>
            <Link to="/blog" className="text-gray-400 hover:text-white transition-colors">
              Blog
            </Link>
            <Link to="/contact" className="text-gray-400 hover:text-white transition-colors">
              Contact
            </Link>
          </div>
        </div>
        
        <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-600 text-sm mb-4 md:mb-0">
            © {currentYear} NeuralGuard. All rights reserved.
          </p>
          
          <div className="flex gap-4">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
              <FiGithub size={20} />
            </a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
              <FiTwitter size={20} />
            </a>
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
              <FiLinkedin size={20} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 