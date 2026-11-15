import { Search } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslations } from 'use-intl';

import {
  demoDimensions,
  demoMeasures,
  supportsDemoDimension,
} from '@/features/dashboards/lib/sales-demo';
import { DashboardPane } from '@/features/dashboards/molecules/DashboardPane';
import { Input } from '@/shared/ui/atoms/input/input';
import { NativeSelect } from '@/shared/ui/atoms/native-select/native-select';
import { Radio } from '@/shared/ui/atoms/radio/radio';

import type { DashboardWidget } from '@/features/dashboards/lib/dashboard';
import type { Query } from '@cubejs-client/core';

interface Props {
  widgets: DashboardWidget[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onQueryChange: (query: Query) => void;
  onCreateMeasure: (measure: string) => void;
}
export const DashboardDataPane = ({
  widgets,
  selectedId,
  onSelect,
  onQueryChange,
  onCreateMeasure,
}: Props) => {
  const t = useTranslations('salesDemo');
  const d = useTranslations('dashboard');
  const id = useId();
  const [search, setSearch] = useState('');
  const selected = widgets.find((widget) => widget.id === selectedId);
  const measure = selected?.query?.measures?.[0] ?? '';
  const dimension = selected?.query?.dimensions?.[0] ?? '';
  const visible = (key: string) =>
    `${key} ${t(`fields.${key}`)}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  return (
    <DashboardPane className="bi-data-pane" title={t('data')}>
      <label className="bi-data-target">
        {d('selectedWidget')}
        <NativeSelect
          value={selectedId ?? ''}
          disabled={!widgets.length}
          onChange={(event) => onSelect(event.target.value)}
        >
          <option value="" disabled>
            {d('noSelectedWidget')}
          </option>
          {widgets.map((widget) => (
            <option key={widget.id} value={widget.id}>
              {widget.title}
            </option>
          ))}
        </NativeSelect>
      </label>
      <p className="bi-data-selection-hint">
        {d(selected ? 'fieldChangesHint' : 'createFromMeasureHint')}
      </p>
      <label className="bi-data-search">
        <Search size={14} aria-hidden="true" />
        <Input
          type="search"
          aria-label={t('search')}
          placeholder={t('search')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <div className="bi-data-tree">
        <details open>
          <summary>{t('measures')}</summary>
          <fieldset>
            <legend className="sr-only">{t('measure')}</legend>
            {demoMeasures.filter(visible).map((key) => (
              <label key={key} className="bi-data-field">
                <Radio
                  name={`${id}-measure`}
                  checked={measure === key}
                  onChange={() => {
                    if (!selected) {
                      onCreateMeasure(key);
                      return;
                    }
                    onQueryChange({
                      ...selected.query,
                      measures: [key],
                      dimensions:
                        dimension && supportsDemoDimension(key, dimension) ? [dimension] : [],
                    });
                  }}
                />
                <span>{t(`fields.${key}`)}</span>
              </label>
            ))}
          </fieldset>
        </details>
        <details open>
          <summary>{t('dimensions')}</summary>
          <fieldset disabled={!measure}>
            <legend className="sr-only">{t('groupBy')}</legend>
            <label className="bi-data-field">
              <Radio
                name={`${id}-dimension`}
                checked={!dimension}
                onChange={() =>
                  onQueryChange({ ...selected?.query, measures: [measure], dimensions: [] })
                }
              />
              <span>{t('total')}</span>
            </label>
            {demoDimensions.filter(visible).map((key) => (
              <label
                key={key}
                className="bi-data-field"
                title={
                  measure && !supportsDemoDimension(measure, key)
                    ? d('unsupportedDimension')
                    : undefined
                }
              >
                <Radio
                  name={`${id}-dimension`}
                  checked={dimension === key}
                  disabled={!!measure && !supportsDemoDimension(measure, key)}
                  onChange={() =>
                    onQueryChange({ ...selected?.query, measures: [measure], dimensions: [key] })
                  }
                />
                <span>{t(`fields.${key}`)}</span>
              </label>
            ))}
          </fieldset>
        </details>
        {search.trim() && ![...demoMeasures, ...demoDimensions].some(visible) && (
          <p role="status">{d('noMatchingData')}</p>
        )}
      </div>
      <p className="bi-data-status">{t('dataNote')}</p>
    </DashboardPane>
  );
};
