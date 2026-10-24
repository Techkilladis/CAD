import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Copy } from 'lucide-react';
import { getPublicShelter } from '../../api/shelters';
import { registerFamily } from '../../api/checkins';
import type { RegistrationReceipt } from '../../api/types';
import { useLoad } from '../../hooks/useLoad';
import { Button, Card, CardBody, ErrorState, PageLoader, useToast } from '../../components/ui';
import { OccupantForm } from '../../features/OccupantForm';

export function RegisterPage() {
  const { id = '' } = useParams();
  const toast = useToast();
  const { data: shelter, loading, error, reload } = useLoad(() => getPublicShelter(id), [id]);
  const [receipt, setReceipt] = useState<RegistrationReceipt | null>(null);

  if (loading && !shelter) return <PageLoader />;
  if (error || !shelter) return <div className="max-w-xl mx-auto px-4 py-10"><ErrorState message={error ?? 'Shelter not found'} onRetry={reload} /></div>;

  if (receipt) {
    return (
      <div className="max-w-xl mx-auto px-4 py-10">
        <Card>
          <CardBody className="text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-green-600" />
            <h1 className="mt-3 text-2xl font-bold text-gray-900">Registration received</h1>
            <p className="mt-1 text-gray-600">
              Show this code at the front desk of <strong>{receipt.shelterName}</strong> to complete check-in.
            </p>
            <div className="mt-5 inline-flex items-center gap-3 rounded-xl bg-gray-100 px-6 py-4">
              <code className="text-3xl font-bold tracking-widest text-gray-900">{receipt.referenceCode}</code>
              <button
                aria-label="Copy code"
                className="p-2 rounded-lg hover:bg-gray-200"
                onClick={() => navigator.clipboard?.writeText(receipt.referenceCode).then(() => toast.success('Code copied'), () => toast.error('Could not copy — please write the code down'))}
              >
                <Copy className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Your beds are <strong>not reserved</strong> until staff confirm your arrival. Please come as soon as it is safe to do so.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link to={`/shelters/${receipt.shelterId}`} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">
                Back to shelter
              </Link>
              <Link to="/shelters" className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                Find another shelter
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  const blocked = shelter.status !== 'ACTIVE' || shelter.availableCapacity === 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link to={`/shelters/${shelter.id}`} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mb-4">
        <ArrowLeft className="h-4 w-4" /> {shelter.name}
      </Link>
      <h1 className="text-2xl font-bold text-gray-900">Register your family</h1>
      <p className="text-gray-600 mt-1 mb-6">
        {shelter.name} · {shelter.availableCapacity} beds free. Registering lets staff prepare for your arrival.
      </p>
      {blocked ? (
        <div className="space-y-3">
          <ErrorState message="This shelter is not accepting registrations right now (full or closed)." />
          <Button variant="secondary" onClick={() => window.history.back()}>
            Go back
          </Button>
        </div>
      ) : (
        <Card>
          <CardBody>
            <OccupantForm
              idPrefix="register"
              submitLabel="Submit registration"
              onSubmit={async (data) => {
                const { criticalMedical: _c, ...publicData } = data;
                void _c;
                setReceipt(await registerFamily(shelter.id, publicData));
              }}
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
