import { useEffect, useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import { createShift, updateShift } from '../api/volunteers';
import { getErrorMessage, getFieldErrors } from '../api/client';
import type { Shift } from '../api/types';
import { Button, Input, Modal, Select, Textarea, useToast } from '../components/ui';

const local = (iso: string) => format(new Date(iso), "yyyy-MM-dd'T'HH:mm");
const defaultStart = () => {
  const d = new Date(Date.now() + 3600_000);
  d.setMinutes(0, 0, 0);
  return d;
};

/** Create (shelterId given) or edit (shift given) a volunteer shift. */
export function ShiftForm({
  open, onClose, onSaved, shelterId, shift, shelterOptions,
}: { open: boolean; onClose: () => void; onSaved: () => void; shelterId?: string | null; shift?: Shift | null; shelterOptions?: { id: string; name: string }[] }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [task, setTask] = useState('');
  const [notes, setNotes] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [count, setCount] = useState('2');
  const [pick, setPick] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (shift) {
      setTitle(shift.title);
      setTask(shift.task ?? '');
      setNotes(shift.notes ?? '');
      setStart(local(shift.startTime));
      setEnd(local(shift.endTime));
      setCount(String(shift.requiredCount));
    } else {
      const s = defaultStart();
      setTitle('');
      setTask('');
      setNotes('');
      setStart(format(s, "yyyy-MM-dd'T'HH:mm"));
      setEnd(format(new Date(s.getTime() + 4 * 3600_000), "yyyy-MM-dd'T'HH:mm"));
      setCount('2');
    }
    setPick(shelterOptions?.[0]?.id ?? '');
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shift]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const targetShelter = shelterOptions ? pick : shelterId;
    if (!shift && !targetShelter) errs.shelterId = 'Choose a shelter';
    if (!title.trim()) errs.title = 'Title is required';
    const s = new Date(start);
    const en = new Date(end);
    if (!start || Number.isNaN(s.getTime())) errs.startTime = 'Choose a start time';
    if (!end || Number.isNaN(en.getTime())) errs.endTime = 'Choose an end time';
    if (!errs.startTime && !errs.endTime && s >= en) errs.endTime = 'End time must be after start time';
    if (!errs.endTime && en <= new Date()) errs.endTime = 'Shift must end in the future';
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1) errs.requiredCount = 'At least 1 volunteer is required';
    if (shift && n < shift.filledCount) errs.requiredCount = `${shift.filledCount} volunteers have already signed up`;
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      const body = { title: title.trim(), task: task.trim() || null, notes: notes.trim() || null, startTime: s.toISOString(), endTime: en.toISOString(), requiredCount: n };
      if (shift) await updateShift(shift.id, body);
      else await createShift({ ...body, shelterId: targetShelter! });
      toast.success(shift ? 'Shift updated' : 'Shift created');
      onSaved();
      onClose();
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err, 'Could not save shift'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={shift ? 'Edit shift' : 'Create shift'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="shift-form" loading={saving}>{shift ? 'Save changes' : 'Create shift'}</Button>
        </>
      }
    >
      <form id="shift-form" onSubmit={submit} className="space-y-4" noValidate>
        {!shift && shelterOptions && (
          <Select label="Shelter" value={pick} onChange={(e) => setPick(e.target.value)} error={errors.shelterId}>
            {shelterOptions.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
          </Select>
        )}
        <Input label="Title" required value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} placeholder="e.g. Evening meal service" />
        <Input label="Task" value={task} onChange={(e) => setTask(e.target.value)} error={errors.task} placeholder="e.g. Food distribution" />
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Starts" required type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} error={errors.startTime} />
          <Input label="Ends" required type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} error={errors.endTime} />
        </div>
        <Input label="Volunteers needed" required type="number" min={1} value={count} onChange={(e) => setCount(e.target.value)} error={errors.requiredCount} />
        <Textarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} error={errors.notes} />
      </form>
    </Modal>
  );
}
