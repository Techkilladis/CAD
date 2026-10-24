import { useState, useEffect } from 'react';
import { getShifts, signUpForShift, cancelSignup } from '../api/client';
import { Calendar, Clock, MapPin, Check, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const VolunteerDashboard = () => {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    try {
      setLoading(true);
      const { data } = await getShifts();
      setShifts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (shiftId: string) => {
    try {
      await signUpForShift(shiftId);
      alert('Successfully signed up for shift!');
      fetchShifts();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to sign up');
    }
  };

  const handleCancel = async (shiftId: string) => {
    if (!confirm('Are you sure you want to cancel your signup for this shift?')) return;
    try {
      await cancelSignup(shiftId);
      alert('Shift cancelled successfully.');
      fetchShifts();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to cancel shift');
    }
  };

  if (loading && shifts.length === 0) return <div className="p-8 text-center text-gray-500">Loading shifts...</div>;

  const myShifts = shifts.filter(s => s.assignments.some((a: any) => a.volunteerId === user?.id));
  const availableShifts = shifts.filter(s => !s.assignments.some((a: any) => a.volunteerId === user?.id) && s.assignments.length < s.requiredCount);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <div className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-bold text-gray-900">Volunteer Dashboard</h1>
        <p className="text-gray-500 mt-2">Manage your volunteer shifts and sign up to help.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center"><Calendar className="w-5 h-5 mr-2 text-indigo-600"/> My Upcoming Shifts</h2>
          <div className="space-y-4">
            {myShifts.map(shift => (
              <div key={shift.id} className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-indigo-900 text-lg">{shift.shelter.name}</h3>
                  <span className="px-3 py-1 bg-indigo-200 text-indigo-800 text-xs font-bold uppercase rounded-full tracking-wider">Signed Up</span>
                </div>
                <div className="space-y-2 mb-4">
                  <p className="text-sm text-indigo-800 flex items-center"><MapPin className="w-4 h-4 mr-2 text-indigo-500"/> {shift.shelter.address}</p>
                  <p className="text-sm text-indigo-800 flex items-center"><Clock className="w-4 h-4 mr-2 text-indigo-500"/> {new Date(shift.startTime).toLocaleString()} - {new Date(shift.endTime).toLocaleTimeString()}</p>
                </div>
                <button onClick={() => handleCancel(shift.id)} className="w-full py-2 bg-white border border-indigo-300 text-indigo-700 rounded-lg hover:bg-indigo-100 font-medium transition-colors text-sm flex justify-center items-center">
                  <X className="w-4 h-4 mr-2" /> Cancel Signup
                </button>
              </div>
            ))}
            {myShifts.length === 0 && (
              <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <p className="text-gray-500">You have no upcoming shifts.</p>
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center"><Clock className="w-5 h-5 mr-2 text-green-600"/> Available Shifts</h2>
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {availableShifts.map(shift => (
              <div key={shift.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:border-green-300 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-gray-900 text-lg">{shift.shelter.name}</h3>
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {shift.assignments.length} / {shift.requiredCount} Filled
                  </span>
                </div>
                <div className="space-y-2 mb-4">
                  <p className="text-sm text-gray-600 flex items-center"><MapPin className="w-4 h-4 mr-2 text-gray-400"/> {shift.shelter.address}</p>
                  <p className="text-sm text-gray-600 flex items-center"><Clock className="w-4 h-4 mr-2 text-gray-400"/> {new Date(shift.startTime).toLocaleString()} - {new Date(shift.endTime).toLocaleTimeString()}</p>
                </div>
                <button onClick={() => handleSignup(shift.id)} className="w-full py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg hover:bg-green-100 font-bold transition-colors text-sm flex justify-center items-center">
                  <Check className="w-4 h-4 mr-2" /> Sign Up to Help
                </button>
              </div>
            ))}
            {availableShifts.length === 0 && (
              <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <p className="text-gray-500">No shifts are currently available.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
