/**
 * Shared Email Workflows types.
 *
 * `EditForm` is referenced by both the page composer
 * `src/pages/EmailWorkflows.tsx` (as `useState<EditForm>` state) and by
 * `src/components/email-workflows/EditModal.tsx` (as a prop), so it
 * lives in a shared module to avoid duplication and circular deps.
 */

export interface EditForm {
  subject: string;
  body: string;
  category: string;
  variables: string[];
}
