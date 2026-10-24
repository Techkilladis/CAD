import { useState } from 'react';
import { reportMissingPerson } from '../api/legacy';
import { Users, AlertCircle, CheckCircle, Search } from 'lucide-react';

export const Reunification = () => {
  const [formData, setFormData] = useState({
    missingPersonName: '',
    age: '',
    gender: '',
    lastKnownLocation: '',
    contactPerson: '',
    contactInfo: '',
    description: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await reportMissingPerson({
        ...formData,
        age: formData.age ? parseInt(formData.age) : null
      });
      setResult(res.data);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to report missing person');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 w-full">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Report Submitted Successfully</h2>
          <p className="text-gray-600 mb-8">Case ID: {result.case.id}</p>
          
          {result.potentialMatches && result.potentialMatches.length > 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-8 text-left">
              <div className="flex items-center gap-2 text-yellow-800 font-bold mb-4">
                <AlertCircle className="h-6 w-6" />
                Potential Matches Found!
              </div>
              <p className="text-sm text-yellow-700 mb-4">We found individuals matching this name currently checked into our shelters.</p>
              <div className="space-y-4">
                {result.potentialMatches.map((match: any) => (
                  <div key={match.id} className="bg-white p-4 rounded-lg border border-yellow-100 shadow-sm flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900">{match.personName}</p>
                      <p className="text-sm text-gray-600">Shelter: {match.shelter.name}</p>
                      <p className="text-sm text-gray-600">{match.shelter.contactInfo}</p>
                    </div>
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full uppercase tracking-wider">
                      Currently Checked-in
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-yellow-800 mt-4 font-medium">Please contact the shelter directly for verification. The authorities have been notified of this potential match.</p>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
              <div className="flex items-center gap-2 text-blue-800 font-bold mb-2 justify-center">
                <Search className="h-5 w-5" />
                Search Active
              </div>
              <p className="text-blue-700">We do not currently have a match in our shelter network. We will keep this case open and notify you if a match is found during future check-ins.</p>
            </div>
          )}

          <button 
            onClick={() => { setResult(null); setFormData({ missingPersonName: '', age: '', gender: '', lastKnownLocation: '', contactPerson: '', contactInfo: '', description: ''}); }}
            className="px-6 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Report Another Person
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-full mb-4">
          <Users className="h-8 w-8 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Reunification & Missing Persons</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          If you have lost contact with a loved one during the emergency, submit their details here. We will instantly cross-reference our district-wide shelter manifest to check if they are safe.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-2">Missing Person Details</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700">Full Name *</label>
              <input type="text" required value={formData.missingPersonName} onChange={e => setFormData({...formData, missingPersonName: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" placeholder="John Doe" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Age</label>
                <input type="number" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Gender</label>
                <input type="text" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Last Known Location</label>
              <input type="text" value={formData.lastKnownLocation} onChange={e => setFormData({...formData, lastKnownLocation: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Physical Description / Notes</label>
              <textarea rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" placeholder="Wearing a red jacket..."></textarea>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-2">Your Contact Information</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700">Your Full Name *</label>
              <input type="text" required value={formData.contactPerson} onChange={e => setFormData({...formData, contactPerson: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Contact Number / Email *</label>
              <input type="text" required value={formData.contactInfo} onChange={e => setFormData({...formData, contactInfo: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" />
            </div>
          </div>

          <div className="pt-4">
            <button type="submit" disabled={loading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">
              {loading ? 'Submitting...' : 'Submit Missing Person Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
