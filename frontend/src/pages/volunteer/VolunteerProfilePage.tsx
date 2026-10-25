import { useState, type FormEvent } from 'react';
import { updateMe } from '../../api/auth';
import { getErrorMessage, getFieldErrors } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Button, Card, CardBody, Input, useToast } from '../../components/ui';
import { PageHeader } from '../../components/PageHeader';

export function VolunteerProfilePage() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', phone: '', skills: '', languages: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [prevUser, setPrevUser] = useState<typeof user>(user);

  if (user !== prevUser) {
    setPrevUser(user);
    if (user) setForm({ name: user.name, phone: user.phone ?? '', skills: user.skills ?? '', languages: user.languages ?? '' });
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (form.phone && !/^[+\d][\d\s()-]{5,}$/.test(form.phone.trim())) errs.phone = 'Enter a valid phone number';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await updateMe({ name: form.name.trim(), phone: form.phone.trim() || null, skills: form.skills.trim() || null, languages: form.languages.trim() || null });
      await refresh();
      toast.success('Profile saved');
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err, 'Could not save profile'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="My profile" subtitle="Coordinators see your phone, skills and languages when you sign up for a shift." />
      <Card className="max-w-xl">
        <CardBody>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Input label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
            <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} />
            <Input label="Skills" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} error={errors.skills} placeholder="First aid, driving, counselling…" />
            <Input label="Languages" value={form.languages} onChange={(e) => setForm({ ...form, languages: e.target.value })} error={errors.languages} placeholder="ta, en, hi" />
            <Button type="submit" loading={saving}>Save profile</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
