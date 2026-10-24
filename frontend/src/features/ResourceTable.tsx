import { useState, type FormEvent } from 'react';
import { History, Pencil, Plus } from 'lucide-react';
import { createResource, getMovements, updateResource } from '../api/resources';
import { getErrorMessage, getFieldErrors } from '../api/client';
import type { Resource, ResourceType, StockMovement } from '../api/types';
import { RESOURCE_TYPES } from '../api/types';
import { Button, DataTable, Input, Modal, Select, StatusBadge, Textarea, useToast, type Column } from '../components/ui';
import { fmtDateTime, RESOURCE_LABEL } from '../lib/format';
import { useLoad } from '../hooks/useLoad';

type Mode = 'set' | 'adjust';

export type EditableResource = Pick<Resource, 'id' | 'resourceType' | 'quantity' | 'unit' | 'lowStockThreshold'>;

export function UpdateModal({
  shelterId, resource, onClose, onSaved,
}: { shelterId: string; resource: EditableResource | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('set');
  const [value, setValue] = useState('');
  const [threshold, setThreshold] = useState('');
  const [unit, setUnit] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);

  // Reset when a different resource is opened.
  if (resource && resource.id !== lastId) {
    setLastId(resource.id);
    setMode('set');
    setValue(String(resource.quantity));
    setThreshold(String(resource.lowStockThreshold));
    setUnit(resource.unit);
    setNote('');
    setErrors({});
  }
  if (!resource && lastId) setLastId(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!resource) return;
    const errs: Record<string, string> = {};
    const n = Number(value);
    if (value.trim() === '' || !Number.isInteger(n)) errs.value = 'Enter a whole number';
    else if (mode === 'set' && n < 0) errs.value = 'Quantity cannot be negative';
    else if (mode === 'adjust' && resource.quantity + n < 0) errs.value = `Cannot remove more than the ${resource.quantity} in stock`;
    const t = Number(threshold);
    if (!Number.isInteger(t) || t < 0) errs.threshold = 'Threshold must be 0 or more';
    if (!unit.trim()) errs.unit = 'Unit is required';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      await updateResource(shelterId, resource.id, {
        ...(mode === 'set' ? { quantity: n } : { delta: n }),
        lowStockThreshold: t,
        unit: unit.trim(),
        note: note.trim() || undefined,
      });
      toast.success(`${RESOURCE_LABEL[resource.resourceType]} updated`);
      onSaved();
      onClose();
    } catch (err) {
      const fe = getFieldErrors(err);
      setErrors({ value: fe.quantity || fe.delta || '', threshold: fe.lowStockThreshold || '', unit: fe.unit || '' });
      toast.error(getErrorMessage(err, 'Could not update stock'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!resource}
      onClose={onClose}
      title={resource ? `Update ${RESOURCE_LABEL[resource.resourceType]}` : ''}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="resource-form" loading={saving}>
            Save
          </Button>
        </>
      }
    >
      {resource && (
        <form id="resource-form" onSubmit={submit} className="space-y-4" noValidate>
          <div className="flex rounded-lg bg-gray-100 p-1 text-sm" role="group" aria-label="Update mode">
            {(['set', 'adjust'] as Mode[]).map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => {
                  setMode(m);
                  setValue(m === 'set' ? String(resource.quantity) : '');
                  setErrors({});
                }}
                className={`flex-1 rounded-md py-1.5 font-medium ${mode === m ? 'bg-white shadow text-blue-700' : 'text-gray-600'}`}
              >
                {m === 'set' ? 'Set exact quantity' : 'Add / remove'}
              </button>
            ))}
          </div>
          <Input
            label={mode === 'set' ? `New quantity (${resource.unit})` : `Change (${resource.unit}) — use a negative number to remove`}
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            error={errors.value}
            hint={`Current stock: ${resource.quantity} ${resource.unit}`}
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Low-stock threshold" type="number" min={0} value={threshold} onChange={(e) => setThreshold(e.target.value)} error={errors.threshold} />
            <Input label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} error={errors.unit} />
          </div>
          <Textarea label="Note (optional)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Delivery from district stores" />
        </form>
      )}
    </Modal>
  );
}

function AddModal({ shelterId, existing, open, onClose, onSaved }: { shelterId: string; existing: ResourceType[]; open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const available = RESOURCE_TYPES.filter((t) => !existing.includes(t));
  const [type, setType] = useState<ResourceType | ''>('');
  const [quantity, setQuantity] = useState('0');
  const [unit, setUnit] = useState('');
  const [threshold, setThreshold] = useState('10');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const chosen = type || available[0] || '';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!chosen) errs.type = 'No resource types left to add';
    const q = Number(quantity);
    if (!Number.isInteger(q) || q < 0) errs.quantity = 'Quantity must be 0 or more';
    if (!unit.trim()) errs.unit = 'Unit is required';
    const t = Number(threshold);
    if (!Number.isInteger(t) || t < 0) errs.threshold = 'Threshold must be 0 or more';
    setErrors(errs);
    if (Object.keys(errs).length || !chosen) return;
    setSaving(true);
    try {
      await createResource(shelterId, { resourceType: chosen, quantity: q, unit: unit.trim(), lowStockThreshold: t });
      toast.success(`${RESOURCE_LABEL[chosen]} added`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not add resource'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add resource"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="add-resource-form" loading={saving} disabled={!chosen}>
            Add
          </Button>
        </>
      }
    >
      <form id="add-resource-form" onSubmit={submit} className="space-y-4" noValidate>
        <Select label="Type" value={chosen} onChange={(e) => setType(e.target.value as ResourceType)} error={errors.type}>
          {available.map((t) => (
            <option key={t} value={t}>
              {RESOURCE_LABEL[t]}
            </option>
          ))}
        </Select>
        <Input label="Opening quantity" type="number" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} error={errors.quantity} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} error={errors.unit} placeholder="litres, kits…" />
          <Input label="Low-stock threshold" type="number" min={0} value={threshold} onChange={(e) => setThreshold(e.target.value)} error={errors.threshold} />
        </div>
      </form>
    </Modal>
  );
}

function HistoryDrawer({ shelterId, resource, onClose }: { shelterId: string; resource: Resource | null; onClose: () => void }) {
  const { data, loading, error } = useLoad<StockMovement[]>(
    () => (resource ? getMovements(shelterId, resource.id) : Promise.resolve([])),
    [shelterId, resource?.id],
    { enabled: !!resource }
  );
  return (
    <Modal open={!!resource} onClose={onClose} variant="drawer" title={resource ? `${RESOURCE_LABEL[resource.resourceType]} history` : ''}>
      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {data && data.length === 0 && <p className="text-sm text-gray-500">No stock movements recorded yet.</p>}
      <ul className="divide-y divide-gray-100">
        {data?.map((m) => (
          <li key={m.id} className="py-3 text-sm">
            <div className="flex justify-between">
              <span className={`font-semibold ${m.delta < 0 ? 'text-red-600' : 'text-green-700'}`}>
                {m.delta > 0 ? '+' : ''}
                {m.delta} {m.resource.unit}
              </span>
              <span className="text-gray-500 text-xs">{fmtDateTime(m.createdAt)}</span>
            </div>
            <p className="text-gray-600">
              {m.type.replace('_', ' ').toLowerCase()} → {m.quantityAfter} {m.resource.unit}
              {m.user ? ` · ${m.user.name}` : ''}
            </p>
            {m.note && <p className="text-gray-500 text-xs mt-0.5">{m.note}</p>}
          </li>
        ))}
      </ul>
    </Modal>
  );
}

/** Staff resource table with set/adjust, threshold edits, stock badges and movement history. */
export function ResourceTable({ shelterId, resources, onChanged, canEdit = true }: { shelterId: string; resources: Resource[]; onChanged: () => void; canEdit?: boolean }) {
  const [editing, setEditing] = useState<Resource | null>(null);
  const [history, setHistory] = useState<Resource | null>(null);
  const [adding, setAdding] = useState(false);
  const active = resources.filter((r) => r.isActive);

  const columns: Column<Resource>[] = [
    { key: 'type', header: 'Resource', sortValue: (r) => r.resourceType, render: (r) => <span className="font-medium text-gray-900">{RESOURCE_LABEL[r.resourceType]}</span> },
    { key: 'qty', header: 'In stock', sortValue: (r) => r.quantity, render: (r) => `${r.quantity.toLocaleString('en-IN')} ${r.unit}` },
    { key: 'thr', header: 'Low threshold', render: (r) => r.lowStockThreshold.toLocaleString('en-IN') },
    { key: 'status', header: 'Status', sortValue: (r) => r.quantity / Math.max(1, r.lowStockThreshold), render: (r) => <StatusBadge status={r.stockStatus} /> },
    { key: 'upd', header: 'Last updated', render: (r) => <span className="text-xs text-gray-500">{fmtDateTime(r.updatedAt)}</span> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          {canEdit && (
            <Button size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(r)}>
              Update
            </Button>
          )}
          <Button size="sm" variant="ghost" icon={<History className="h-3.5 w-3.5" />} onClick={() => setHistory(r)}>
            History
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      {canEdit && RESOURCE_TYPES.some((t) => !active.some((r) => r.resourceType === t)) && (
        <div className="flex justify-end p-3 border-b border-gray-100">
          <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAdding(true)}>
            Add resource
          </Button>
        </div>
      )}
      <DataTable columns={columns} rows={active} rowKey={(r) => r.id} emptyTitle="No resources tracked yet" emptyMessage="Add a resource to start tracking stock." />
      <UpdateModal shelterId={shelterId} resource={editing} onClose={() => setEditing(null)} onSaved={onChanged} />
      <AddModal shelterId={shelterId} existing={active.map((r) => r.resourceType)} open={adding} onClose={() => setAdding(false)} onSaved={onChanged} />
      <HistoryDrawer shelterId={shelterId} resource={history} onClose={() => setHistory(null)} />
    </>
  );
}
