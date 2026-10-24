import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Phone, Search, ShieldAlert, UserSearch } from 'lucide-react';
import { listAlerts } from '../../api/alerts';
import { listShelters } from '../../api/shelters';
import { publicSearch, reportMissing } from '../../api/reunification';
import { getErrorMessage, getFieldErrors } from '../../api/client';
import type { PublicCaseHit } from '../../api/types';
import { useLoad } from '../../hooks/useLoad';
import { Button, Card, CardBody, CardHeader, Input, RefreshBar, Select, StatusBadge, Textarea, useToast } from '../../components/ui';

const HOTLINES = [
  { name: 'National emergency number', number: '112' },
  { name: 'Ambulance', number: '108' },
  { name: 'Fire & rescue', number: '101' },
  { name: 'Police', number: '100' },
  { name: 'Disaster management helpline', number: '1070' },
];

function ReportForm() {
  const toast = useToast();
  const shelters = useLoad(() => listShelters(), []);
  const [f, setF] = useState({ name: '', age: '', gender: '', location: '', shelterId: '', contactPerson: '', contactInfo: '', description: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ id: string; message: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (f.name.trim().length < 2) errs.missingPersonName = 'Enter the missing person’s name';
    if (f.age !== '' && (!Number.isInteger(Number(f.age)) || Number(f.age) < 0 || Number(f.age) > 120)) errs.age = 'Age must be between 0 and 120';
    if (!f.contactPerson.trim()) errs.contactPerson = 'Enter your name';
    if (f.contactInfo.trim().length < 5) errs.contactInfo = 'Enter a phone number or email where we can reach you';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const r = await reportMissing({
        missingPersonName: f.name.trim(),
        age: f.age === '' ? null : Number(f.age),
        gender: f.gender.trim() || null,
        lastKnownLocation: f.location.trim() || null,
        lastKnownShelterId: f.shelterId || null,
        contactPerson: f.contactPerson.trim(),
        contactInfo: f.contactInfo.trim(),
        description: f.description.trim() || null,
      });
      setDone({ id: r.id, message: r.message });
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err, 'Could not submit the report'));
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <CardBody className="text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
        <h3 className="mt-2 text-lg font-semibold">Report received</h3>
        <p className="text-sm text-gray-600 mt-1">{done.message}</p>
        <p className="mt-3 text-xs text-gray-500">
          Case reference: <code className="font-semibold">{done.id.slice(0, 8).toUpperCase()}</code>
        </p>
        <Button className="mt-4" variant="secondary" onClick={() => { setDone(null); setF({ name: '', age: '', gender: '', location: '', shelterId: '', contactPerson: '', contactInfo: '', description: '' }); }}>
          Report another person
        </Button>
      </CardBody>
    );
  }

  return (
    <CardBody>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid sm:grid-cols-3 gap-3">
          <Input wrapperClassName="sm:col-span-2" label="Missing person’s full name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={errors.missingPersonName} />
          <Input label="Age" type="number" min={0} max={120} value={f.age} onChange={(e) => setF({ ...f, age: e.target.value })} error={errors.age} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Gender (optional)" value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })} />
          <Input label="Last known location" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
        </div>
        <Select label="Last known shelter (optional)" value={f.shelterId} onChange={(e) => setF({ ...f, shelterId: e.target.value })}>
          <option value="">Not sure / none</option>
          {(shelters.data ?? []).map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
        </Select>
        <Textarea label="Description (clothing, features, medical needs)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} error={errors.description} />
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Your name" required value={f.contactPerson} onChange={(e) => setF({ ...f, contactPerson: e.target.value })} error={errors.contactPerson} />
          <Input label="Your phone or email" required value={f.contactInfo} onChange={(e) => setF({ ...f, contactInfo: e.target.value })} error={errors.contactInfo} hint="Only shelter staff can see this." />
        </div>
        <Button type="submit" loading={saving}>Submit report</Button>
      </form>
    </CardBody>
  );
}

function PublicSearch() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<PublicCaseHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 2) {
      setError('Enter at least 2 characters');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      setHits(await publicSearch(q.trim()));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Search failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <CardBody>
      <form onSubmit={search} className="flex gap-2 items-end" noValidate>
        <Input wrapperClassName="flex-1" label="Search reported cases by name" value={q} onChange={(e) => setQ(e.target.value)} error={error ?? undefined} />
        <Button type="submit" loading={busy} icon={<Search className="h-4 w-4" />}>Search</Button>
      </form>
      <p className="text-xs text-gray-500 mt-2">For privacy this only searches cases that have already been reported. It never shows who is staying in a shelter or anyone&rsquo;s contact details.</p>
      {hits && (
        <ul className="mt-4 divide-y divide-gray-100">
          {hits.length === 0 && <li className="py-3 text-sm text-gray-500">No reported case matches. If you are looking for someone, please file a report.</li>}
          {hits.map((h) => (
            <li key={h.id} className="py-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-gray-900">{h.missingPersonName}{h.age !== null && <span className="text-gray-500 font-normal"> · age {h.age}</span>}</p>
                {h.lastKnownShelterName && <p className="text-xs text-gray-500">Last known: {h.lastKnownShelterName}</p>}
              </div>
              <StatusBadge status={h.status} />
            </li>
          ))}
        </ul>
      )}
    </CardBody>
  );
}

export function EmergencyPage() {
  const notices = useLoad(() => listAlerts({ status: 'ACTIVE' }), []);
  const closed = useLoad(() => listShelters({ status: 'EMERGENCY_CLOSED' }), []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3"><ShieldAlert className="h-8 w-8 text-red-600" /> Emergency information</h1>
        <p className="text-gray-600 mt-1">If you or someone near you is in immediate danger, call the emergency services first.</p>
      </div>

      <Card>
        <CardHeader title="Emergency contacts" />
        <CardBody className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {HOTLINES.map((h) => (
            <a key={h.number} href={`tel:${h.number}`} className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 hover:border-blue-400 hover:bg-blue-50">
              <Phone className="h-5 w-5 text-blue-600" />
              <span><span className="block text-xl font-bold text-gray-900">{h.number}</span><span className="text-xs text-gray-600">{h.name}</span></span>
            </a>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Current shelter notices" subtitle="Latest recorded status — not live" actions={<RefreshBar asOf={notices.loadedAt} onRefresh={() => { void notices.reload(); void closed.reload(); }} loading={notices.loading} />} />
        <CardBody>
          {notices.error && <p className="text-sm text-red-600">{notices.error}</p>}
          <ul className="space-y-2">
            {(notices.data ?? []).map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-sm">
                <StatusBadge status={a.alertType === 'FULL_SHELTER' ? 'FULL' : 'CRITICAL'} className="shrink-0" />
                <Link to={`/shelters/${a.shelter.id}`} className="font-medium text-blue-700 hover:underline">{a.shelter.name}</Link>
                <span className="text-gray-600">{a.alertType === 'FULL_SHELTER' ? 'is full — please choose another shelter' : 'is nearly full'}</span>
              </li>
            ))}
            {(closed.data ?? []).map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <StatusBadge status="EMERGENCY_CLOSED" className="shrink-0" />
                <span className="font-medium">{s.name}</span>
                <span className="text-gray-600">is closed — do not travel here</span>
              </li>
            ))}
            {notices.data && notices.data.length === 0 && (closed.data ?? []).length === 0 && <li className="text-sm text-gray-500">No full, crowded or closed shelters right now.</li>}
          </ul>
          <Link to="/shelters" className="inline-block mt-4 text-sm font-medium text-blue-600 hover:underline">Find a shelter with space →</Link>
        </CardBody>
      </Card>

      <div className="grid lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader title="Report a missing person" subtitle="Shelter staff will check their records" actions={<UserSearch className="h-5 w-5 text-gray-400" />} />
          <ReportForm />
        </Card>
        <Card>
          <CardHeader title="Check a reported case" />
          <PublicSearch />
        </Card>
      </div>
    </div>
  );
}
