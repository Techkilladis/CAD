import { useState, useEffect } from 'react';
import { getDashboardStats, approveTransfer, rejectTransfer, runAlertCheck, acknowledgeAlert, updateReunificationCaseStatus } from '../api/client';
import { ShieldAlert, Users, Package, AlertTriangle, ArrowRightLeft, Check, X, Clock, Activity, Building2, Search } from 'lucide-react';

export const AdminDashboard = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview'|'shelters'|'transfers'|'alerts'|'reunifications'>('overview');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const { data } = await getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (transferId: string) => {
    try {
      await approveTransfer(transferId, {});
      alert('Transfer approved successfully');
      fetchStats();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to approve transfer');
    }
  };

  const handleReject = async (transferId: string) => {
    try {
      await rejectTransfer(transferId, {});
      alert('Transfer rejected successfully');
      fetchStats();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reject transfer');
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await acknowledgeAlert(alertId);
      fetchStats();
    } catch (err) {
      alert('Failed to acknowledge alert');
    }
  };

  const handleRunAlertCheck = async () => {
    try {
      await runAlertCheck();
      alert('Alert engine run successfully');
      fetchStats();
    } catch (err) {
      alert('Failed to run alert check');
    }
  };

  if (loading && !stats) return <div className="p-8 text-center text-gray-500">Loading admin dashboard...</div>;
  if (!stats) return <div className="p-8 text-center text-red-500">Failed to load data.</div>;

  const occupancyPercentage = stats.totalCapacity > 0 ? ((stats.totalOccupied / stats.totalCapacity) * 100).toFixed(1) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <div className="mb-6 border-b pb-4 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">District Operations Console</h1>
          <p className="text-gray-500 mt-2">Comprehensive management of district resources, shelters, and alerts.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleRunAlertCheck} className="text-sm px-4 py-2 bg-purple-50 text-purple-600 rounded hover:bg-purple-100 font-medium transition-colors">
            Run Alert Engine
          </button>
          <button onClick={fetchStats} className="text-sm px-4 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 font-medium transition-colors">
            Refresh Data
          </button>
        </div>
      </div>

      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-8 overflow-x-auto">
        <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<Activity className="w-4 h-4 mr-2" />} label="Overview" />
        <TabButton active={activeTab === 'shelters'} onClick={() => setActiveTab('shelters')} icon={<Building2 className="w-4 h-4 mr-2" />} label="Shelters" />
        <TabButton active={activeTab === 'transfers'} onClick={() => setActiveTab('transfers')} icon={<ArrowRightLeft className="w-4 h-4 mr-2" />} label={`Transfers (${stats.pendingTransfers?.length || 0})`} />
        <TabButton active={activeTab === 'alerts'} onClick={() => setActiveTab('alerts')} icon={<AlertTriangle className="w-4 h-4 mr-2" />} label={`Alerts (${stats.allAlerts?.length || 0})`} />
        <TabButton active={activeTab === 'reunifications'} onClick={() => setActiveTab('reunifications')} icon={<Search className="w-4 h-4 mr-2" />} label={`Reunifications (${stats.reunificationCases?.filter((c: any) => c.status === 'POTENTIAL_MATCH' || c.status === 'MISSING').length || 0})`} />
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            <StatCard title="Total Shelters" value={stats.totalShelters} icon={<ShieldAlert />} color="blue" />
            <StatCard title="Total Capacity" value={stats.totalCapacity} icon={<Users />} color="green" />
            <StatCard title="Total Occupied" value={stats.totalOccupied} icon={<Users />} color="purple" />
            <StatCard title="Available Space" value={stats.totalAvailableCapacity} icon={<Package />} color="indigo" />
            <StatCard title="Occupancy %" value={`${occupancyPercentage}%`} icon={<Activity />} color="orange" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Resource Summary</h2>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(stats.resourceSummary || {}).map(([key, value]) => (
                  <div key={key} className="p-4 bg-gray-50 rounded border border-gray-100">
                    <p className="text-sm text-gray-500 font-semibold uppercase">{key}</p>
                    <p className="text-2xl font-bold text-gray-900">{value as any}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <button onClick={() => setActiveTab('alerts')} className="w-full text-left p-3 rounded bg-red-50 text-red-700 hover:bg-red-100 font-medium flex items-center justify-between">
                  <span>Review Active Alerts</span>
                  <span className="bg-red-200 text-red-800 px-2 py-0.5 rounded-full text-xs">{stats.allAlerts?.length || 0}</span>
                </button>
                <button onClick={() => setActiveTab('transfers')} className="w-full text-left p-3 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium flex items-center justify-between">
                  <span>Review Pending Transfers</span>
                  <span className="bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full text-xs">{stats.pendingTransfers?.length || 0}</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'alerts' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">All Active Alerts</h2>
          <div className="space-y-4">
            {stats.allAlerts?.map((alert: any) => {
              const color = alert.alertType.includes('CRITICAL') || alert.alertType === 'FULL_SHELTER' ? 'red' : 'orange';
              return (
                <div key={alert.id} className={`p-4 bg-${color}-50 border border-${color}-200 rounded-lg flex justify-between items-center`}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 bg-${color}-200 text-${color}-800 text-xs uppercase font-bold rounded`}>{alert.alertType}</span>
                      <span className={`text-sm font-semibold text-${color}-900`}>{alert.shelter.name}</span>
                    </div>
                    <p className={`text-sm text-${color}-800`}>{alert.message || 'Action required.'}</p>
                    <p className={`text-xs text-${color}-600 mt-1`}><Clock className="w-3 h-3 inline mr-1"/>{new Date(alert.triggeredAt).toLocaleString()}</p>
                  </div>
                  <button onClick={() => handleAcknowledgeAlert(alert.id)} className={`px-3 py-1 bg-white border border-${color}-300 text-${color}-700 rounded text-sm hover:bg-${color}-100`}>Acknowledge</button>
                </div>
              );
            })}
            {(!stats.allAlerts || stats.allAlerts.length === 0) && (
              <p className="text-gray-500 text-center py-8">No active alerts.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'transfers' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Transfer Operations</h2>
          
          <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Pending Review</h3>
          <div className="space-y-4 mb-8">
            {stats.pendingTransfers?.map((t: any) => (
              <div key={t.id} className="p-4 bg-gray-50 border border-gray-200 rounded-lg flex justify-between items-center">
                <div>
                  <p className="font-bold text-gray-900">{t.resourceType} - {t.quantity} Units</p>
                  <p className="text-sm text-gray-600 mt-1 flex items-center">
                    {t.fromShelter.name} <ArrowRightLeft className="w-3 h-3 mx-2" /> {t.toShelter.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Requested by {t.requestedBy?.name}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleReject(t.id)} className="px-3 py-1.5 text-sm text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded flex items-center"><X className="w-4 h-4 mr-1" /> Reject</button>
                  <button onClick={() => handleApprove(t.id)} className="px-3 py-1.5 text-sm text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded flex items-center"><Check className="w-4 h-4 mr-1" /> Approve</button>
                </div>
              </div>
            ))}
            {(!stats.pendingTransfers || stats.pendingTransfers.length === 0) && <p className="text-gray-500 text-sm">No pending transfers.</p>}
          </div>

          <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">In Transit</h3>
          <div className="space-y-4">
            {stats.inTransitTransfers?.map((t: any) => (
              <div key={t.id} className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex justify-between items-center">
                <div>
                  <p className="font-bold text-blue-900">{t.resourceType} - {t.quantity} Units</p>
                  <p className="text-sm text-blue-800 mt-1 flex items-center">
                    {t.fromShelter.name} <ArrowRightLeft className="w-3 h-3 mx-2" /> {t.toShelter.name}
                  </p>
                </div>
                <span className="px-3 py-1 text-sm bg-blue-200 text-blue-800 font-semibold rounded-full">In Transit</span>
              </div>
            ))}
            {(!stats.inTransitTransfers || stats.inTransitTransfers.length === 0) && <p className="text-gray-500 text-sm">No transfers currently in transit.</p>}
          </div>
        </div>
      )}

      {activeTab === 'shelters' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Shelter Directory</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats.shelters?.map((s: any) => (
              <div key={s.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-gray-900 text-lg">{s.name}</h3>
                  <span className={`px-2 py-1 text-xs font-bold rounded ${s.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : s.status === 'FULL' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                    {s.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-4">{s.address}</p>
                <div className="flex justify-between items-center bg-gray-50 p-2 rounded">
                  <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Occupancy</span>
                  <span className="text-sm font-bold text-gray-900">{s.capacityOccupied} / {s.capacityTotal}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {activeTab === 'reunifications' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Active Reunification Cases</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b text-gray-500 text-sm">
                    <th className="pb-3 font-medium">Missing Person</th>
                    <th className="pb-3 font-medium">Contact Person</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm">
                  {stats.reunificationCases?.map((c: any) => (
                    <tr key={c.id}>
                      <td className="py-4 font-semibold text-gray-900">{c.missingPersonName}</td>
                      <td className="py-4 text-gray-600">{c.contactPerson} ({c.contactInfo})</td>
                      <td className="py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                          c.status === 'POTENTIAL_MATCH' ? 'bg-yellow-100 text-yellow-800' : 
                          c.status === 'REUNITED' ? 'bg-green-100 text-green-800' :
                          c.status === 'CLOSED' ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-800'
                        }`}>
                          {c.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-4">
                        {c.status !== 'REUNITED' && c.status !== 'CLOSED' && (
                          <div className="flex gap-2">
                            <button onClick={async () => {
                              await updateReunificationCaseStatus(c.id, 'REUNITED');
                              fetchStats();
                            }} className="px-2 py-1 bg-green-50 text-green-700 hover:bg-green-100 rounded text-xs font-medium">
                              Mark Reunited
                            </button>
                            <button onClick={async () => {
                              await updateReunificationCaseStatus(c.id, 'CLOSED');
                              fetchStats();
                            }} className="px-2 py-1 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded text-xs font-medium">
                              Close Case
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(!stats.reunificationCases || stats.reunificationCases.length === 0) && (
                    <tr><td colSpan={4} className="text-center py-8 text-gray-500">No cases found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

const TabButton = ({ active, onClick, icon, label }: any) => (
  <button
    onClick={onClick}
    className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
      active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
    }`}
  >
    {icon} {label}
  </button>
);

const StatCard = ({ title, value, icon, color }: any) => {
  const colorMap: any = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    indigo: 'bg-indigo-100 text-indigo-600',
    orange: 'bg-orange-100 text-orange-600',
  };
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`p-3 rounded-lg ${colorMap[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
};
