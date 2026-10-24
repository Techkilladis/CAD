import { useEffect, useState, type FormEvent } from 'react';
import { createShelter, updateShelter } from '../api/shelters';
import { getDemoUsers } from '../api/auth';
import { getErrorMessage, getFieldErrors } from '../api/client';
import type { DemoUser, ShelterInput, ShelterStatus, StaffShelter } from '../api/types';
import { SHELTER_STATUSES } from '../api/types';
import { Button, Checkbox, Input, Modal, Select, Textarea, useToast } from '../components/ui';

interface FormState {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  capacityTotal: string;
  coordinatorId: string;
  status: ShelterStatus;
  description: string;
  contactInfo: string;
  contactPhone: string;
  contactEmail: string;
  medicalSupport: boolean;
}

const empty: FormState = {
  name: '', address: '', latitude: '', longitude: '', capacityTotal: '', coordinatorId: '', status: 'ACTIVE',
  description: '', contactInfo: '', contactPhone: '', contactEmail: '', medicalSupport: false,
};

const fromShelter = (s: StaffShelter): FormState => ({
  name: s.name, address: s.address, latitude: String(s.latitude), longitude: String(s.longitude),
  capacityTotal: String(s.capacityTotal), coordinatorId: s.coordinatorId ?? '', status: s.status,
  description: s.description ?? '', contactInfo: s.contactInfo ?? '', contactPhone: s.contactPhone ?? '',
  contactEmail: s.contactEmail ?? '', medicalSupport: s.medicalSupport,
});

function validate(f: FormState, minCapacity: number): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.name.trim()) e.name = 'Name is required';
  if (!f.address.trim()) e.address = 'Address is required';
  const lat = Number(f.latitude);
  const lng = Number(f.longitude);
  if (f.latitude === '' || Number.isNaN(lat) || lat < -90 || lat > 90) e.latitude = 'Latitude must be between -90 and 90';
  if (f.longitude === '' || Number.isNaN(lng) || lng < -180 || lng > 180) e.longitude = 'Longitude must be between -180 and 180';
  const cap = Number(f.capacityTotal);
  if (!Number.isInteger(cap) || cap < 1) e.capacityTotal = 'Capacity must be a whole number of at least 1';
  else if (cap < minCapacity) e.capacityTotal = `Capacity cannot be lower than current occupancy (${minCapacity})`;
  if (f.contactEmail && !/^\S+@\S+\.\S+$/.test(f.contactEmail)) e.contactEmail = 'Enter a valid email address';
  return e;
}

/** Admin create/edit (all fields) in a drawer. Saves via POST/PATCH /shelters and tells the parent to refresh. */
export function ShelterForm({
  open, shelter, onClose, onSaved,
}: { open: boolean; shelter: StaffShelter | null; onClose: () => void; onSaved: (s: StaffShelter) => void }) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [coordinators, setCoordinators] = useState<DemoUser[]>([]);

  useEffect(() => {
    if (!open) return;
    setForm(shelter ? fromShelter(shelter) : empty);
    setErrors({});
    getDemoUsers()
      .then((u) => setCoordinators(u.filter((x) => x.role === 'COORDINATOR')))
      .catch((e) => toast.error(getErrorMessage(e, 'Could not load coordinators')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shelter]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate(form, shelter?.capacityOccupied ?? 0);
    setErrors(found);
    if (Object.keys(found).length) return;

    const payload: ShelterInput = {
      name: form.name.trim(),
      address: form.address.trim(),
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      capacityTotal: Number(form.capacityTotal),
      coordinatorId: form.coordinatorId || null,
      status: form.status,
      description: form.description.trim() || null,
      contactInfo: form.contactInfo.trim() || null,
      contactPhone: form.contactPhone.trim() || null,
      contactEmail: form.contactEmail.trim() || null,
      medicalSupport: form.medicalSupport,
    };
    setSaving(true);
    try {
      const saved = shelter ? await updateShelter(shelter.id, payload) : await createShelter(payload);
      toast.success(shelter ? 'Shelter updated' : 'Shelter created');
      onSaved(saved as StaffShelter);
      onClose();
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err, 'Could not save shelter'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      variant="drawer"
      title={shelter ? `Edit ${shelter.name}` : 'Create shelter'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="shelter-form" loading={saving}>
            {shelter ? 'Save changes' : 'Create shelter'}
          </Button>
        </>
      }
    >
      <form id="shelter-form" onSubmit={submit} className="space-y-4" noValidate>
        <Input label="Name" required value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} />
        <Input label="Address" required value={form.address} onChange={(e) => set('address', e.target.value)} error={errors.address} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Latitude" required inputMode="decimal" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} error={errors.latitude} />
          <Input label="Longitude" required inputMode="decimal" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} error={errors.longitude} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Total capacity (beds)"
            required
            type="number"
            min={1}
            value={form.capacityTotal}
            onChange={(e) => set('capacityTotal', e.target.value)}
            error={errors.capacityTotal}
            hint={shelter ? `Currently occupied: ${shelter.capacityOccupied}` : undefined}
          />
          <Select label="Status" value={form.status} onChange={(e) => set('status', e.target.value as ShelterStatus)} error={errors.status}>
            {SHELTER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ').toLowerCase()}
              </option>
            ))}
          </Select>
        </div>
        <Select label="Coordinator" value={form.coordinatorId} onChange={(e) => set('coordinatorId', e.target.value)} error={errors.coordinatorId}>
          <option value="">— Unassigned —</option>
          {coordinators.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Textarea label="Description" value={form.description} onChange={(e) => set('description', e.target.value)} error={errors.description} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Contact phone" value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} error={errors.contactPhone} />
          <Input label="Contact email" type="email" value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} error={errors.contactEmail} />
        </div>
        <Input label="Contact note" value={form.contactInfo} onChange={(e) => set('contactInfo', e.target.value)} error={errors.contactInfo} />
        <Checkbox label="Has medical support on site" checked={form.medicalSupport} onChange={(v) => set('medicalSupport', v)} />
      </form>
    </Modal>
  );
}
