import type { Metadata } from 'next';
import SupportForm from 'components/support/SupportForm';

export const metadata: Metadata = {
  title: 'Contact | Football Trip Discovery',
  description: 'Get in touch with the Football Trip Discovery team.',
};

export default function ContactPage() {
  return (
    <SupportForm
      formType="contact"
      title="Contact us"
      description="Send us your questions, partnership ideas, or feedback. We usually reply within 1-2 business days."
    />
  );
}
