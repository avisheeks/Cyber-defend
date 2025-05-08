import React from 'react';
import DirectAlertMonitor from '../components/DirectAlertMonitor';

const SimpleAlertsPage = () => {
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">Direct Alert Monitor</h1>
      
      <div className="bg-blue-50 border-blue-200 border p-4 rounded-lg mb-6">
        <h2 className="font-semibold text-blue-700 mb-2">About This Page</h2>
        <p className="text-blue-700 mb-2">
          This page uses a completely standalone approach to display alerts with minimal dependencies.
          The WebSocket connection is established directly in the component, bypassing all other services.
        </p>
        <p className="text-blue-700">
          If you see alerts on this page but not elsewhere in the application, it indicates an issue with 
          the service implementation or state management in other components, not with the WebSocket or backend.
        </p>
      </div>
      
      <DirectAlertMonitor />
      
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
        <h2 className="font-semibold mb-2">Troubleshooting Tips</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium">If no connection is established:</h3>
            <ul className="list-disc list-inside space-y-1 mt-1 ml-2">
              <li>Make sure the backend server is running at http://localhost:8000</li>
              <li>Check that the WebSocket endpoint is available at ws://localhost:8000/ws</li>
              <li>Use the "Reset Connection" button to force a reconnection attempt</li>
              <li>Look for CORS errors in your browser console</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium">If connected but no alerts appear:</h3>
            <ul className="list-disc list-inside space-y-1 mt-1 ml-2">
              <li>Use the "Create Test Alert" button to generate a test alert</li>
              <li>Check the "Last Raw Message" section to see if any data is being received</li>
              <li>Verify that the backend is properly generating and broadcasting alerts</li>
              <li>Check if there are any parse errors in your browser console</li>
              <li>Try the "Reset Connection" button to establish a fresh connection</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium">Backend Commands to Test:</h3>
            <div className="bg-gray-100 p-2 rounded font-mono text-sm mt-1 overflow-x-auto">
              <p className="mb-1">curl http://localhost:8000/test-alert</p>
              <p>curl http://localhost:8000/debug/alerts</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleAlertsPage; 