import type { Metadata } from 'next';
import SupportForm from 'components/support/SupportForm';

export const metadata: Metadata = {
  title: 'Contact | Football Trip Discovery',
  description: 'Get in touch with the Football Trip Discovery team.',
};

export default function ContactPage() {
  return <SupportForm />;
}
