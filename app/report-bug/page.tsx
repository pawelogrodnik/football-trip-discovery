import type { Metadata } from 'next';
import SupportForm from 'components/support/SupportForm';

export const metadata: Metadata = {
  title: 'Report a bug | Football Trip Discovery',
  description: 'Found an issue? Let us know so we can fix it quickly.',
};

export default function ReportBugPage() {
  return (
    <SupportForm
      formType="bug"
      title="Report a bug"
      description="Share as many details as possible (browser, device, steps to reproduce). Screenshots or links are very helpful."
    />
  );
}
