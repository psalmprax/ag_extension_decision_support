import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AuditReasonModal } from '../AuditReasonModal';
import { getAuditHeaders, STANDARD_REASON_CODES } from '../auditReasonTypes';

describe('AuditReasonModal component', () => {
  it('formats audit headers correctly', () => {
    const headers = getAuditHeaders('SUSPECTED_ACCOUNT_COMPROMISE', 'Anomalous password resets from foreign subnet');
    expect(headers).toEqual({
      'X-Audit-Reason-Code': 'SUSPECTED_ACCOUNT_COMPROMISE',
      'X-Audit-Justification': 'Anomalous password resets from foreign subnet',
    });
  });

  it('renders standard reason codes in dropdown', () => {
    render(
      <AuditReasonModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        actionTitle="Erase User Data"
      />
    );

    expect(screen.getByText('Non-Repudiation Security Authorization')).toBeInTheDocument();
    expect(screen.getByText(/Erase User Data/)).toBeInTheDocument();
    const select = screen.getByLabelText(/Audit Reason Code/i) as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.children.length).toBe(STANDARD_REASON_CODES.length);
  });

  it('validates minimum justification length before allowing submission', () => {
    const onConfirmMock = vi.fn();
    render(
      <AuditReasonModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirmMock}
        actionTitle="Revoke Farmer Access"
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Authorize & Execute Action/i });
    expect(submitBtn).toBeDisabled();

    // Type less than 10 characters
    const textarea = screen.getByLabelText(/Technical Justification & Context/i);
    fireEvent.change(textarea, { target: { value: 'Too short' } });
    expect(submitBtn).toBeDisabled();

    // Type 10+ characters
    fireEvent.change(textarea, { target: { value: 'This is a valid justification note' } });
    expect(submitBtn).toBeDisabled(); // Policy checkbox not checked yet

    // Check policy certification
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(submitBtn).toBeEnabled();
    fireEvent.click(submitBtn);

    expect(onConfirmMock).toHaveBeenCalledWith({
      reasonCode: 'SUSPECTED_ACCOUNT_COMPROMISE',
      justification: 'This is a valid justification note',
    });
  });

  it('allows specifying custom reason code when CUSTOM selected', () => {
    const onConfirmMock = vi.fn();
    render(
      <AuditReasonModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirmMock}
        actionTitle="Purge Satellite Logs"
      />
    );

    const select = screen.getByLabelText(/Audit Reason Code/i);
    fireEvent.change(select, { target: { value: 'CUSTOM' } });

    const customInput = screen.getByPlaceholderText(/SEC-INCIDENT-2026-0812/i);
    expect(customInput).toBeInTheDocument();

    fireEvent.change(customInput, { target: { value: 'INCIDENT-9912' } });
    const textarea = screen.getByLabelText(/Technical Justification & Context/i);
    fireEvent.change(textarea, { target: { value: 'Emergency purge per incident team' } });
    fireEvent.click(screen.getByRole('checkbox'));

    const submitBtn = screen.getByRole('button', { name: /Authorize & Execute Action/i });
    expect(submitBtn).toBeEnabled();
    fireEvent.click(submitBtn);

    expect(onConfirmMock).toHaveBeenCalledWith({
      reasonCode: 'INCIDENT-9912',
      justification: 'Emergency purge per incident team',
    });
  });
});
