import { useState, type FormEvent } from 'react';
import { createTransfer } from '../api/transfers';
import { listShelters } from '../api/shelters';
import { getErrorMessage, getFieldErrors } from '../api/client';
import type { PublicShelter, ResourceType } from '../api/types';
import { RESOURCE_TYPES } from '../api/types';
import { Button, Input, Modal, Select, Textarea, useToast } from '../components/ui';
import { useLoad } from '../hooks/useLoad';
import { RESOURCE_LABEL } from '../lib/format';

/**
 * New transfer request. `ownShelterId` (coordinators) pins one end to their shelter; the `direction`
 * toggle decides whether they are requesting stock from another shelter or sending stock out.
 */
export function TransferForm({
  open, onClose, onCreated, ownShelterId, defaultResource,
}: { open: boolean; onClose: () => void; onCreated: () => void; ownShelterId?: string | null; defaultResource?: ResourceType }) {
  const toast = useToast();
  const { data: shelters } = useLoad<PublicShelter[]>(() => listShelters({ status: undefined }), [], { enabled: open });
  const [direction, setDirection] = useState<'request' | 'send'>('request');
  const [other, setOther] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState<ResourceType>(defaultResource ?? 'WATER');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const options = (shelters ?? []).filter((s) => s.id !== ownShelterId);
  const sourceId = ownShelterId ? (direction === 'send' ? ownShelterId : other) : from;
  const destId = ownShelterId ? (direction === 'request' ? ownShelterId : other) : to;
  const sourceShelter = shelters?.find((s) => s.id === sourceId);
  const sourceStock = sourceShelter?.resources.find((r) => r.resourceType === type);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!sourceId) errs.fromShelterId = 'Choose the source shelter';
    if (!destId) errs.toShelterId = 'Choose the destination shelter';
    if (sourceId && sourceId === destId) errs.toShelterId = 'Source and destination must be different';
    const q = Number(quantity);
    if (!Number.isInteger(q) || q < 1) errs.quantity = 'Enter a whole number of at least 1';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await createTransfer({ fromShelterId: sourceId, toShelterId: destId, resourceType: type, quantity: q, reason: reason.trim() || null });
      toast.success('Transfer request submitted for approval');
      setQuantity('');
      setReason('');
      onCreated();
      onClose();
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err, 'Could not create transfer'));
    } finally {
      setSaving(false);
    }
  };

  const shelterSelect = (label: string, value: string, onChange: (v: string) => void, error?: string) => (
    <Select label={label} value={value} onChange={(e) => onChange(e.target.value)} error={error}>
      <option value="">Select shelter…</option>
      {options.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </Select>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New transfer request"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="transfer-form" loading={saving}>Submit request</Button>
        </>
      }
    >
      <form id="transfer-form" onSubmit={submit} className="space-y-4" noValidate>
        {ownShelterId ? (
          <>
            <div className="flex rounded-lg bg-gray-100 p-1 text-sm" role="group" aria-label="Direction">
              {(['request', 'send'] as const).map((d) => (
                <button type="button" key={d} onClick={() => setDirection(d)} className={`flex-1 rounded-md py-1.5 font-medium ${direction === d ? 'bg-white shadow text-blue-700' : 'text-gray-600'}`}>
                  {d === 'request' ? 'Request stock for my shelter' : 'Send stock from my shelter'}
                </button>
              ))}
            </div>
            {shelterSelect(direction === 'request' ? 'Request from' : 'Send to', other, setOther, errors.fromShelterId || errors.toShelterId)}
          </>
        ) : (
          <>
            {shelterSelect('From (source)', from, setFrom, errors.fromShelterId)}
            {shelterSelect('To (destination)', to, setTo, errors.toShelterId)}
          </>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Select label="Resource" value={type} onChange={(e) => setType(e.target.value as ResourceType)}>
            {RESOURCE_TYPES.map((t) => (
              <option key={t} value={t}>{RESOURCE_LABEL[t]}</option>
            ))}
          </Select>
          <Input label="Quantity" type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} error={errors.quantity} />
        </div>
        {sourceShelter && (
          <p className="text-xs text-gray-500">
            {sourceShelter.name} stock of {RESOURCE_LABEL[type].toLowerCase()}: {sourceStock ? sourceStock.stockStatus.toLowerCase() : 'not tracked'}. The server checks the exact available quantity.
          </p>
        )}
        <Textarea label="Reason (optional)" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </form>
    </Modal>
  );
}
