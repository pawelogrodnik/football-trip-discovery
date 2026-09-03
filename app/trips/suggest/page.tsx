import SuggestClient from './components/SuggestClient';

export const metadata = {
  title: 'Suggested Trips - Football Trip Discovery',
  description: 'Find best football trip itineraries based on leagues, dates and travel distance.',
};

export default function Page() {
  return (
    <main className="p-6">
      <SuggestClient />
    </main>
  );
}
