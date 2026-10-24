import { useState, useEffect } from 'react';
import { getShelters, getNearestShelters, register } from '../api/client';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Users, HeartPulse, X } from 'lucide-react';
import clsx from 'clsx';

// Fix leaflet icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export const ShelterFinder = () => {
  const [shelters, setShelters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<{lat: number, lon: number} | null>(null);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [selectedShelter, setSelectedShelter] = useState<any>(null);
  const [regForm, setRegForm] = useState({
    personName: '', familySize: 1, childrenCount: 0, elderlyCount: 0,
    pregnantFlag: false, disabledFlag: false, medicalFlag: false, emergencyNotes: ''
  });

  useEffect(() => {
    fetchShelters();
  }, []);

  const fetchShelters = async () => {
    try {
      setLoading(true);
      const { data } = await getShelters();
      setShelters(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const findNearest = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setLocation({ lat, lon });
        try {
          setLoading(true);
          const { data } = await getNearestShelters(lat, lon);
          setShelters(data);
        } catch {
          console.error("Failed to fetch nearest shelters");
        } finally {
          setLoading(false);
        }
      }, () => {
        alert("Could not get location.");
      });
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShelter) return;
    try {
      await register(selectedShelter.id, regForm);
      alert('Registration request submitted! Please proceed to the shelter for confirmation.');
      setRegisterModalOpen(false);
      setRegForm({ personName: '', familySize: 1, childrenCount: 0, elderlyCount: 0, pregnantFlag: false, disabledFlag: false, medicalFlag: false, emergencyNotes: '' });
      fetchShelters(); // refresh capacities
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit registration');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Find a Shelter</h1>
          <p className="text-gray-500 mt-1">Locate nearby facilities with available capacity.</p>
        </div>
        <button
          onClick={findNearest}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <MapPin className="mr-2 h-4 w-4" />
          Find Nearest to Me
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {loading ? (
            <div className="text-center py-10 text-gray-500">Loading shelters...</div>
          ) : shelters.length === 0 ? (
            <div className="text-center py-10 text-gray-500">No shelters found.</div>
          ) : (
            shelters.map(shelter => {
              const isFull = shelter.availableCapacity <= 0;
              const isCritical = shelter.availableCapacity > 0 && shelter.availableCapacity <= 10;
              return (
                <div key={shelter.id} className={clsx("bg-white p-5 rounded-xl border shadow-sm transition-all hover:shadow-md", 
                  isFull ? "border-red-200" : isCritical ? "border-yellow-200" : "border-gray-200"
                )}>
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-semibold text-gray-900">{shelter.name}</h3>
                    {shelter.distance !== undefined && (
                      <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        {shelter.distance.toFixed(1)} km
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1 flex items-center">
                    <MapPin className="h-4 w-4 mr-1" /> {shelter.address}
                  </p>
                  
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-2 rounded-lg flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Capacity</p>
                        <p className="font-semibold text-gray-900">{shelter.capacityOccupied} / {shelter.capacityTotal}</p>
                      </div>
                    </div>
                    <div className={clsx("p-2 rounded-lg flex items-center gap-2",
                      isFull ? "bg-red-50" : isCritical ? "bg-yellow-50" : "bg-green-50"
                    )}>
                      <HeartPulse className={clsx("h-4 w-4", 
                        isFull ? "text-red-500" : isCritical ? "text-yellow-600" : "text-green-600"
                      )} />
                      <div>
                        <p className={clsx("text-xs", isFull ? "text-red-500" : isCritical ? "text-yellow-600" : "text-green-600")}>Available</p>
                        <p className={clsx("font-semibold", isFull ? "text-red-700" : isCritical ? "text-yellow-800" : "text-green-700")}>
                          {shelter.availableCapacity}
                        </p>
                      </div>
                    </div>
                  </div>
                  {!isFull && (
                    <button 
                      onClick={() => { setSelectedShelter(shelter); setRegisterModalOpen(true); }}
                      className="mt-4 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Register Family
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
        
        <div className="lg:col-span-2 h-[70vh] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden z-0">
          <MapContainer center={[34.0522, -118.2437]} zoom={11} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {location && (
              <Marker position={[location.lat, location.lon]}>
                <Popup>You are here</Popup>
              </Marker>
            )}
            {shelters.map(shelter => (
              <Marker key={shelter.id} position={[shelter.latitude, shelter.longitude]}>
                <Popup>
                  <strong>{shelter.name}</strong><br/>
                  Available: {shelter.availableCapacity} / {shelter.capacityTotal}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      {registerModalOpen && selectedShelter && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-bold text-gray-900">Register at {selectedShelter.name}</h2>
              <button onClick={() => setRegisterModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              <form id="register-form" onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Family Name / Primary Contact</label>
                  <input type="text" required value={regForm.personName} onChange={e => setRegForm({...regForm, personName: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Total Size</label>
                    <input type="number" min="1" required value={regForm.familySize} onChange={e => setRegForm({...regForm, familySize: parseInt(e.target.value)})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Children</label>
                    <input type="number" min="0" value={regForm.childrenCount} onChange={e => setRegForm({...regForm, childrenCount: parseInt(e.target.value) || 0})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Elderly</label>
                    <input type="number" min="0" value={regForm.elderlyCount} onChange={e => setRegForm({...regForm, elderlyCount: parseInt(e.target.value) || 0})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" />
                  </div>
                </div>
                <div className="space-y-2 mt-4">
                  <p className="block text-sm font-medium text-gray-700">Special Needs</p>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center space-x-2"><input type="checkbox" checked={regForm.medicalFlag} onChange={e => setRegForm({...regForm, medicalFlag: e.target.checked})} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" /><span className="text-sm text-gray-700">Medical</span></label>
                    <label className="flex items-center space-x-2"><input type="checkbox" checked={regForm.pregnantFlag} onChange={e => setRegForm({...regForm, pregnantFlag: e.target.checked})} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" /><span className="text-sm text-gray-700">Pregnant</span></label>
                    <label className="flex items-center space-x-2"><input type="checkbox" checked={regForm.disabledFlag} onChange={e => setRegForm({...regForm, disabledFlag: e.target.checked})} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" /><span className="text-sm text-gray-700">Disabled</span></label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Emergency Notes</label>
                  <textarea value={regForm.emergencyNotes} onChange={e => setRegForm({...regForm, emergencyNotes: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" />
                </div>
              </form>
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <button type="button" onClick={() => setRegisterModalOpen(false)} className="mr-3 px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">Cancel</button>
              <button type="submit" form="register-form" className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">Submit Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
