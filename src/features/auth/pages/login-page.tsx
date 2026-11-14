import { Link, useNavigate } from '@tanstack/react-router';
import { Eye, EyeOff, Globe2, LoaderCircle } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { useLocale, useTranslations } from 'use-intl';

import { toast } from '@/shared/lib/toast';
import { login } from '@/shared/network/api';

const descriptionSteps = ['description', 'loop.dataFlows', 'loop.dashboards', 'loop.kpis'] as const;

export const LoginPage = () => {
  const t = useTranslations('login');
  const locale = useLocale();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [rippleCell, setRippleCell] = useState<{ index: number; sequence: number } | null>(null);
  const [rippleGrid, setRippleGrid] = useState({ columns: 27, rows: 12 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [descriptionIndex, setDescriptionIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const otherLocale = locale === 'fa' ? 'en' : 'fa';

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(preference.matches);
    updatePreference();
    preference.addEventListener('change', updatePreference);
    return () => preference.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const interval = window.setInterval(
      () => setDescriptionIndex((current) => (current + 1) % descriptionSteps.length),
      3600,
    );
    return () => window.clearInterval(interval);
  }, [reducedMotion]);

  useEffect(() => {
    const resizeGrid = () => {
      setRippleGrid({
        columns: Math.ceil(window.innerWidth / 56) + 2,
        rows: Math.ceil(window.innerHeight / 56) + 2,
      });
    };
    resizeGrid();
    window.addEventListener('resize', resizeGrid);
    return () => window.removeEventListener('resize', resizeGrid);
  }, []);

  useEffect(() => {
    if (rippleCell === null) return;
    const duration = Math.ceil(Math.hypot(rippleGrid.columns, rippleGrid.rows) * 45) + 250;
    const timeout = window.setTimeout(() => setRippleCell(null), duration);
    return () => window.clearTimeout(timeout);
  }, [rippleCell, rippleGrid.columns, rippleGrid.rows]);

  return (
    <main id="workspace-content" className="login-stage">
      <div
        className="login-ripple"
        aria-hidden="true"
        style={
          {
            '--ripple-columns': rippleGrid.columns,
            '--ripple-rows': rippleGrid.rows,
          } as CSSProperties
        }
      >
        {Array.from({ length: rippleGrid.columns * rippleGrid.rows }, (_, index) => {
          const distance =
            rippleCell === null
              ? null
              : Math.hypot(
                  Math.floor(index / rippleGrid.columns) -
                    Math.floor(rippleCell.index / rippleGrid.columns),
                  (index % rippleGrid.columns) - (rippleCell.index % rippleGrid.columns),
                );
          return (
            <span
              key={`${rippleCell?.sequence ?? 0}-${index}`}
              className={`login-ripple-cell${distance === null ? '' : 'login-ripple-cell-active'}`}
              style={
                distance === null
                  ? undefined
                  : ({ '--delay': `${Math.round(distance * 45)}ms` } as CSSProperties)
              }
              onClick={() =>
                setRippleCell((current) => ({ index, sequence: (current?.sequence ?? 0) + 1 }))
              }
            />
          );
        })}
      </div>
      <header className="login-page-header" dir="ltr">
        <Link
          to="/$locale/login"
          params={{ locale: otherLocale }}
          className="login-language"
          lang={otherLocale}
          aria-label={t('language')}
        >
          <Globe2 size={18} aria-hidden="true" />
        </Link>
        <div className="login-brand">
          <img src="/brand/netsep-logo.png" width={30} height={38} alt={t('brand')} />
        </div>
      </header>
      <section
        className="login-panel"
        aria-labelledby="login-title"
        dir={locale === 'fa' ? 'rtl' : 'ltr'}
      >
        <div className="login-form-content">
          <header className="login-form-header">
            <h1 id="login-title">{t('welcome')}</h1>
            <p className="sr-only">{t('description')}</p>
            <div className="login-description-loop" aria-hidden="true">
              <span key={`${locale}-${descriptionIndex}`} className="login-description-loop-item">
                {t(descriptionSteps[descriptionIndex])}
              </span>
            </div>
          </header>
          <form
            className="login-form"
            aria-busy={isSubmitting}
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const formData = new FormData(form);
              const usernameEntry = formData.get('username');
              const passwordEntry = formData.get('password');
              const username = typeof usernameEntry === 'string' ? usernameEntry.trim() : '';
              const password = typeof passwordEntry === 'string' ? passwordEntry : '';
              setIsSubmitting(true);
              try {
                await login({ username, password });
                form.reset();
                toast.success(t('loginSuccess'));
                await navigate({ to: '/$locale/dashboard', params: { locale } });
              } catch (error) {
                toast.error(error instanceof Error ? error.message : t('loginFailed'));
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            <div className="login-field">
              <label htmlFor="login-username">{t('username')}</label>
              <input
                id="login-username"
                name="username"
                autoComplete="username"
                disabled={isSubmitting}
                required
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
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  required
                  placeholder={t('passwordPlaceholder')}
                />
                <button
                  type="button"
                  disabled={isSubmitting}
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
              </div>
            </div>
            <button className="login-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <LoaderCircle className="login-submit-spinner" size={18} aria-hidden="true" />
              )}
              <span>{isSubmitting ? t('submitting') : t('submit')}</span>
            </button>
          </form>
        </div>
      </section>
    </main>
  );
};
