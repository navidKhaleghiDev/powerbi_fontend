import { useQuery } from '@tanstack/react-query';
import { useId, useMemo, useState } from 'react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { createCubeClient, cubeDefaults } from '@/lib/cube';

import { CubeQueryPanel } from './CubeQueryPanel';
import { CubeTableBrowser } from './CubeTableBrowser';

export const CubeDataCard = () => {
  const t = useTranslations('cube');
  const id = useId();
  const [tab, setTab] = useState<'playground' | 'model'>('playground');
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
      className="overflow-hidden rounded-xl border bg-background shadow-sm"
      aria-label={t('workspaceTabs')}
    >
      <div className="space-y-4 p-4 lg:p-5">
        <nav className="flex flex-wrap gap-2 border-b pb-3" aria-label={t('workspaceTabs')}>
          {(['playground', 'model'] as const).map((item) => (
            <Button
              key={item}
              variant={tab === item ? 'default' : 'ghost'}
              type="button"
              aria-current={tab === item ? 'page' : undefined}
              onClick={() => setTab(item)}
            >
              {t(`tabs.${item}`)}
            </Button>
          ))}
        </nav>
        {metadata.isFetching && <p role="status">{t('testing')}</p>}
        {metadata.isError && <p role="alert">{t('error', { message: metadata.error.message })}</p>}
        <div hidden={tab !== 'playground'}>
          {!client && (
            <p className="rounded-lg border p-8 text-center">{t('connectionUnavailable')}</p>
          )}
          {metadata.isSuccess && client && (
            <>
              <p role="status">{t('connected')}</p>
              {metadata.data.measures.length === 0 ? (
                <p>{t('noMeasures')}</p>
              ) : (
                <CubeQueryPanel
                  client={client}
                  measures={metadata.data.measures}
                  dimensions={metadata.data.dimensions}
                />
              )}
            </>
          )}
        </div>
        <div hidden={tab !== 'model'}>
          <CubeTableBrowser />
        </div>
      </div>
    </section>
  );
};
