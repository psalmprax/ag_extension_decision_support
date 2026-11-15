import { Toaster } from 'react-hot-toast';

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: 'var(--color-surface)',
          color: 'var(--color-on-surface)',
        },
        iconTheme: {
          primary: 'var(--color-on-surface)',
          secondary: 'var(--color-surface)',
        },
        success: { duration: 3000 },
        error: { duration: 4000 },
      }}
    />
  );
}
