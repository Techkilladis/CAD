import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Mail, MapPin, Phone, Stethoscope } from 'lucide-react';
import { getPublicShelter } from '../../api/shelters';
import { useLoad } from '../../hooks/useLoad';
import { Card, CardBody, CardHeader, ErrorState, PageLoader, RefreshBar, StatusBadge } from '../../components/ui';
import { OccupancyBar } from '../../components/OccupancyBar';
import { ShelterMap } from '../../features/ShelterMap';
import { RESOURCE_LABEL } from '../../lib/format';
import { useLang } from '../../context/LangContext';

export function ShelterDetailPage() {
  const { id = '' } = useParams();
  const { lang, t } = useLang();

  const { data: s, loading, error, reload, loadedAt } = useLoad(() => getPublicShelter(id, lang), [id, lang]);

  if (loading && !s) return <PageLoader label="Loading shelter…" />;
  if (error || !s)
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <ErrorState message={error ?? 'Shelter not found'} onRetry={reload} />
        <Link to="/shelters" className="inline-block mt-4 text-blue-600 underline text-sm">
          Back to shelter list
        </Link>
      </div>
    );

  const name = s.translation?.name || s.name;
  const description = s.translation?.description || s.description;
  const canRegister = s.status === 'ACTIVE' && s.availableCapacity > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <Link to="/shelters" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mb-4">
        <ArrowLeft className="h-4 w-4" /> All shelters
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{name}</h1>
          <p className="flex items-center gap-1 text-gray-600 mt-1">
            <MapPin className="h-4 w-4" /> {s.address}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={s.status} />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardBody>
              <OccupancyBar occupied={s.capacityOccupied} total={s.capacityTotal} />
              <p className="mt-2 text-sm text-gray-700">
                <strong>{s.availableCapacity}</strong> {t('bedsFree')}
              </p>
              {description && <p className="mt-4 text-gray-700">{description}</p>}
              {lang !== 'en' && !s.translation && <p className="mt-3 text-xs text-amber-700">{t('fallbackNote')}</p>}
              {s.medicalSupport && (
                <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-green-700">
                  <Stethoscope className="h-4 w-4" /> Medical support on site
                </p>
              )}
              {s.translation?.instructions && (
                <div className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
                  <p className="font-semibold mb-1">{t('instructions')}</p>
                  {s.translation.instructions}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('supplies')} subtitle="Stock levels only — exact quantities are not published" />
            <CardBody className="grid sm:grid-cols-2 gap-3">
              {s.resources.map((r) => (
                <div key={r.resourceType} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                  <span className="text-sm font-medium text-gray-800">{RESOURCE_LABEL[r.resourceType]}</span>
                  <StatusBadge status={r.stockStatus} />
                </div>
              ))}
              {s.resources.length === 0 && <p className="text-sm text-gray-500">No supply information published.</p>}
            </CardBody>
          </Card>

          <ShelterMap shelters={[s]} height={260} />
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title={t('contact')} />
            <CardBody className="space-y-2 text-sm">
              {s.contactPhone && (
                <a href={`tel:${s.contactPhone}`} className="flex items-center gap-2 text-gray-700 hover:text-blue-600">
                  <Phone className="h-4 w-4" /> {s.contactPhone}
                </a>
              )}
              {s.contactEmail && (
                <a href={`mailto:${s.contactEmail}`} className="flex items-center gap-2 text-gray-700 hover:text-blue-600 break-all">
                  <Mail className="h-4 w-4" /> {s.contactEmail}
                </a>
              )}
              {s.contactInfo && <p className="text-gray-600">{s.contactInfo}</p>}
            </CardBody>
          </Card>

          {canRegister ? (
            <Link to={`/shelters/${s.id}/register`} className="block text-center rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700">
              {t('registerFamily')}
            </Link>
          ) : (
            <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
              {s.status === 'FULL' || s.availableCapacity === 0
                ? 'This shelter is full. Please choose another shelter.'
                : 'This shelter is not accepting registrations right now.'}
            </p>
          )}
          <RefreshBar asOf={loadedAt} onRefresh={reload} loading={loading} />
        </aside>
      </div>
    </div>
  );
}
