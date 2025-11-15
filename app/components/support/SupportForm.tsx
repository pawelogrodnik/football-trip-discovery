'use client';

import { FormEvent, useState } from 'react';
import { SUPPORT_FORM_QUESTIONS } from 'lib/supportFormQuestions';
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

const randomQuestionIndex = () =>
  Math.floor(Math.random() * Math.max(1, SUPPORT_FORM_QUESTIONS.length));

export default function SupportForm({ formType, title, description }: SupportFormProps) {
  const [fields, setFields] = useState(createDefaultFields());
  const [status, setStatus] = useState<SubmissionState>('idle');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState(() => randomQuestionIndex());
  const question = SUPPORT_FORM_QUESTIONS[questionIndex];

  const handleChange = (name: string, value: string) => {
    setFields((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFields(createDefaultFields());
    setQuestionIndex(randomQuestionIndex());
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
          questionId: questionIndex,
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
        <h1>{title}</h1>
        {description && <p className="support-form__description">{description}</p>}
        <form className="support-form" onSubmit={handleSubmit}>
          <div className="support-form__row">
            <label>
              First name or nickname (optional)
              <input
                type="text"
                name="name"
                value={fields.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Jane or @fan123"
              />
            </label>
            <label>
              Email address (optional)
              <input
                type="email"
                name="email"
                value={fields.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="you@example.com"
              />
            </label>
          </div>
          <label>
            Subject (optional)
            <input
              type="text"
              name="subject"
              value={fields.subject}
              onChange={(e) => handleChange('subject', e.target.value)}
              placeholder={formType === 'bug' ? 'Short summary of the bug' : 'How can we help you?'}
            />
          </label>
          <label>
            Message
            <textarea
              name="message"
              value={fields.message}
              onChange={(e) => handleChange('message', e.target.value)}
              required
              rows={6}
              placeholder={
                formType === 'bug'
                  ? 'Describe the issue, steps to reproduce, browser/device info...'
                  : 'Tell us more about your question or request...'
              }
            />
          </label>
          <label>
            Human verification
            <span className="support-form__question">{question.question}</span>
            <input
              type="text"
              name="securityAnswer"
              value={fields.securityAnswer}
              onChange={(e) => handleChange('securityAnswer', e.target.value)}
              required
              placeholder="Answer the question above"
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
            {status === 'loading' ? 'Sending...' : 'Send message'}
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
