import { useState, useEffect } from 'react';
import { getShelters, getShelterById, checkIn, checkOut, updateResource, confirmCheckin, createShift, getShifts } from '../api/client';
import { Users, Package, AlertCircle, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const CoordinatorDashboard = () => {
  const [shelter, setShelter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<any[]>([]);
  
  // Forms state
  const [familySize, setFamilySize] = useState(1);
  const [personName, setPersonName] = useState('');
  const [medicalFlag, setMedicalFlag] = useState(false);
  const [elderlyCount, setElderlyCount] = useState(0);
  const [pregnantFlag, setPregnantFlag] = useState(false);
  const [disabledFlag, setDisabledFlag] = useState(false);
  const [childrenCount, setChildrenCount] = useState(0);
  const [emergencyNotes, setEmergencyNotes] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchMyShelter();
    }
  }, [user]);

  const fetchMyShelter = async () => {
    try {
      setLoading(true);
      const { data } = await getShelters();
      const myShelter = data.find((s: any) => s.coordinatorId === user?.id);
      
      if (myShelter) {
        const detailed = await getShelterById(myShelter.id);
        setShelter(detailed.data);
        const { data: shiftData } = await getShifts(myShelter.id);
        setShifts(shiftData);
      } else {
        setShelter(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shelter) return;
    try {
      await checkIn(shelter.id, { 
        personName, familySize, medicalFlag, 
        elderlyCount, pregnantFlag, disabledFlag, childrenCount, emergencyNotes 
      });
      alert('Check-in successful!');
      setPersonName('');
      setFamilySize(1);
      setMedicalFlag(false);
      setElderlyCount(0);
      setPregnantFlag(false);
      setDisabledFlag(false);
      setChildrenCount(0);
      setEmergencyNotes('');
      fetchMyShelter(); // refresh data
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to check in');
    }
  };

  const handleCheckOut = async (checkinId: string, size: number) => {
    try {
      await checkOut(shelter.id, { checkinId, familySize: size });
      alert('Check-out successful!');
      fetchMyShelter();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to check out');
    }
  };

  const handleConfirmCheckin = async (checkinId: string) => {
    try {
      await confirmCheckin(shelter.id, checkinId);
      alert('Check-in confirmed!');
      fetchMyShelter();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to confirm check-in');
    }
  };

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const startTime = (form.elements.namedItem('startTime') as HTMLInputElement).value;
    const endTime = (form.elements.namedItem('endTime') as HTMLInputElement).value;
    const requiredCount = parseInt((form.elements.namedItem('requiredCount') as HTMLInputElement).value);

    try {
      await createShift({ shelterId: shelter.id, startTime, endTime, requiredCount });
      alert('Shift created successfully!');
      fetchMyShelter();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create shift');
    }
  };

  const handleResourceUpdate = async (resourceId: string, newQuantity: number) => {
    try {
      await updateResource(shelter.id, resourceId, newQuantity);
      fetchMyShelter();
    } catch (err) {
      alert('Failed to update resource');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading dashboard...</div>;
  if (!shelter) return <div className="p-8 text-center text-red-500">No shelter assigned.</div>;

  const capacityStatus = shelter.availableCapacity <= 0 ? 'Full' : shelter.availableCapacity <= 10 ? 'Critical' : 'Available';
  const statusColor = capacityStatus === 'Full' ? 'text-red-600' : capacityStatus === 'Critical' ? 'text-yellow-600' : 'text-green-600';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <div className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-bold text-gray-900">Coordinator Dashboard</h1>
        <p className="text-gray-500 mt-2">Managing: <span className="font-semibold text-gray-800">{shelter.name}</span></p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Occupancy Column */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Occupancy</h2>
            </div>
            
            <div className="mb-6 flex items-center justify-between bg-gray-50 p-4 rounded-lg">
              <div>
                <p className="text-sm text-gray-500">Occupied / Total</p>
                <p className="text-2xl font-bold text-gray-900">{shelter.capacityOccupied} / {shelter.capacityTotal}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Available / Status</p>
                <p className="text-2xl font-bold">
                  <span className={statusColor}>{shelter.availableCapacity}</span>
                  <span className={`text-sm font-medium ml-2 ${statusColor}`}>({capacityStatus})</span>
                </p>
              </div>
            </div>

            <form onSubmit={handleCheckIn} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Family Name / Primary Contact</label>
                <input 
                  type="text" required value={personName} onChange={e => setPersonName(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" 
                  placeholder="e.g. Smith Family"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Total Size</label>
                  <input 
                    type="number" min="1" required value={familySize} onChange={e => setFamilySize(parseInt(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Children Count</label>
                  <input 
                    type="number" min="0" value={childrenCount} onChange={e => setChildrenCount(parseInt(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Elderly Count</label>
                  <input 
                    type="number" min="0" value={elderlyCount} onChange={e => setElderlyCount(parseInt(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" 
                  />
                </div>
              </div>
              
              <div className="space-y-2 mt-4">
                <p className="block text-sm font-medium text-gray-700">Medical & Special Needs</p>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" checked={medicalFlag} onChange={e => setMedicalFlag(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700 flex items-center gap-1"><AlertCircle className="h-4 w-4 text-red-500"/> General Medical</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" checked={pregnantFlag} onChange={e => setPregnantFlag(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700">Pregnant</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" checked={disabledFlag} onChange={e => setDisabledFlag(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700">Disabled</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Emergency Notes</label>
                <textarea 
                  value={emergencyNotes} onChange={e => setEmergencyNotes(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" 
                  placeholder="e.g. Needs wheelchair access..."
                />
              </div>

              <button type="submit" disabled={shelter.availableCapacity < familySize} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 mt-4">
                Complete Check-in
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Check-ins</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
              {shelter.checkins && shelter.checkins.length > 0 ? (
                shelter.checkins.map((ci: any) => (
                  <div key={ci.id} className={`p-3 border rounded-lg flex justify-between items-center ${ci.status === 'PENDING' ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'}`}>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {ci.personName} 
                        {ci.status === 'PENDING' && <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">Pending</span>}
                      </p>
                      <p className="text-xs text-gray-500">
                        Size: {ci.familySize} 
                        {ci.medicalFlag && <span className="text-red-500 font-medium ml-2">Medical Need</span>}
                      </p>
                    </div>
                    {ci.status === 'PENDING' ? (
                      <button 
                        onClick={() => handleConfirmCheckin(ci.id)} 
                        className="text-sm px-3 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded-md transition-colors"
                      >
                        Confirm
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleCheckOut(ci.id, ci.familySize)} 
                        className="text-sm px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded-md transition-colors flex items-center"
                      >
                        <LogOut className="h-4 w-4 mr-1"/> Check Out
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No active check-ins.</p>
              )}
            </div>
          </div>
        </div>

        {/* Resources Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 self-start">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Package className="h-6 w-6 text-indigo-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Resource Inventory</h2>
          </div>

          <div className="space-y-4">
            {shelter.resources?.map((res: any) => {
              const isLow = res.quantity <= res.lowStockThreshold;
              return (
                <div key={res.id} className={`p-4 rounded-lg border ${isLow ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-gray-900">{res.resourceType}</span>
                    {isLow && <span className="text-xs text-red-600 font-bold bg-red-100 px-2 py-1 rounded-full">Low Stock</span>}
                  </div>
                  <p className="text-xs text-gray-500 mb-3">Threshold: {res.lowStockThreshold} {res.unit}</p>
                  
                  <div className="flex items-center gap-4 justify-between">
                    <span className="text-sm text-gray-700 font-medium">{res.unit}</span>
                    <input 
                      type="number" 
                      className="block w-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-1 border text-right"
                      defaultValue={res.quantity}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value);
                        if (val !== res.quantity) handleResourceUpdate(res.id, val);
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Volunteer Shifts Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 self-start md:col-span-2">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Manage Volunteer Shifts</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold text-gray-800 mb-4">Create New Shift</h3>
              <form onSubmit={handleCreateShift} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Start Time</label>
                  <input type="datetime-local" name="startTime" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">End Time</label>
                  <input type="datetime-local" name="endTime" required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Required Volunteers</label>
                  <input type="number" name="requiredCount" min="1" defaultValue={1} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" />
                </div>
                <button type="submit" className="w-full py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 transition-colors">Create Shift</button>
              </form>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-4">Upcoming Shifts</h3>
              <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                {shifts?.map(shift => (
                  <div key={shift.id} className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-semibold text-gray-900">
                        {new Date(shift.startTime).toLocaleString()} - {new Date(shift.endTime).toLocaleTimeString()}
                      </p>
                      <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded font-medium">
                        {shift.assignments?.length || 0} / {shift.requiredCount} Filled
                      </span>
                    </div>
                    {shift.assignments && shift.assignments.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-gray-500 mb-1 uppercase">Volunteers:</p>
                        <div className="flex flex-wrap gap-1">
                          {shift.assignments.map((a: any) => (
                            <span key={a.id} className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-700">
                              {a.volunteer.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {(!shifts || shifts.length === 0) && (
                  <p className="text-sm text-gray-500">No shifts scheduled.</p>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
