import { useEffect, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { createUser, listUsers, updateUser } from '../../api/admin';
import { getErrorMessage, getFieldErrors } from '../../api/client';
import type { AdminUser, Role } from '../../api/types';
import { useAuth } from '../../context/AuthContext';
import { useLoad } from '../../hooks/useLoad';
import { Button, Card, ConfirmDialog, DataTable, ErrorState, Input, Modal, PageLoader, RefreshBar, Select, StatusBadge, useToast, type Column } from '../../components/ui';
import { PageHeader } from '../../components/PageHeader';

const ROLES: Role[] = ['ADMIN', 'COORDINATOR', 'VOLUNTEER'];

function UserForm({ open, user, onClose, onSaved }: { open: boolean; user: AdminUser | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: '', email: '', role: 'VOLUNTEER' as Role, phone: '', skills: '', languages: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF(user ? { name: user.name, email: user.email, role: user.role, phone: user.phone ?? '', skills: user.skills ?? '', languages: user.languages ?? '' } : { name: '', email: '', role: 'VOLUNTEER', phone: '', skills: '', languages: '' });
    setErrors({});
  }, [open, user]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!f.name.trim()) errs.name = 'Name is required';
    if (!/^\S+@\S+\.\S{2,}$/.test(f.email.trim())) errs.email = 'Enter a valid email address';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const body = { name: f.name.trim(), email: f.email.trim(), role: f.role, phone: f.phone.trim() || null, skills: f.skills.trim() || null, languages: f.languages.trim() || null };
      if (user) await updateUser(user.id, body);
      else await createUser(body);
      toast.success(user ? 'User updated' : 'User created');
      onSaved();
      onClose();
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err, 'Could not save user'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={user ? `Edit ${user.name}` : 'Create user'} footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form="user-form" loading={saving}>{user ? 'Save' : 'Create user'}</Button></>}>
      <form id="user-form" onSubmit={submit} className="space-y-4" noValidate>
        <Input label="Name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={errors.name} />
        <Input label="Email" required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} error={errors.email} />
        <Select label="Role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })} error={errors.role}>
          {ROLES.map((r) => (<option key={r} value={r}>{r.toLowerCase()}</option>))}
        </Select>
        <Input label="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} error={errors.phone} />
        <Input label="Skills" value={f.skills} onChange={(e) => setF({ ...f, skills: e.target.value })} error={errors.skills} />
        <Input label="Languages" value={f.languages} onChange={(e) => setF({ ...f, languages: e.target.value })} error={errors.languages} />
      </form>
    </Modal>
  );
}

export function AdminUsersPage() {
  const toast = useToast();
  const { user: me } = useAuth();
  const { data, loading, error, reload, loadedAt } = useLoad(listUsers, []);
  const [editing, setEditing] = useState<AdminUser | 'new' | null>(null);
  const [toggle, setToggle] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);

  const doToggle = async () => {
    if (!toggle) return;
    setBusy(true);
    try {
      await updateUser(toggle.id, { isActive: !toggle.isActive });
      toast.success(`${toggle.name} ${toggle.isActive ? 'deactivated' : 'activated'}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not change user'));
    } finally {
      setBusy(false);
      setToggle(null);
      void reload();
    }
  };

  const columns: Column<AdminUser>[] = [
    { key: 'name', header: 'Name', sortValue: (u) => u.name.toLowerCase(), render: (u) => (<div><p className="font-medium text-gray-900">{u.name}{u.id === me?.id && <span className="ml-1 text-xs text-gray-400">(you)</span>}</p><p className="text-xs text-gray-500">{u.email}</p></div>) },
    { key: 'role', header: 'Role', sortValue: (u) => u.role, render: (u) => <span className="text-sm capitalize">{u.role.toLowerCase()}</span> },
    { key: 'shelters', header: 'Shelters', render: (u) => (u.shelters?.length ? <span className="text-xs">{u.shelters.map((s) => s.name).join(', ')}</span> : <span className="text-gray-300">—</span>) },
    { key: 'status', header: 'Status', sortValue: (u) => String(u.isActive), render: (u) => <StatusBadge status={u.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
    { key: 'actions', header: '', className: 'text-right', render: (u) => (<div className="flex justify-end gap-1"><Button size="sm" variant="secondary" onClick={() => setEditing(u)}>Edit</Button><Button size="sm" variant="ghost" onClick={() => setToggle(u)} disabled={u.id === me?.id}>{u.isActive ? 'Deactivate' : 'Activate'}</Button></div>) },
  ];

  return (
    <div>
      <PageHeader title="Users" subtitle="Demo accounts — no passwords. Deactivated users cannot sign in." actions={<><RefreshBar asOf={loadedAt} onRefresh={reload} loading={loading} /><Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>New user</Button></>} />
      {loading && !data && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && <Card><DataTable columns={columns} rows={data} rowKey={(u) => u.id} initialSort={{ key: 'role', dir: 'asc' }} /></Card>}
      <UserForm open={editing !== null} user={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => void reload()} />
      <ConfirmDialog open={!!toggle} danger={!!toggle?.isActive} title={toggle?.isActive ? 'Deactivate user?' : 'Activate user?'} confirmLabel={toggle?.isActive ? 'Deactivate' : 'Activate'} loading={busy} onCancel={() => setToggle(null)} onConfirm={doToggle}
        message={toggle && (toggle.isActive ? <>{toggle.name} will no longer be able to sign in. Their history is kept.</> : <>{toggle.name} will be able to sign in again.</>)} />
    </div>
  );
}
