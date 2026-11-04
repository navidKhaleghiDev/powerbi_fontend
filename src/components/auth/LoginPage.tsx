import { Link, useNavigate } from '@tanstack/react-router';
import { Eye, EyeOff, Globe2 } from 'lucide-react';
import { useState } from 'react';
import { useLocale, useTranslations } from 'use-intl';

import { IconTooltip } from '@/components/ui/icon-tooltip';
import { Typography } from '@/components/ui/typography';

import { LoginShowcase } from './LoginShowcase';

export const LoginPage = () => {
  const t = useTranslations('login');
  const locale = useLocale();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [panel, setPanel] = useState<'configuration' | 'reports'>('configuration');
  const otherLocale = locale === 'fa' ? 'en' : 'fa';

  return (
    <main id="workspace-content" className="login-stage">
      <section className="login-panel" aria-labelledby="login-title" dir="ltr">
        <div className="login-form-side" dir={locale === 'fa' ? 'rtl' : 'ltr'}>
          <div className="login-topline">
            <div className="login-brand">
              <img src="/brand/netsep-logo.png" width={30} height={38} alt="" />
              <span>{t('brand')}</span>
            </div>
            <IconTooltip label={t('language')}>
              <Link
                to="/$locale/login"
                params={{ locale: otherLocale }}
                className="workspace-rail-link"
                lang={otherLocale}
                aria-label={t('language')}
              >
                <Globe2 size={18} aria-hidden="true" />
              </Link>
            </IconTooltip>
          </div>
          <div className="login-form-content">
            <header className="login-form-header">
              <Typography as="h1" variant="h3" id="login-title">
                {t('welcome')}
              </Typography>
              <p>{t('introduction')}</p>
            </header>
            <form
              className="login-form"
              onSubmit={(event) => {
                event.preventDefault();
                event.currentTarget.reset();
                void navigate({
                  to:
                    panel === 'configuration'
                      ? '/$locale/data-platform'
                      : '/$locale/analytics/reports',
                  params: { locale },
                  search: panel === 'configuration' ? { section: 'overview' } : {},
                });
              }}
            >
              <fieldset className="login-panel-choice">
                <legend>{t('choosePanel')}</legend>
                <div className="login-panel-options">
                  {(['configuration', 'reports'] as const).map((option) => (
                    <label key={option} className="login-panel-option">
                      <input
                        type="radio"
                        name="panel"
                        value={option}
                        checked={panel === option}
                        onChange={() => setPanel(option)}
                      />
                      <span>{t(option)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="login-field">
                <label htmlFor="login-username">{t('username')}</label>
                <input
                  id="login-username"
                  name="username"
                  autoComplete="off"
                  placeholder={t('usernamePlaceholder')}
                  spellCheck={false}
                  autoCapitalize="none"
                />
              </div>
              <div className="login-field">
                <label htmlFor="login-password">{t('password')}</label>
                <div className="login-password">
                  <input
                    id="login-password"
                    name="password"
                    type={visible ? 'text' : 'password'}
                    autoComplete="off"
                    placeholder={t('passwordPlaceholder')}
                  />
                  <IconTooltip label={t(visible ? 'hidePassword' : 'showPassword')}>
                    <button
                      type="button"
                      onClick={() => setVisible((value) => !value)}
                      aria-label={t(visible ? 'hidePassword' : 'showPassword')}
                      aria-pressed={visible}
                    >
                      {visible ? (
                        <EyeOff size={18} aria-hidden="true" />
                      ) : (
                        <Eye size={18} aria-hidden="true" />
                      )}
                    </button>
                  </IconTooltip>
                </div>
              </div>
              <button className="login-submit" type="submit">
                {t('submit')}
              </button>
            </form>
          </div>
        </div>
        <LoginShowcase />
      </section>
    </main>
  );
};
