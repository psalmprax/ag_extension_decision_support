import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  AuditReasonModal,
  getAuditHeaders,
  STANDARD_REASON_CODES,
} from '../AuditReasonModal';

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

    expect(screen.getByText('Audit Reason & Justification Required')).toBeInTheDocument();
    expect(screen.getByText(/Target Action: Erase User Data/i)).toBeInTheDocument();
    STANDARD_REASON_CODES.forEach(reason => {
      expect(screen.getByText(reason.label)).toBeInTheDocument();
    });
  });

  it('requires policy certification and valid justification before confirmation', () => {
    const onConfirm = vi.fn();
    render(
      <AuditReasonModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        actionTitle="Purge Farmer Record"
      />
    );

    const confirmBtn = screen.getByRole('button', { name: /Authorize & Execute Action/i });
    expect(confirmBtn).toBeDisabled();

    // Type short justification
    const textarea = screen.getByPlaceholderText(/Explain the business, agronomic/i);
    fireEvent.change(textarea, { target: { value: 'Too short' } });
    expect(confirmBtn).toBeDisabled();

    // Type sufficient justification
    fireEvent.change(textarea, { target: { value: 'Valid justification with more than 10 characters' } });
    expect(confirmBtn).toBeDisabled(); // Still need checkbox

    // Check certification box
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);

    expect(onConfirm).toHaveBeenCalledWith({
      reasonCode: 'SUSPECTED_ACCOUNT_COMPROMISE',
      justification: 'Valid justification with more than 10 characters',
    });
  });

  it('allows custom reason code entry when CUSTOM is selected', () => {
    const onConfirm = vi.fn();
    render(
      <AuditReasonModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        actionTitle="Revoke Admin Access"
      />
    );

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'CUSTOM' } });

    // Custom code input should appear
    const customInput = screen.getByPlaceholderText(/e\.g\. TICKET-9402/i);
    fireEvent.change(customInput, { target: { value: 'ticket-7744-security' } });

    const textarea = screen.getByPlaceholderText(/Explain the business, agronomic/i);
    fireEvent.change(textarea, { target: { value: 'Mandatory deprovisioning of departed contractor' } });

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    const confirmBtn = screen.getByRole('button', { name: /Authorize & Execute Action/i });
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);

    expect(onConfirm).toHaveBeenCalledWith({
      reasonCode: 'TICKET-7744-SECURITY',
      justification: 'Mandatory deprovisioning of departed contractor',
    });
  });
});
