import { latLngBounds } from 'leaflet';
import { useEffect, useState } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { useLocale, useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { formatExactValue } from '@/lib/flows/display';
import { mapPoints } from '@/lib/flows/gis';

import { secondaryClass } from './FormParts';

import type { AnalyticsResult, ReportWidget } from '@/lib/flows/types';

const FitLocations = ({
  points,
  reset,
}: {
  points: ReturnType<typeof mapPoints>;
  reset: number;
}) => {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    if (points.length)
      map.fitBounds(latLngBounds(points.map((point) => [point.latitude, point.longitude])), {
        padding: [35, 35],
        maxZoom: 12,
        animate: false,
      });
  }, [map, points, reset]);
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
};

export const WarehouseMap = ({
  rows,
  basemap = 'none',
  title,
}: {
  rows: AnalyticsResult['rows'];
  basemap?: ReportWidget['basemap'];
  title: string;
}) => {
  const t = useTranslations('studio');
  const locale = useLocale();
  const [reset, setReset] = useState(0);
  const [tileFailed, setTileFailed] = useState(false);
  const points = mapPoints(rows);
  if (!points.length)
    return (
      <p role="status" className="rounded-xl bg-slate-50 p-6 text-[13px] leading-7 text-slate-600">
        {t('gis.noCoordinates')}
      </p>
    );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">{t('gis.locations', { count: points.length })}</p>
        <Button
          type="button"
          variant="outline"
          className={secondaryClass}
          onClick={() => setReset((value) => value + 1)}
        >
          {t('gis.fit')}
        </Button>
      </div>
      <div
        role="region"
        aria-label={title}
        className="relative z-0 h-[clamp(24rem,65dvh,48rem)] overflow-hidden rounded-xl border border-slate-200"
        dir="ltr"
      >
        <MapContainer
          center={[0, 0]}
          zoom={2}
          scrollWheelZoom={false}
          className="h-full w-full bg-slate-100"
        >
          {basemap === 'openstreetmap' && (
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              eventHandlers={{ tileerror: () => setTileFailed(true) }}
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
          )}
          <FitLocations points={points} reset={reset} />
          {points.map((point) => (
            <CircleMarker
              key={JSON.stringify([point.latitude, point.longitude, point.label])}
              center={[point.latitude, point.longitude]}
              radius={9}
              pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#0f766e', fillOpacity: 0.85 }}
            >
              <Popup>
                <div dir={locale === 'fa' ? 'rtl' : 'ltr'} className="space-y-1">
                  <strong>{point.label || title}</strong>
                  <p>{formatExactValue(point.value, locale)}</p>
                  <p dir="ltr">
                    {point.latitude}, {point.longitude}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      {tileFailed && (
        <p role="status" className="rounded-xl bg-amber-50 p-3 text-[13px] text-amber-900">
          {t('gis.tilesUnavailable')}
        </p>
      )}
      <p className="text-xs leading-6 text-slate-500">{t('gis.scope')}</p>
      <details className="rounded-xl border border-slate-200 p-3 text-[13px]">
        <summary className="cursor-pointer font-medium">{t('gis.viewLocations')}</summary>
        <div className="mt-3 max-h-80 overflow-auto">
          <table className="w-full text-start">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>
                {['label', 'latitude', 'longitude', 'value'].map((key) => (
                  <th key={key} scope="col" className="p-3 text-start">
                    {t(`gis.${key}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr
                  key={JSON.stringify([point.latitude, point.longitude, point.label])}
                  className="border-t border-slate-100"
                >
                  <td className="p-3">{point.label}</td>
                  <td className="p-3">{point.latitude}</td>
                  <td className="p-3">{point.longitude}</td>
                  <td className="p-3">{formatExactValue(point.value, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
};
