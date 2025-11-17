import type { Metadata } from 'next';
import { detectLocale, loadMessages } from 'lib/i18n/server';

export const metadata: Metadata = {
  title: 'About Me | Football Trip Discovery',
  description: 'Learn more about the Football Trip Discovery project.',
};

export default async function AboutPage() {
  const locale = await detectLocale();
  const messages = await loadMessages(locale);
  const about = messages.About ?? {};

  return (
    <section className="p-6 max-w-3xl mx-auto prose about-page">
      <h1>{about.title ?? 'About'}</h1>
      <p>{about.paragraph1}</p>
      <p>{about.paragraph2}</p>
      <p>{about.paragraph3}</p>
    </section>
  );
}
