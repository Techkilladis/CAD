import { useEffect, useState, type FormEvent } from 'react';
import { getStaffShelter, updateShelter } from '../../api/shelters';
import { getErrorMessage, getFieldErrors } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLoad } from '../../hooks/useLoad';
import { Button, Card, CardBody, CardHeader, Checkbox, EmptyState, ErrorState, Input, PageLoader, Select, Textarea, useToast } from '../../components/ui';
import { PageHeader } from '../../components/PageHeader';
import { TranslationEditor } from '../../features/TranslationEditor';

/** Coordinator-editable shelter fields only: description, contact, medical support, ACTIVE<->FULL. */
export function CoordinatorShelterPage() {
  const toast = useToast();
  const { selectedShelterId, refresh } = useAuth();
  const { data: s, loading, error, reload } = useLoad(() => getStaffShelter(selectedShelterId!), [selectedShelterId], { enabled: !!selectedShelterId });
  const [form, setForm] = useState({ description: '', contactPhone: '', contactEmail: '', contactInfo: '', medicalSupport: false, status: 'ACTIVE' as string });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (s) setForm({ description: s.description ?? '', contactPhone: s.contactPhone ?? '', contactEmail: s.contactEmail ?? '', contactInfo: s.contactInfo ?? '', medicalSupport: s.medicalSupport, status: s.status });
  }, [s]);

  if (!selectedShelterId) return <EmptyState title="No shelter assigned" />;
  if (loading && !s) return <PageLoader />;
  if (error || !s) return <ErrorState message={error ?? 'Could not load shelter'} onRetry={reload} />;

  const canToggleStatus = s.status === 'ACTIVE' || s.status === 'FULL';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.contactEmail && !/^\S+@\S+\.\S+$/.test(form.contactEmail)) errs.contactEmail = 'Enter a valid email address';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await updateShelter(s.id, {
        description: form.description.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        contactEmail: form.contactEmail.trim() || null,
        contactInfo: form.contactInfo.trim() || null,
        medicalSupport: form.medicalSupport,
        ...(canToggleStatus && form.status !== s.status ? { status: form.status as 'ACTIVE' | 'FULL' } : {}),
      });
      toast.success('Shelter settings saved');
      await reload();
      await refresh();
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err, 'Could not save settings'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Shelter settings" subtitle={`${s.name} — name, address and capacity are managed by administrators`} />
      <Card className="max-w-2xl">
        <CardHeader title="Public information" />
        <CardBody>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} error={errors.description} />
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Contact phone" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} error={errors.contactPhone} />
              <Input label="Contact email" type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} error={errors.contactEmail} />
            </div>
            <Input label="Contact note" value={form.contactInfo} onChange={(e) => setForm({ ...form, contactInfo: e.target.value })} error={errors.contactInfo} />
            <Checkbox label="Medical support available on site" checked={form.medicalSupport} onChange={(v) => setForm({ ...form, medicalSupport: v })} />
            <Select
              label="Operating status"
              value={form.status}
              disabled={!canToggleStatus}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              hint={canToggleStatus ? 'Mark FULL to stop new registrations manually.' : 'Only an administrator can change the status of a closed or inactive shelter.'}
            >
              {canToggleStatus ? (
                <>
                  <option value="ACTIVE">Active</option>
                  <option value="FULL">Full</option>
                </>
              ) : (
                <option value={s.status}>{s.status.replace('_', ' ').toLowerCase()}</option>
              )}
            </Select>
            <Button type="submit" loading={saving}>
              Save settings
            </Button>
          </form>
        </CardBody>
      </Card>
      <div className="mt-6"><TranslationEditor key={s.id} shelterId={s.id} /></div>
    </div>
  );
}
