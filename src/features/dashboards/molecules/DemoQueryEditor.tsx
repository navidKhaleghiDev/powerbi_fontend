import { useState } from 'react';
import { useTranslations } from 'use-intl';

import {
  demoDimensions,
  demoMeasures,
  supportsDemoDimension,
} from '@/features/dashboards/lib/sales-demo';
import { Button } from '@/shared/components/atoms/button';
import { NativeSelect } from '@/shared/components/atoms/native-select';

import type { Query } from '@cubejs-client/core';

export const DemoQueryEditor = ({
  initialQuery,
  onApply,
}: {
  initialQuery: Query | null;
  onApply: (query: Query) => void;
}) => {
  const t = useTranslations('salesDemo');
  const [measure, setMeasure] = useState(initialQuery?.measures?.[0] ?? 'income');
  const [dimension, setDimension] = useState(initialQuery?.dimensions?.[0] ?? '');
  return (
    <div className="space-y-4">
      <div className="bi-editor-settings">
        <label>
          {t('measure')}
          <NativeSelect
            value={measure}
            onChange={(event) => {
              setMeasure(event.target.value);
              setDimension('');
            }}
          >
            {demoMeasures.map((key) => (
              <option key={key} value={key}>
                {t(`fields.${key}`)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label>
          {t('groupBy')}
          <NativeSelect value={dimension} onChange={(event) => setDimension(event.target.value)}>
            <option value="">{t('total')}</option>
            {demoDimensions
              .filter((key) => supportsDemoDimension(measure, key))
              .map((key) => (
                <option key={key} value={key}>
                  {t(`fields.${key}`)}
                </option>
              ))}
          </NativeSelect>
        </label>
      </div>
      <p>{t('recognitionNote')}</p>
      <Button
        onClick={() =>
          onApply({ measures: [measure], ...(dimension ? { dimensions: [dimension] } : {}) })
        }
      >
        {t('apply')}
      </Button>
    </div>
  );
};
