import ErrorBoundary, { type ErrorBoundaryProps, type ErrorBoundaryLabels } from '@ag-extension/shared';
import { useLanguage } from '@/lib/LanguageContext';

/** The shared error screen in the app's language. Use inside LanguageProvider. */
export function AppErrorBoundary(props: Omit<ErrorBoundaryProps, 'labels'>) {
  const { t } = useLanguage();
  const labels: ErrorBoundaryLabels = {
    title: t('error_screen_title', { defaultValue: 'Something went wrong' }),
    description: t('error_screen_description', { defaultValue: 'This part of the page stopped working. Try again or reload the page. If it keeps happening, contact support.' }),
    errorMessage: t('error_screen_message', { defaultValue: 'Error message' }),
    copy: t('error_screen_copy', { defaultValue: 'Copy error details' }),
    copied: t('error_screen_copied', { defaultValue: 'Copied' }),
    component: t('error_screen_component', { defaultValue: 'Component:' }),
    tryAgain: t('error_screen_try_again', { defaultValue: 'Try again' }),
    reload: t('error_screen_reload', { defaultValue: 'Reload page' }),
    goHome: t('error_screen_go_home', { defaultValue: 'Go to the home page' }),
    technicalDetails: t('error_screen_technical_details', { defaultValue: 'Technical details' }),
  };
  return <ErrorBoundary {...props} labels={labels} />;
}
