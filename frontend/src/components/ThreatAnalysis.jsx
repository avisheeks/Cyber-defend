import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  FiShield, FiAlertTriangle, FiClock, FiCheckCircle, 
  FiActivity, FiServer, FiUser, FiArrowLeft, FiChevronRight
} from 'react-icons/fi';
import { PiActivityLogBold, PiWarningBold, PiShieldCheckBold, PiArrowSquareOutBold } from 'react-icons/pi';

const ThreatAnalysis = () => {
  const { threatId } = useParams();
  const navigate = useNavigate();
  
  const [threat, setThreat] = useState(null);
  const [relatedThreats, setRelatedThreats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [statusUpdating, setStatusUpdating] = useState(false);

  useEffect(() => {
    const fetchThreatData = async () => {
      setLoading(true);
      try {
        // Fetch the threat data
        const response = await fetch(`http://localhost:8000/alerts/${threatId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch threat data');
        }
        
        const data = await response.json();
        setThreat(data);
        
        // Fetch related threats based on the category
        const relatedResponse = await fetch(`http://localhost:8000/alerts?limit=5`);
        if (relatedResponse.ok) {
          const relatedData = await relatedResponse.json();
          // Filter out the current threat and limit to 3 related threats
          const filtered = relatedData
            .filter(threat => threat.id !== threatId)
            .filter(threat => threat.threat_type === data.threat_type || 
                             data.related_threats?.includes(threat.threat_type))
            .slice(0, 3);
          
          setRelatedThreats(filtered);
        }
        
        setError(null);
      } catch (err) {
        console.error("Error fetching threat data:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchThreatData();
    
    // Set up WebSocket connection for real-time updates
    const ws = new WebSocket('ws://localhost:8000/ws');
    
    ws.onopen = () => {
      console.log('Connected to WebSocket server');
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // If this is an update to our current threat, update the state
      if (data.id === threatId) {
        setThreat(prevThreat => ({
          ...prevThreat,
          ...data
        }));
      }
    };
    
    return () => {
      ws.close();
    };
  }, [threatId]);

  const handleUpdateStatus = async (newStatus) => {
    if (!threat || statusUpdating) return;
    
    setStatusUpdating(true);
    try {
      const response = await fetch(`http://localhost:8000/alerts/${threatId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update threat status');
      }
      
      const updatedThreat = await response.json();
      setThreat(updatedThreat);
    } catch (err) {
      console.error("Error updating threat status:", err);
      setError(err.message);
    } finally {
      setStatusUpdating(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getSeverityClass = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getStatusBadge = (status) => {
    switch (status) {
      case 'resolved':
        return (
          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
            <FiCheckCircle className="mr-1" /> Resolved
          </span>
        );
      case 'investigating':
        return (
          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
            <FiActivity className="mr-1" /> Investigating
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
            <FiAlertTriangle className="mr-1" /> Open
          </span>
        );
    }
  };
  
  const getThreatTypeIcon = (type) => {
    switch (type) {
      case 'Port Scanning':
        return <FiServer className="text-blue-500" />;
      case 'DDoS Attack':
        return <FiActivity className="text-red-500" />;
      case 'Brute Force Attempt':
        return <FiUser className="text-orange-500" />;
      case 'Data Exfiltration':
        return <PiArrowSquareOutBold className="text-purple-500" />;
      case 'Man-in-the-Middle':
        return <FiShield className="text-yellow-500" />;
      default:
        return <FiAlertTriangle className="text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded m-4">
        <p>Error: {error}</p>
        <p>Make sure the backend server is running.</p>
      </div>
    );
  }

  if (!threat) {
    return (
      <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded m-4">
        <p>Threat not found</p>
        <button 
          onClick={() => navigate('/alerts')}
          className="mt-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Back to Alerts
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Back button */}
      <button 
        onClick={() => navigate('/alerts')}
        className="flex items-center text-blue-500 hover:text-blue-700 mb-4"
      >
        <FiArrowLeft className="mr-1" /> Back to Alerts
      </button>
      
      {/* Main content */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Main content area */}
        <div className="lg:w-3/4">
          {/* Header */}
          <div className="bg-white p-4 rounded-lg shadow mb-4">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center">
              <div>
                <h1 className="text-2xl font-bold">
                  {getThreatTypeIcon(threat.threat_type)}
                  <span className="ml-2">{threat.threat_type}</span>
                </h1>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getSeverityClass(threat.severity)}`}>
                    {threat.severity.toUpperCase()}
                  </span>
                  {getStatusBadge(threat.status)}
                  <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                    <FiClock className="mr-1" /> {formatTimestamp(threat.timestamp)}
                  </span>
                </div>
              </div>
              
              {/* Action buttons */}
              <div className="mt-4 md:mt-0 space-x-2">
                {threat.status !== 'resolved' && (
                  <button 
                    onClick={() => handleUpdateStatus('resolved')}
                    disabled={statusUpdating}
                    className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                  >
                    <FiCheckCircle className="inline mr-1" /> Resolve
                  </button>
                )}
                
                {threat.status !== 'investigating' && threat.status !== 'resolved' && (
                  <button 
                    onClick={() => handleUpdateStatus('investigating')}
                    disabled={statusUpdating}
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                  >
                    <FiActivity className="inline mr-1" /> Investigate
                  </button>
                )}
                
                {threat.status === 'resolved' && (
                  <button 
                    onClick={() => handleUpdateStatus('open')}
                    disabled={statusUpdating}
                    className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                  >
                    <FiAlertTriangle className="inline mr-1" /> Reopen
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="bg-white rounded-lg shadow">
            <div className="border-b">
              <nav className="flex">
                <button
                  className={`px-4 py-2 text-sm font-medium ${
                    activeTab === 'overview'
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setActiveTab('overview')}
                >
                  Overview
                </button>
                <button
                  className={`px-4 py-2 text-sm font-medium ${
                    activeTab === 'technical'
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setActiveTab('technical')}
                >
                  Technical Details
                </button>
                <button
                  className={`px-4 py-2 text-sm font-medium ${
                    activeTab === 'mitigation'
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setActiveTab('mitigation')}
                >
                  Mitigation
                </button>
              </nav>
            </div>
            
            {/* Tab content */}
            <div className="p-4">
              {activeTab === 'overview' && (
                <div>
                  <h2 className="text-lg font-semibold mb-2">Description</h2>
                  <p className="text-gray-700 mb-4">{threat.description}</p>
                  
                  <h2 className="text-lg font-semibold mb-2">Potential Impact</h2>
                  <div className="bg-gray-50 p-3 rounded mb-4">
                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                      {threat.threat_type === 'Port Scanning' && (
                        <>
                          <li>Discovery of open ports and services</li>
                          <li>Potential preparation for further attacks</li>
                          <li>Mapping of network architecture</li>
                        </>
                      )}
                      {threat.threat_type === 'DDoS Attack' && (
                        <>
                          <li>Service disruption</li>
                          <li>Resource exhaustion</li>
                          <li>Downtime and financial loss</li>
                        </>
                      )}
                      {threat.threat_type === 'Brute Force Attempt' && (
                        <>
                          <li>Unauthorized access to accounts</li>
                          <li>Credential compromise</li>
                          <li>Data breach risk</li>
                        </>
                      )}
                      {threat.threat_type === 'Data Exfiltration' && (
                        <>
                          <li>Loss of sensitive data</li>
                          <li>Intellectual property theft</li>
                          <li>Compliance violations</li>
                        </>
                      )}
                      {threat.threat_type === 'Man-in-the-Middle' && (
                        <>
                          <li>Interception of sensitive communications</li>
                          <li>Credential theft</li>
                          <li>Data manipulation</li>
                        </>
                      )}
                    </ul>
                  </div>
                  
                  <h2 className="text-lg font-semibold mb-2">Detection Details</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-sm text-gray-500">Detected on</p>
                      <p className="font-medium">{formatTimestamp(threat.timestamp)}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-sm text-gray-500">Device ID</p>
                      <p className="font-medium">{threat.device_id}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-sm text-gray-500">Severity</p>
                      <p className="font-medium">{threat.severity.toUpperCase()}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-sm text-gray-500">Status</p>
                      <p className="font-medium">{threat.status.toUpperCase()}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === 'technical' && (
                <div>
                  <h2 className="text-lg font-semibold mb-2">Technical Details</h2>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metric</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {threat.metrics && Object.entries(threat.metrics).map(([key, value]) => {
                          // Skip complex objects for display
                          if (typeof value === 'object') return null;
                          
                          return (
                            <tr key={key}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {typeof value === 'number' && value % 1 !== 0 ? value.toFixed(2) : value}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  
                  {threat.metrics?.feature_contributions && (
                    <div className="mt-6">
                      <h3 className="text-md font-semibold mb-2">Feature Contributions</h3>
                      <div className="bg-gray-50 p-3 rounded">
                        <div className="space-y-2">
                          {Object.entries(threat.metrics.feature_contributions).map(([feature, value]) => (
                            <div key={feature}>
                              <div className="flex justify-between mb-1">
                                <span className="text-sm font-medium text-gray-700">
                                  {feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </span>
                                <span className="text-sm text-gray-600">{(value * 100).toFixed(1)}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full" 
                                  style={{ width: `${value * 100}%` }}
                                ></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {activeTab === 'mitigation' && (
                <div>
                  <h2 className="text-lg font-semibold mb-2">Recommended Actions</h2>
                  
                  <div className="space-y-4">
                    {threat.threat_type === 'Port Scanning' && (
                      <>
                        <div className="bg-blue-50 p-4 rounded border-l-4 border-blue-500">
                          <h3 className="font-medium text-blue-800">Immediate Actions</h3>
                          <ul className="list-disc list-inside mt-2 text-blue-800">
                            <li>Block the source IP address in the firewall</li>
                            <li>Review open ports and close unnecessary services</li>
                            <li>Monitor for follow-up attack attempts</li>
                          </ul>
                        </div>
                        
                        <div className="bg-green-50 p-4 rounded border-l-4 border-green-500">
                          <h3 className="font-medium text-green-800">Long-term Recommendations</h3>
                          <ul className="list-disc list-inside mt-2 text-green-800">
                            <li>Implement network segmentation</li>
                            <li>Use port knocking or VPN for sensitive services</li>
                            <li>Configure intrusion detection system alerts</li>
                          </ul>
                        </div>
                      </>
                    )}
                    
                    {threat.threat_type === 'DDoS Attack' && (
                      <>
                        <div className="bg-blue-50 p-4 rounded border-l-4 border-blue-500">
                          <h3 className="font-medium text-blue-800">Immediate Actions</h3>
                          <ul className="list-disc list-inside mt-2 text-blue-800">
                            <li>Enable anti-DDoS protections at network edge</li>
                            <li>Implement rate limiting</li>
                            <li>Contact ISP for upstream filtering assistance</li>
                          </ul>
                        </div>
                        
                        <div className="bg-green-50 p-4 rounded border-l-4 border-green-500">
                          <h3 className="font-medium text-green-800">Long-term Recommendations</h3>
                          <ul className="list-disc list-inside mt-2 text-green-800">
                            <li>Implement CDN services</li>
                            <li>Increase network capacity</li>
                            <li>Set up traffic analysis to detect future attacks faster</li>
                          </ul>
                        </div>
                      </>
                    )}
                    
                    {threat.threat_type === 'Brute Force Attempt' && (
                      <>
                        <div className="bg-blue-50 p-4 rounded border-l-4 border-blue-500">
                          <h3 className="font-medium text-blue-800">Immediate Actions</h3>
                          <ul className="list-disc list-inside mt-2 text-blue-800">
                            <li>Lock the targeted account temporarily</li>
                            <li>Reset credentials if needed</li>
                            <li>Block the source IP address</li>
                          </ul>
                        </div>
                        
                        <div className="bg-green-50 p-4 rounded border-l-4 border-green-500">
                          <h3 className="font-medium text-green-800">Long-term Recommendations</h3>
                          <ul className="list-disc list-inside mt-2 text-green-800">
                            <li>Implement multi-factor authentication</li>
                            <li>Enforce password complexity policies</li>
                            <li>Add login attempt rate limiting</li>
                          </ul>
                        </div>
                      </>
                    )}
                    
                    {/* Default recommendations for other threat types */}
                    {!['Port Scanning', 'DDoS Attack', 'Brute Force Attempt'].includes(threat.threat_type) && (
                      <>
                        <div className="bg-blue-50 p-4 rounded border-l-4 border-blue-500">
                          <h3 className="font-medium text-blue-800">Immediate Actions</h3>
                          <ul className="list-disc list-inside mt-2 text-blue-800">
                            <li>Isolate affected systems</li>
                            <li>Collect forensic data</li>
                            <li>Implement temporary countermeasures</li>
                          </ul>
                        </div>
                        
                        <div className="bg-green-50 p-4 rounded border-l-4 border-green-500">
                          <h3 className="font-medium text-green-800">Long-term Recommendations</h3>
                          <ul className="list-disc list-inside mt-2 text-green-800">
                            <li>Update security policies</li>
                            <li>Conduct a thorough security assessment</li>
                            <li>Implement additional monitoring controls</li>
                          </ul>
                        </div>
                      </>
                    )}
                    
                    <div className="bg-purple-50 p-4 rounded border-l-4 border-purple-500">
                      <h3 className="font-medium text-purple-800">Preventative Measures</h3>
                      <ul className="list-disc list-inside mt-2 text-purple-800">
                        <li>Update all systems and applications</li>
                        <li>Review access control configurations</li>
                        <li>Provide security awareness training to users</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Sidebar */}
        <div className="lg:w-1/4">
          {/* Threat Info */}
          <div className="bg-white p-4 rounded-lg shadow mb-4">
            <h2 className="text-lg font-semibold mb-2">Threat Information</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">ID</p>
                <p className="font-mono text-sm break-all">{threat.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Type</p>
                <p>{threat.threat_type}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Severity</p>
                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getSeverityClass(threat.severity)}`}>
                  {threat.severity.toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                {getStatusBadge(threat.status)}
              </div>
              <div>
                <p className="text-sm text-gray-500">Detected</p>
                <p>{formatTimestamp(threat.timestamp)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Device</p>
                <p>{threat.device_id}</p>
              </div>
            </div>
          </div>
          
          {/* Related Threats */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-2">Related Threats</h2>
            
            {relatedThreats.length > 0 ? (
              <div className="space-y-2">
                {relatedThreats.map(relatedThreat => (
                  <div 
                    key={relatedThreat.id}
                    className="p-2 rounded hover:bg-gray-50 cursor-pointer border"
                    onClick={() => navigate(`/threats/${relatedThreat.id}`)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        {getThreatTypeIcon(relatedThreat.threat_type)}
                        <span className="ml-2 font-medium">{relatedThreat.threat_type}</span>
                      </div>
                      <FiChevronRight />
                    </div>
                    <div className="flex items-center mt-1">
                      <span className={`px-2 py-1 mr-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getSeverityClass(relatedThreat.severity)}`}>
                        {relatedThreat.severity}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(relatedThreat.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No related threats found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreatAnalysis; 