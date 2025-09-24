import React, { useState } from 'react';
import { Search, X, Settings, Plus } from 'lucide-react';

type View = 'home' | 'results' | 'admin';
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastNotice {
  id: string;
  message: string;
  type: ToastType;
}

// Header Component
const Header = ({ 
  searchQuery, 
  onSearchChange, 
  onSearchSubmit, 
  selectedCity, 
  onCityChange,
  onAddRestaurant,
  isAdmin,
  onAdminClick
}: {
  searchQuery: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  selectedCity: string;
  onCityChange: (city: string) => void;
  onAddRestaurant: () => void;
  isAdmin: boolean;
  onAdminClick: () => void;
}) => (
  <header className="bg-white shadow-sm">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between h-16">
        <div className="flex">
          <div className="flex-shrink-0 flex items-center">
            <h1 className="text-xl font-bold text-green-700">Crunch</h1>
          </div>
          <nav className="hidden sm:ml-6 sm:flex sm:space-x-8">
            <a href="#" className="border-green-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
              Home
            </a>
            <a href="#" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
              Cities
            </a>
            <a href="#" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
              About
            </a>
          </nav>
        </div>
        <div className="flex-1 max-w-2xl px-4 flex items-center justify-center">
          <form onSubmit={onSearchSubmit} className="w-full max-w-xl">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={onSearchChange}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-full leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                placeholder="Search restaurants..."
              />
              <div className="absolute inset-y-0 right-0 flex items-center">
                <select
                  value={selectedCity}
                  onChange={(e) => onCityChange(e.target.value)}
                  className="h-full py-0 pl-2 pr-7 border-transparent bg-transparent text-gray-500 sm:text-sm rounded-r-md focus:ring-green-500 focus:border-green-500"
                >
                  <option value="NYC">NYC</option>
                  <option value="LA">Los Angeles</option>
                  <option value="SF">San Francisco</option>
                  <option value="Austin">Austin</option>
                </select>
              </div>
            </div>
          </form>
        </div>
        <div className="flex items-center">
          <button
            onClick={onAddRestaurant}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Add Restaurant
          </button>
          {isAdmin && (
            <button
              onClick={onAdminClick}
              className="ml-4 inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              <Settings className="-ml-1 mr-2 h-5 w-5 text-gray-500" />
              Admin
            </button>
          )}
        </div>
      </div>
    </div>
  </header>
);

// Footer Component
const Footer = () => (
  <footer className="bg-white border-t border-gray-200 mt-12">
    <div className="max-w-7xl mx-auto py-12 px-4 overflow-hidden sm:px-6 lg:px-8">
      <nav className="-mx-5 -my-2 flex flex-wrap justify-center" aria-label="Footer">
        <div className="px-5 py-2">
          <a href="#" className="text-base text-gray-500 hover:text-gray-900">About</a>
        </div>
        <div className="px-5 py-2">
          <a href="#" className="text-base text-gray-500 hover:text-gray-900">Blog</a>
        </div>
        <div className="px-5 py-2">
          <a href="#" className="text-base text-gray-500 hover:text-gray-900">Submit a Restaurant</a>
        </div>
        <div className="px-5 py-2">
          <a href="#" className="text-base text-gray-500 hover:text-gray-900">Contact</a>
        </div>
        <div className="px-5 py-2">
          <a href="#" className="text-base text-gray-500 hover:text-gray-900">Privacy</a>
        </div>
        <div className="px-5 py-2">
          <a href="#" className="text-base text-gray-500 hover:text-gray-900">Terms</a>
        </div>
      </nav>
      <p className="mt-8 text-center text-base text-gray-400">
        &copy; {new Date().getFullYear()} Crunch. All rights reserved.
      </p>
    </div>
  </footer>
);

// Toast Component
const Toast = ({ message, type, onClose }: { message: string; type: ToastType; onClose: () => void }) => {
  const bgColor = {
    success: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
    warning: 'bg-yellow-100 text-yellow-800',
    info: 'bg-blue-100 text-blue-800'
  }[type];

  return (
    <div className={`${bgColor} rounded-lg shadow-lg p-4 mb-2 flex justify-between items-center`}>
      <span>{message}</span>
      <button onClick={onClose} className="ml-4 text-gray-500 hover:text-gray-700">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// Modal Component
const Modal = ({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          {children}
        </div>
      </div>
    </div>
  );
};

// Results Page Component
const ResultsPage = ({ searchQuery, selectedCity }: { searchQuery: string; selectedCity: string }) => {
  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <h2 className="text-2xl font-bold mb-6">Search Results</h2>
      <p className="text-gray-600">Results for "{searchQuery}" in {selectedCity}</p>
      {/* Add results list here */}
    </div>
  );
};

// Main App Component
const App = () => {
  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('NYC');
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentView, setCurrentView] = useState<View>('home');
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [toasts, setToasts] = useState<ToastNotice[]>([]);

  // Handle search form submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setCurrentView('results');
      addToast(`Searching for "${searchQuery}" in ${selectedCity}`);
    }
  };

  // Handle city change
  const handleCityChange = (city: string) => {
    setSelectedCity(city);
    if (currentView === 'results') {
      addToast(`Updated results for ${city}`);
    }
  };

  // Add a new toast message
  const addToast = (message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto-remove toast after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <Header 
        searchQuery={searchQuery}
        onSearchChange={(e) => setSearchQuery(e.target.value)}
        onSearchSubmit={handleSearchSubmit}
        selectedCity={selectedCity}
        onCityChange={handleCityChange}
        onAddRestaurant={() => setShowSubmissionForm(true)}
        isAdmin={isAdmin}
        onAdminClick={() => setCurrentView('admin')}
      />
      
      {/* Main content */}
      <main className="flex-grow">
        {currentView === 'home' && (
          <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
                Find Seed Oil-Free Restaurants
              </h2>
              <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 sm:mt-4">
                Discover restaurants that cook with healthy oils and fats
              </p>
            </div>
          </div>
        )}
        
        {currentView === 'results' && (
          <ResultsPage searchQuery={searchQuery} selectedCity={selectedCity} />
        )}
        
        {currentView === 'admin' && (
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            {isAdmin ? (
              <div>
                <h2 className="text-2xl font-bold mb-4">Admin Dashboard</h2>
                <p>Admin features coming soon...</p>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600">You must be an admin to access this page.</p>
                <button
                  onClick={() => setIsAdmin(true)}
                  className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Sign In as Admin (Demo)
                </button>
              </div>
            )}
          </div>
        )}
      </main>
      
      {/* Footer */}
      <Footer />
      
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <Toast 
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
          />
        ))}
      </div>
      
      {/* Restaurant Detail Modal */}
      <Modal 
        open={showDetailModal} 
        onClose={() => setShowDetailModal(false)}
      >
        {selectedRestaurant ? (
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900">{selectedRestaurant.name}</h3>
            <p className="mt-2 text-gray-600">{selectedRestaurant.address}</p>
            {/* Add more restaurant details here */}
          </div>
        ) : (
          <div className="p-6">
            <p>Loading restaurant details...</p>
          </div>
        )}
      </Modal>
      
      {/* Submission Form Modal */}
      <Modal 
        open={showSubmissionForm}
        onClose={() => setShowSubmissionForm(false)}
      >
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Add a Restaurant</h3>
          <p className="text-gray-600 mb-4">
            Know a restaurant that cooks with healthy oils? Let us know!
          </p>
          <form className="space-y-4">
            <div>
              <label htmlFor="restaurant-name" className="block text-sm font-medium text-gray-700">
                Restaurant Name
              </label>
              <input
                type="text"
                id="restaurant-name"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
                placeholder="Restaurant name"
              />
            </div>
            <div>
              <label htmlFor="restaurant-address" className="block text-sm font-medium text-gray-700">
                Address
              </label>
              <input
                type="text"
                id="restaurant-address"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
                placeholder="123 Main St, City, State"
              />
            </div>
            <div>
              <label htmlFor="restaurant-notes" className="block text-sm font-medium text-gray-700">
                Notes (optional)
              </label>
              <textarea
                id="restaurant-notes"
                rows={3}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
                placeholder="Any additional information about the restaurant..."
              ></textarea>
            </div>
            <div className="mt-4 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowSubmissionForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
              >
                Submit
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
};

export default App;
