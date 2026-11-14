import { Link, useNavigate } from '@tanstack/react-router';
import { Eye, EyeOff, Globe2 } from 'lucide-react';
import { useState } from 'react';
import { useLocale, useTranslations } from 'use-intl';

import { LoginShowcase } from '@/features/auth/components/LoginShowcase';
import { IconTooltip } from '@/shared/components/ui/icon-tooltip';
import { Typography } from '@/shared/components/ui/typography';
import { toast } from '@/shared/lib/toast';
import { login } from '@/shared/network/api';

export const LoginPage = () => {
  const t = useTranslations('login');
  const locale = useLocale();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const otherLocale = locale === 'fa' ? 'en' : 'fa';

  return (
    <main id="workspace-content" className="login-stage">
      <section className="login-panel" aria-labelledby="login-title" dir="ltr">
        <div className="login-form-side" dir={locale === 'fa' ? 'rtl' : 'ltr'}>
          <div className="login-topline">
            <div className="login-brand">
              <img src="/brand/netsep-logo.png" width={30} height={38} alt={t('brand')} />
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
            <p className="mb-4 text-sm text-text-secondary">{t('frontendOnlyNotice')}</p>
            <form
              className="login-form"
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
                    required
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
              <button className="login-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? t('submitting') : t('submit')}
              </button>
            </form>
          </div>
        </div>
        <LoginShowcase />
      </section>
    </main>
  );
};
