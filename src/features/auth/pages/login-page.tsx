import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { Globe2, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useForm } from 'react-hook-form';
import { useLocale, useTranslations } from 'use-intl';

import { login } from '@/features/auth/api/auth-api';
import { createLoginSchema, type LoginValues } from '@/features/auth/lib/login-schema';
import { toast } from '@/shared/lib/toast';
import { Button } from '@/shared/ui/atoms/button/button';
import { ControlledInput } from '@/shared/ui/atoms/input/controlled-input';
import { ControlledPasswordInput } from '@/shared/ui/atoms/password-input/controlled-password-input';

const descriptionSteps = ['description', 'loop.dataFlows', 'loop.dashboards', 'loop.kpis'] as const;

export const LoginPage = () => {
  const t = useTranslations('login');
  const locale = useLocale();
  const navigate = useNavigate();
  const [rippleCell, setRippleCell] = useState<{ index: number; sequence: number } | null>(null);
  const [rippleGrid, setRippleGrid] = useState({ columns: 27, rows: 12 });
  const rippleRef = useRef<HTMLDivElement>(null);
  const {
    control,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(createLoginSchema(t('required'))),
    defaultValues: { username: '', password: '' },
  });
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
    <main
      id="workspace-content"
      className="login-stage"
      onClick={(event) => {
        const target = event.target;
        if (
          !(target instanceof Element) ||
          target.closest('a, button, input, select, textarea, label')
        ) {
          return;
        }
        const cell = target.closest<HTMLElement>('[data-ripple-index]');
        const bounds = rippleRef.current?.getBoundingClientRect();
        if (!bounds) return;
        const column = Math.max(
          0,
          Math.min(rippleGrid.columns - 1, Math.floor((event.clientX - bounds.left) / 56)),
        );
        const row = Math.max(
          0,
          Math.min(rippleGrid.rows - 1, Math.floor((event.clientY - bounds.top) / 56)),
        );
        const index = cell ? Number(cell.dataset.rippleIndex) : row * rippleGrid.columns + column;
        setRippleCell((current) => ({ index, sequence: (current?.sequence ?? 0) + 1 }));
      }}
    >
      <div
        ref={rippleRef}
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
            <span key={index} className="login-ripple-cell" data-ripple-index={index}>
              {distance !== null && (
                <span
                  key={rippleCell?.sequence}
                  className="login-ripple-flash"
                  style={{ '--delay': `${Math.round(distance * 45)}ms` } as CSSProperties}
                />
              )}
            </span>
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
            noValidate
            onSubmit={handleSubmit(async ({ username, password }) => {
              try {
                await login({ username, password });
                reset();
                toast.success(t('loginSuccess'));
                await navigate({ to: '/$locale/dashboard', params: { locale } });
              } catch (error) {
                setError('password', {
                  type: 'server',
                  message: error instanceof Error ? error.message : t('loginFailed'),
                });
              }
            })}
          >
            <div className="login-field">
              <ControlledInput
                id="login-username"
                label={t('username')}
                error={errors.username?.message}
                control={control}
                name="username"
                autoComplete="username"
                disabled={isSubmitting}
                spellCheck={false}
                autoCapitalize="none"
              />
            </div>
            <div className="login-field">
              <ControlledPasswordInput
                id="login-password"
                label={t('password')}
                error={errors.password?.message}
                control={control}
                name="password"
                onValueChange={() => clearErrors('password')}
                autoComplete="current-password"
                disabled={isSubmitting}
                showPasswordLabel={t('showPassword')}
                hidePasswordLabel={t('hidePassword')}
              />
            </div>
            <Button className="login-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <LoaderCircle className="login-submit-spinner" size={18} aria-hidden="true" />
              )}
              <span>{isSubmitting ? t('submitting') : t('submit')}</span>
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
};
