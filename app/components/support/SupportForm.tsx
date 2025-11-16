'use client';

import { FormEvent, useState } from 'react';
// import { SUPPORT_FORM_QUESTIONS } from 'lib/supportFormQuestions';
import { useTranslations } from 'components/providers/LocaleProvider';

import './support-form.css';

type FormType = 'contact' | 'bug';

type SupportFormProps = {
  formType: FormType;
  title: string;
  description?: string;
};

type SubmissionState = 'idle' | 'loading' | 'success' | 'error';

const createDefaultFields = () => ({
  name: '',
  email: '',
  subject: '',
  message: '',
  securityAnswer: '',
  website: '',
});

// const randomQuestionIndex = () =>
//   Math.floor(Math.random() * Math.max(1, SUPPORT_FORM_QUESTIONS.length));

export default function SupportForm({ formType, description }: SupportFormProps) {
  const t = useTranslations(formType === 'bug' ? 'SupportForm.bugReport' : 'SupportForm.contact');
  const [fields, setFields] = useState(createDefaultFields());
  const [status, setStatus] = useState<SubmissionState>('idle');
  const [feedback, setFeedback] = useState<string | null>(null);
  // const [questionIndex, setQuestionIndex] = useState(() => randomQuestionIndex());
  // const question = SUPPORT_FORM_QUESTIONS[questionIndex];

  const handleChange = (name: string, value: string) => {
    setFields((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFields(createDefaultFields());
    // setQuestionIndex(randomQuestionIndex());
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('loading');
    setFeedback(null);
    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...fields,
          type: formType,
          // questionId: questionIndex,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Something went wrong');
      }
      setStatus('success');
      setFeedback('Thanks! Your message was sent successfully.');
      resetForm();
    } catch (error: any) {
      setStatus('error');
      setFeedback(error?.message || 'Unable to send message. Please try again later.');
    }
  };

  return (
    <section className="support-form__section">
      <div className="support-form__card">
        <h1>{t('title')}</h1>
        {description && <p className="support-form__description">{t('description')}</p>}
        <form className="support-form" onSubmit={handleSubmit}>
          <div className="support-form__row">
            <label>
              {t('firstName.label')}
              <input
                type="text"
                name="name"
                value={fields.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder={t('firstName.placeholder')}
              />
            </label>
            <label>
              {t('email.label')}
              <input
                type="email"
                name="email"
                value={fields.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder={t('email.placeholder')}
              />
            </label>
          </div>
          <label>
            {t('message.label')}

            <textarea
              name="message"
              value={fields.message}
              onChange={(e) => handleChange('message', e.target.value)}
              required
              rows={6}
              placeholder={t('message.placeholder')}
            />
          </label>
          <label className="support-form__honeypot" aria-hidden="true">
            Leave this field empty
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={fields.website}
              onChange={(e) => handleChange('website', e.target.value)}
            />
          </label>
          <button type="submit" disabled={status === 'loading'}>
            {t(status === 'loading' ? 'buttonLoading' : 'button')}
          </button>
          {feedback && (
            <p
              className={`support-form__feedback ${
                status === 'error' ? 'support-form__feedback--error' : ''
              }`}
              role="status"
            >
              {feedback}
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
