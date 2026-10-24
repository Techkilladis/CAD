import { useEffect, useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import { createDonation } from '../api/donations';
import { getErrorMessage, getFieldErrors } from '../api/client';
import type { ResourceType } from '../api/types';
import { RESOURCE_TYPES } from '../api/types';
import { Button, Checkbox, Input, Modal, Select, Textarea, useToast } from '../components/ui';
import { RESOURCE_LABEL } from '../lib/format';

const DEFAULT_UNIT: Record<ResourceType, string> = { FOOD: 'meal packs', WATER: 'litres', MEDICINE: 'kits', BLANKETS: 'pieces' };

/** Record a donation. "Add to inventory now" accepts it immediately and updates stock in the same transaction. */
export function DonationForm({
  open, onClose, onSaved, shelters, defaultShelterId,
}: { open: boolean; onClose: () => void; onSaved: () => void; shelters: { id: string; name: string }[]; defaultShelterId?: string | null }) {
  const toast = useToast();
  const [shelterId, setShelterId] = useState('');
  const [donor, setDonor] = useState('');
  const [type, setType] = useState<ResourceType>('FOOD');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState(DEFAULT_UNIT.FOOD);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [receipt, setReceipt] = useState('');
  const [receiptFile, setReceiptFile] = useState('');
  const [notes, setNotes] = useState('');
  const [apply, setApply] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setShelterId(defaultShelterId ?? shelters[0]?.id ?? '');
      setErrors({});
    }
  }, [open, defaultShelterId, shelters]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!shelterId) errs.shelterId = 'Choose a shelter';
    if (!donor.trim()) errs.donorName = 'Donor name is required';
    const q = Number(quantity);
    if (!Number.isInteger(q) || q < 1) errs.quantity = 'Enter a whole number of at least 1';
    if (!unit.trim()) errs.unit = 'Unit is required';
    if (!date) errs.receivedDate = 'Choose the date received';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await createDonation({
        shelterId, donorName: donor.trim(), resourceType: type, quantity: q, unit: unit.trim(),
        receivedDate: new Date(date).toISOString(), notes: notes.trim() || null, receiptRef: receipt.trim() || null,
        receiptFileName: receiptFile.trim() || null, applyToInventory: apply,
      });
      toast.success(apply ? `Donation recorded and ${q} ${unit} added to stock` : 'Donation recorded as pending');
      setDonor(''); setQuantity(''); setReceipt(''); setReceiptFile(''); setNotes('');
      onSaved();
      onClose();
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err, 'Could not record donation'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record donation"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="donation-form" loading={saving}>Record donation</Button>
        </>
      }
    >
      <form id="donation-form" onSubmit={submit} className="space-y-4" noValidate>
        {shelters.length > 1 && (
          <Select label="Shelter" value={shelterId} onChange={(e) => setShelterId(e.target.value)} error={errors.shelterId}>
            {shelters.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </Select>
        )}
        <Input label="Donor name" required value={donor} onChange={(e) => setDonor(e.target.value)} error={errors.donorName} />
        <div className="grid grid-cols-3 gap-3">
          <Select label="Resource" value={type} onChange={(e) => { const t = e.target.value as ResourceType; setType(t); setUnit(DEFAULT_UNIT[t]); }}>
            {RESOURCE_TYPES.map((t) => (<option key={t} value={t}>{RESOURCE_LABEL[t]}</option>))}
          </Select>
          <Input label="Quantity" required type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} error={errors.quantity} />
          <Input label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} error={errors.unit} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Date received" type="date" max={format(new Date(), 'yyyy-MM-dd')} value={date} onChange={(e) => setDate(e.target.value)} error={errors.receivedDate} />
          <Input label="Receipt number" value={receipt} onChange={(e) => setReceipt(e.target.value)} error={errors.receiptRef} />
        </div>
        <Input label="Receipt file name (reference only)" value={receiptFile} onChange={(e) => setReceiptFile(e.target.value)} hint="Files are not uploaded in this prototype; only a reference is stored." />
        <Textarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} error={errors.notes} />
        <Checkbox label="Accept and add to inventory now" checked={apply} onChange={setApply} />
      </form>
    </Modal>
  );
}
