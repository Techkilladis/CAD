import { useState } from 'react';
import { Link2, Phone } from 'lucide-react';
import { listCases, updateCase } from '../api/reunification';
import { getErrorMessage } from '../api/client';
import type { ReunificationCase, ReunificationStatus } from '../api/types';
import { useLoad } from '../hooks/useLoad';
import { Button, Card, CardBody, EmptyState, ErrorState, Modal, PageLoader, RefreshBar, SearchInput, Select, StatusBadge, Textarea, useToast } from '../components/ui';
import { fmtAgo } from '../lib/format';

const STATUSES: ReunificationStatus[] = ['MISSING', 'POTENTIAL_MATCH', 'REUNITED', 'CLOSED'];

function CaseModal({ c, onClose, onSaved }: { c: ReunificationCase | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [status, setStatus] = useState<ReunificationStatus>('MISSING');
  const [notes, setNotes] = useState('');
  const [matchId, setMatchId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);

  if (c && c.id !== lastId) {
    setLastId(c.id);
    setStatus(c.status);
    setNotes(c.staffNotes ?? '');
    setMatchId(c.matchedCheckinId ?? '');
  }
  if (!c && lastId) setLastId(null);

  const save = async () => {
    if (!c) return;
    setSaving(true);
    try {
      await updateCase(c.id, {
        status,
        staffNotes: notes.trim() || null,
        matchedCheckinId: matchId || null,
      });
      toast.success('Case updated');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not update case'));
    } finally {
      setSaving(false);
    }
  };

  const options = c ? [...(c.matchedCheckin ? [{ id: c.matchedCheckin.id, personName: c.matchedCheckin.personName, shelter: c.matchedCheckin.shelter }] : []), ...c.candidates.filter((x) => x.id !== c.matchedCheckinId)] : [];

  return (
    <Modal
      open={!!c}
      onClose={onClose}
      title={c ? `Case: ${c.missingPersonName}` : ''}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} loading={saving}>Save case</Button>
        </>
      }
    >
      {c && (
        <div className="space-y-4">
          <dl className="grid grid-cols-3 gap-y-1 text-sm">
            <dt className="text-gray-500">Reporter</dt><dd className="col-span-2">{c.contactPerson} · {c.contactInfo}</dd>
            <dt className="text-gray-500">Last known</dt><dd className="col-span-2">{c.lastKnownShelter?.name ?? c.lastKnownLocation ?? '—'}</dd>
            {c.description && (<><dt className="text-gray-500">Description</dt><dd className="col-span-2">{c.description}</dd></>)}
          </dl>
          <Select label="Link an occupant (candidates from your shelters)" value={matchId} onChange={(e) => setMatchId(e.target.value)}>
            <option value="">No linked occupant</option>
            {options.map((o) => (<option key={o.id} value={o.id}>{o.personName} — {o.shelter.name}</option>))}
          </Select>
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as ReunificationStatus)}>
            {STATUSES.map((s) => (<option key={s} value={s}>{s.replace('_', ' ').toLowerCase()}</option>))}
          </Select>
          <Textarea label="Staff notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      )}
    </Modal>
  );
}

/** Staff board: search, status filter, candidate occupant matches, link + status update. */
export function ReunificationBoard() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<ReunificationStatus | ''>('');
  const [editing, setEditing] = useState<ReunificationCase | null>(null);
  const { data, loading, error, reload, loadedAt } = useLoad(() => listCases({ q: q.trim() || undefined, status: status || undefined }), [q, status]);

  const quickLink = async (c: ReunificationCase, checkinId: string) => {
    try {
      await updateCase(c.id, { matchedCheckinId: checkinId });
      toast.success('Occupant linked — case is now a potential match');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not link occupant'));
    } finally {
      void reload();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search by name or reporter" className="w-72" />
        <div className="w-48">
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as ReunificationStatus | '')}>
            <option value="">All</option>
            {STATUSES.map((s) => (<option key={s} value={s}>{s.replace('_', ' ').toLowerCase()}</option>))}
          </Select>
        </div>
        <div className="ml-auto"><RefreshBar asOf={loadedAt} onRefresh={reload} loading={loading} /></div>
      </div>
      {loading && !data && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && data.length === 0 && <Card><EmptyState title="No cases" message="Reports filed through the public emergency page appear here." /></Card>}
      <div className="grid lg:grid-cols-2 gap-4">
        {data?.map((c) => (
          <Card key={c.id}>
            <CardBody>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{c.missingPersonName}{c.age !== null && <span className="font-normal text-gray-500"> · {c.age}</span>}</h3>
                  <p className="text-xs text-gray-500">Reported {fmtAgo(c.createdAt)}{c.lastKnownShelter ? ` · last at ${c.lastKnownShelter.name}` : c.lastKnownLocation ? ` · ${c.lastKnownLocation}` : ''}</p>
                </div>
                <StatusBadge status={c.status} />
              </div>
              <p className="mt-2 text-sm text-gray-700 flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-gray-400" />{c.contactPerson} · {c.contactInfo}</p>
              {c.description && <p className="mt-1 text-sm text-gray-600">{c.description}</p>}
              {c.matchedCheckin && (
                <p className="mt-2 text-sm rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <Link2 className="inline h-3.5 w-3.5 mr-1" />Linked: <strong>{c.matchedCheckin.personName}</strong> at {c.matchedCheckin.shelter.name}
                </p>
              )}
              {c.candidates.length > 0 && !c.matchedCheckin && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Possible occupants</p>
                  <ul className="space-y-1">
                    {c.candidates.map((x) => (
                      <li key={x.id} className="flex items-center justify-between gap-2 text-sm">
                        <span>{x.personName} <span className="text-gray-500">· {x.shelter.name} · {x.familySize} people</span></span>
                        <Button size="sm" variant="secondary" onClick={() => quickLink(c, x.id)}>Link</Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {c.staffNotes && <p className="mt-2 text-xs italic text-gray-500">Notes: {c.staffNotes}</p>}
              <div className="mt-3 flex justify-end"><Button size="sm" onClick={() => setEditing(c)}>Update case</Button></div>
            </CardBody>
          </Card>
        ))}
      </div>
      <CaseModal c={editing} onClose={() => setEditing(null)} onSaved={reload} />
    </div>
  );
}
