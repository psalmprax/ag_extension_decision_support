import React, { forwardRef } from 'react';

/**
 * A form field people never see or reach: placed off-screen (not display:none, which
 * some bots skip), out of the tab order and hidden from screen readers. Only a bot
 * that fills every input puts anything in it; the server then rejects the sign-up.
 */
export const SignupHoneypot = forwardRef<HTMLInputElement>(function SignupHoneypot(_props, ref) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
      <input ref={ref} type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
    </div>
  );
});
