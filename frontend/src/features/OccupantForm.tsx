import { useState, type FormEvent } from 'react';
import { getErrorMessage, getFieldErrors } from '../api/client';
import type { OccupantInput } from '../api/types';
import { Button, Checkbox, Input, Textarea, useToast } from '../components/ui';

interface State {
  personName: string;
  familySize: string;
  phone: string;
  childrenCount: string;
  elderlyCount: string;
  pregnantFlag: boolean;
  disabledFlag: boolean;
  medicalFlag: boolean;
  criticalMedical: boolean;
  emergencyNotes: string;
  medicalNotes: string;
}

const initial: State = {
  personName: '', familySize: '1', phone: '', childrenCount: '0', elderlyCount: '0',
  pregnantFlag: false, disabledFlag: false, medicalFlag: false, criticalMedical: false, emergencyNotes: '', medicalNotes: '',
};

function validate(s: State, available: number | null): { errors: Record<string, string>; payload?: OccupantInput } {
  const errors: Record<string, string> = {};
  if (!s.personName.trim()) errors.personName = 'Head of family / contact name is required';
  const size = Number(s.familySize);
  if (!Number.isInteger(size) || size < 1) errors.familySize = 'Family size must be at least 1';
  else if (available !== null && size > available) errors.familySize = `Only ${available} bed(s) available`;
  const kids = Number(s.childrenCount);
  const old = Number(s.elderlyCount);
  if (!Number.isInteger(kids) || kids < 0) errors.childrenCount = 'Enter 0 or more';
  else if (kids > size) errors.childrenCount = 'Cannot exceed family size';
  if (!Number.isInteger(old) || old < 0) errors.elderlyCount = 'Enter 0 or more';
  else if (old > size) errors.elderlyCount = 'Cannot exceed family size';
  if (s.phone && !/^[+\d][\d\s()-]{5,}$/.test(s.phone.trim())) errors.phone = 'Enter a valid phone number';
  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    payload: {
      personName: s.personName.trim(),
      familySize: size,
      phone: s.phone.trim() || null,
      childrenCount: kids,
      elderlyCount: old,
      pregnantFlag: s.pregnantFlag,
      disabledFlag: s.disabledFlag,
      medicalFlag: s.medicalFlag,
      criticalMedical: s.criticalMedical,
      emergencyNotes: s.emergencyNotes.trim() || null,
      medicalNotes: s.medicalNotes.trim() || null,
    },
  };
}

/**
 * Family details form shared by staff check-in and public registration.
 * `capacity` (staff only) enables the live "occupancy after check-in" preview and blocks over-capacity entries.
 */
export function OccupantForm({
  capacity, allowCritical, submitLabel, onSubmit, idPrefix = 'occ',
}: {
  capacity?: { total: number; occupied: number };
  allowCritical?: boolean;
  submitLabel: string;
  onSubmit: (data: OccupantInput) => Promise<void>;
  idPrefix?: string;
}) {
  const toast = useToast();
  const [s, setS] = useState<State>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof State>(k: K, v: State[K]) => setS((cur) => ({ ...cur, [k]: v }));
  const available = capacity ? Math.max(0, capacity.total - capacity.occupied) : null;
  const size = Number(s.familySize);
  const after = capacity && Number.isInteger(size) && size > 0 ? capacity.occupied + size : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const { errors: found, payload } = validate(s, available);
    setErrors(found);
    if (!payload) return;
    setSaving(true);
    try {
      await onSubmit(payload);
      setS(initial);
      setErrors({});
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err, 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate id={`${idPrefix}-form`}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Input label="Head of family / contact name" required value={s.personName} onChange={(e) => set('personName', e.target.value)} error={errors.personName} />
        <Input label="Phone (optional)" inputMode="tel" value={s.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} />
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <Input label="Family size" required type="number" min={1} value={s.familySize} onChange={(e) => set('familySize', e.target.value)} error={errors.familySize} />
        <Input label="Children" type="number" min={0} value={s.childrenCount} onChange={(e) => set('childrenCount', e.target.value)} error={errors.childrenCount} />
        <Input label="Elderly (60+)" type="number" min={0} value={s.elderlyCount} onChange={(e) => set('elderlyCount', e.target.value)} error={errors.elderlyCount} />
      </div>

      {capacity && after !== null && (
        <p className={`text-sm rounded-lg px-3 py-2 ${after > capacity.total ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-800'}`} aria-live="polite">
          Occupancy after check-in: <strong>{after}/{capacity.total}</strong>
          {after > capacity.total && ' — exceeds capacity'}
        </p>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700 mb-1">Special needs</legend>
        <div className="grid sm:grid-cols-2 gap-2">
          <Checkbox label="Pregnant family member" checked={s.pregnantFlag} onChange={(v) => set('pregnantFlag', v)} />
          <Checkbox label="Person with disability" checked={s.disabledFlag} onChange={(v) => set('disabledFlag', v)} />
          <Checkbox label="Medical condition / medication" checked={s.medicalFlag} onChange={(v) => set('medicalFlag', v)} />
          {allowCritical && <Checkbox label="Critical medical case (urgent)" checked={s.criticalMedical} onChange={(v) => set('criticalMedical', v)} />}
        </div>
      </fieldset>

      <div className="grid sm:grid-cols-2 gap-4">
        <Textarea label="Medical notes" rows={2} value={s.medicalNotes} onChange={(e) => set('medicalNotes', e.target.value)} error={errors.medicalNotes} />
        <Textarea label="Other notes" rows={2} value={s.emergencyNotes} onChange={(e) => set('emergencyNotes', e.target.value)} error={errors.emergencyNotes} />
      </div>

      <Button type="submit" loading={saving} disabled={available !== null && available === 0}>
        {submitLabel}
      </Button>
      {available === 0 && <p className="text-sm text-red-600">This shelter has no free beds.</p>}
    </form>
  );
}
