import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, User as UserIcon } from 'lucide-react';
import clsx from 'clsx';
import { getDemoUsers } from '../../api/auth';
import { getErrorMessage } from '../../api/client';
import type { DemoUser, Role } from '../../api/types';
import { useAuth } from '../../context/AuthContext';
import { HOME_FOR_ROLE } from '../../nav';
import { useLoad } from '../../hooks/useLoad';
import { ErrorState, PageLoader, useToast } from '../../components/ui';

const roleStyle: Record<Role, string> = {
  ADMIN: 'bg-purple-100 text-purple-700',
  COORDINATOR: 'bg-blue-100 text-blue-700',
  VOLUNTEER: 'bg-green-100 text-green-700',
};

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data: users, loading, error, reload } = useLoad<DemoUser[]>(getDemoUsers, []);

  const choose = async (u: DemoUser) => {
    setBusyId(u.id);
    try {
      const me = await login(u);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from.startsWith(`/${me.role.toLowerCase()}`) ? from : HOME_FOR_ROLE[me.role], { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Login failed'));
    } finally {
      setBusyId(null);
    }
  };

  const grouped = (['ADMIN', 'COORDINATOR', 'VOLUNTEER'] as Role[]).map((role) => ({ role, users: (users ?? []).filter((u) => u.role === role) }));

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <ShieldCheck className="mx-auto h-12 w-12 text-blue-600" />
        <h1 className="mt-4 text-3xl font-extrabold text-gray-900">Staff sign-in</h1>
        <p className="mt-2 text-sm text-gray-600">Demo authentication — pick a local user. There are no passwords in this prototype.</p>
      </div>

      {loading && <PageLoader label="Loading demo users…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      <div className="space-y-6">
        {grouped.map(
          (g) =>
            g.users.length > 0 && (
              <section key={g.role} aria-label={g.role}>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{g.role.toLowerCase()}s</h2>
                <div className="space-y-2">
                  {g.users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => choose(u)}
                      disabled={busyId !== null}
                      className="w-full flex items-center justify-between gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors text-left disabled:opacity-60"
                    >
                      <span className="flex items-center gap-3">
                        <span className="p-2 bg-gray-100 rounded-full">
                          <UserIcon className="h-4 w-4 text-gray-600" />
                        </span>
                        <span className="font-medium text-gray-900">{u.name}</span>
                      </span>
                      <span className={clsx('text-xs font-bold px-2.5 py-1 rounded-full', roleStyle[u.role])}>{busyId === u.id ? 'Signing in…' : u.role}</span>
                    </button>
                  ))}
                </div>
              </section>
            )
        )}
      </div>
    </div>
  );
}
