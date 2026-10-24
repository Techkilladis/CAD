import { useEffect, useState, type FormEvent } from 'react';
import { getSettings, updateSettings } from '../../api/admin';
import { getErrorMessage } from '../../api/client';
import type { SettingsPayload } from '../../api/types';
import { useLoad } from '../../hooks/useLoad';
import { Button, Card, CardBody, CardHeader, ErrorState, Input, PageLoader, useToast } from '../../components/ui';
import { PageHeader } from '../../components/PageHeader';

type Key = keyof SettingsPayload['settings'];
const KEYS: Key[] = ['overcrowdingThreshold', 'criticalMedicalCount', 'transferSurplusMultiplier', 'alertScanIntervalMs'];

export function AdminSettingsPage() {
  const toast = useToast();
  const { data, loading, error, reload } = useLoad(getSettings, []);
  const [form, setForm] = useState<Record<Key, string>>({ overcrowdingThreshold: '', criticalMedicalCount: '', transferSurplusMultiplier: '', alertScanIntervalMs: '' });
  const [errors, setErrors] = useState<Partial<Record<Key, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(Object.fromEntries(KEYS.map((k) => [k, String(data.settings[k])])) as Record<Key, string>);
  }, [data]);

  if (loading && !data) return <PageLoader />;
  if (error || !data) return <ErrorState message={error ?? 'Could not load settings'} onRetry={reload} />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Partial<Record<Key, string>> = {};
    const patch: Partial<SettingsPayload['settings']> = {};
    for (const k of KEYS) {
      const rule = data.rules[k];
      const n = Number(form[k]);
      if (form[k].trim() === '' || !Number.isFinite(n)) errs[k] = 'Enter a number';
      else if (n < rule.min || n > rule.max) errs[k] = `Must be between ${rule.min} and ${rule.max}`;
      else if (rule.integer && !Number.isInteger(n)) errs[k] = 'Must be a whole number';
      else if (n !== data.settings[k]) patch[k] = n;
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (Object.keys(patch).length === 0) {
      toast.info('No changes to save');
      return;
    }
    setSaving(true);
    try {
      await updateSettings(patch);
      toast.success('Settings saved — alerts use the new thresholds on the next evaluation or run-check');
      await reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save settings'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Alert thresholds and the status of each integration seam" />
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Alert engine" />
          <CardBody>
            <form onSubmit={submit} className="space-y-4" noValidate>
              {KEYS.map((k) => (
                <Input key={k} label={data.rules[k].label} type="number" step={k === 'overcrowdingThreshold' ? '0.01' : '1'} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} error={errors[k]} hint={`Allowed: ${data.rules[k].min} – ${data.rules[k].max}`} />
              ))}
              <Button type="submit" loading={saving}>Save settings</Button>
            </form>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Integrations" subtitle="Local implementation today, AWS replacement later" />
          <ul className="divide-y divide-gray-100">
            {data.integrations.map((i) => (
              <li key={i.name} className="px-5 py-3 text-sm">
                <p className="font-medium text-gray-900">{i.name}</p>
                <p className="text-gray-600">Now: {i.local}</p>
                <p className="text-xs text-gray-400">AWS: {i.aws}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
