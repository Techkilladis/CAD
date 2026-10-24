import { useEffect, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { getStaffShelter, saveTranslation } from '../api/shelters';
import { getErrorMessage } from '../api/client';
import type { ShelterTranslation } from '../api/types';
import { useLoad } from '../hooks/useLoad';
import { Button, Card, CardBody, CardHeader, ErrorState, Input, PageLoader, Tabs, Textarea, useToast, type TabItem } from '../components/ui';

const LOCALE_NAMES: Record<string, string> = { en: 'English', ta: 'தமிழ் (Tamil)', hi: 'हिन्दी (Hindi)', te: 'తెలుగు (Telugu)', ml: 'മലയാളം (Malayalam)' };

/** Edit shelter name / description / arrival instructions per locale. Locales are data: any valid code can be added. */
export function TranslationEditor({ shelterId }: { shelterId: string }) {
  const toast = useToast();
  const { data, loading, error, reload } = useLoad(() => getStaffShelter(shelterId), [shelterId]);
  const [locales, setLocales] = useState<string[]>([]);
  const [active, setActive] = useState('en');
  const [form, setForm] = useState({ name: '', description: '', instructions: '' });
  const [newLocale, setNewLocale] = useState('');
  const [localeError, setLocaleError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const stored = (loc: string): ShelterTranslation | undefined => data?.translations?.find((t) => t.locale === loc);

  useEffect(() => {
    if (!data) return;
    const have = (data.translations ?? []).map((t) => t.locale);
    setLocales((cur) => Array.from(new Set(['en', 'ta', ...have, ...cur])));
  }, [data]);

  useEffect(() => {
    const t = stored(active);
    setForm({ name: t?.name ?? '', description: t?.description ?? '', instructions: t?.instructions ?? '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, data]);

  const addLocale = () => {
    const code = newLocale.trim().toLowerCase();
    if (!/^[a-z]{2,3}(-[a-z]{2,4})?$/.test(code)) {
      setLocaleError('Use a language code such as hi, te or ta');
      return;
    }
    setLocaleError(null);
    setLocales((cur) => Array.from(new Set([...cur, code])));
    setActive(code);
    setNewLocale('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveTranslation(shelterId, active, { name: form.name.trim() || null, description: form.description.trim() || null, instructions: form.instructions.trim() || null });
      toast.success(`${LOCALE_NAMES[active] ?? active} translation saved`);
      await reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save translation'));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) return <PageLoader />;
  if (error || !data) return <ErrorState message={error ?? 'Could not load translations'} onRetry={reload} />;

  const tabs: TabItem<string>[] = locales.map((l) => ({ key: l, label: LOCALE_NAMES[l] ?? l.toUpperCase() }));

  return (
    <Card>
      <CardHeader title="Translations" subtitle="Shown on the public shelter page when a visitor picks that language. Missing fields fall back to the base text." />
      <CardBody>
        <Tabs tabs={tabs} active={active} onChange={setActive} />
        <form onSubmit={submit} className="space-y-4 mt-4 max-w-2xl" noValidate>
          <Input label="Shelter name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={data.name} />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Textarea label="Arrival instructions" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
          <Button type="submit" loading={saving}>Save {LOCALE_NAMES[active] ?? active}</Button>
        </form>
        <div className="mt-6 pt-4 border-t border-gray-100 flex items-end gap-2 max-w-sm">
          <Input label="Add a language" value={newLocale} onChange={(e) => setNewLocale(e.target.value)} placeholder="e.g. hi" error={localeError ?? undefined} />
          <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={addLocale}>Add</Button>
        </div>
      </CardBody>
    </Card>
  );
}
