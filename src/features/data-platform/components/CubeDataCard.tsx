import { useQuery } from '@tanstack/react-query';
import { useId, useMemo } from 'react';
import { useTranslations } from 'use-intl';

import { CubeQueryPanel } from '@/features/data-platform/components/CubeQueryPanel';
import { createCubeClient, cubeDefaults } from '@/features/data-platform/lib/cube';

import type { Query } from '@cubejs-client/core';

export const CubeDataCard = ({
  initialQuery,
  initialShowValues,
  onShowValuesChange,
  onApply,
  onVisualChange,
}: {
  initialQuery?: Query | null;
  initialShowValues?: boolean;
  onShowValuesChange?: (show: boolean) => void;
  onApply?: (query: Query) => void;
  onVisualChange?: (visual: 'bar' | 'line' | 'table') => void;
}) => {
  const t = useTranslations('cube');
  const id = useId();
  const client = useMemo(
    () => (cubeDefaults.url ? createCubeClient(cubeDefaults.url, cubeDefaults.token) : null),
    [],
  );
  const metadata = useQuery({
    queryKey: ['cube', id, cubeDefaults.url, 'meta'],
    queryFn: async () => {
      if (!client) throw new Error('No connection');
      const meta = await client.meta();
      return {
        measures: meta.cubes.flatMap((cube) =>
          cube.measures.map(({ name, title }) => ({ name, title })),
        ),
        dimensions: meta.cubes.flatMap((cube) =>
          cube.dimensions.map(({ name, title, type }) => ({ name, title, type })),
        ),
      };
    },
    enabled: client !== null,
    retry: false,
    gcTime: 0,
    staleTime: 60_000,
  });

  return (
    <section
      className="overflow-hidden rounded-xl border bg-white shadow-sm"
      aria-label={t('workspaceTabs')}
    >
      <div className="space-y-4 p-4 lg:p-5">
        {metadata.isFetching && <p role="status">{t('testing')}</p>}
        {metadata.isError && <p role="alert">{t('error', { message: metadata.error.message })}</p>}
        <div>
          {!client && (
            <p className="rounded-lg border p-8 text-center">{t('connectionUnavailable')}</p>
          )}
          <CubeQueryPanel
            initialQuery={initialQuery}
            initialShowValues={initialShowValues}
            onShowValuesChange={onShowValuesChange}
            onApply={onApply}
            onVisualChange={onVisualChange}
            client={client}
            measures={metadata.data?.measures ?? []}
            dimensions={metadata.data?.dimensions ?? []}
          />
        </div>
      </div>
    </section>
  );
};
