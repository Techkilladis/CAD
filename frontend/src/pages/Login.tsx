import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUsers } from '../api/client';
import { useAuth, type User } from '../context/AuthContext';
import { ShieldAlert, User as UserIcon } from 'lucide-react';

export const Login = () => {
  const [demoUsers, setDemoUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    getUsers()
      .then((res) => {
        setDemoUsers(res.data);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = (user: User) => {
    login(user);
    if (user.role === 'ADMIN') {
      navigate('/admin');
    } else if (user.role === 'COORDINATOR') {
      navigate('/coordinator');
    } else {
      navigate('/');
    }
  };

  if (loading) return <div className="text-center p-8 text-gray-500">Loading demo users...</div>;

  return (
    <div className="min-h-[80vh] flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-blue-600" />
        <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Sign in to SafeHaven</h2>
        <p className="mt-2 text-sm text-gray-600">Local MVP Demo Authentication</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-200">
          <p className="text-sm text-gray-500 mb-6 text-center">Select a demo role below to continue.</p>
          <div className="space-y-4">
            {demoUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => handleLogin(u)}
                className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-gray-100 rounded-full group-hover:bg-blue-100 transition-colors">
                    <UserIcon className="h-5 w-5 text-gray-600 group-hover:text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{u.name}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </div>
                </div>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                  u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                  u.role === 'COORDINATOR' ? 'bg-blue-100 text-blue-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {u.role}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
