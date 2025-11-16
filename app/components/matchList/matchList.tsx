/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import './matchlist.css';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconArrowBack, IconCopy } from '@tabler/icons-react';
import { useTranslations } from 'components/providers/LocaleProvider';
import { ActionIcon, Button, Checkbox } from '@mantine/core';
import { getCompetitionEmblem } from './../../lib/getCompetitionEmblem';
import { initials } from './../../lib/initials';

const Crest = ({ crestUrl, teamName }: { crestUrl?: string; teamName: string }) => {
  if (crestUrl) {
    return (
      <div className="img-wrapper">
        <img src={crestUrl} alt={`${teamName} crest`} title={`${teamName} crest`} />
      </div>
    );
  }
  return (
    <div className="crest">
      <div className="crest-fallback">{initials(teamName)}</div>
    </div>
  );
};

const CompetitionEmblem = ({ competitionName }: { competitionName: string }) => {
  const competitionEmblem = getCompetitionEmblem(competitionName);
  if (competitionEmblem) {
    return (
      <img
        src={competitionEmblem}
        alt={`${competitionName} emblem`}
        title={`${competitionName} emblem`}
      />
    );
  }
  return competitionName;
};

const MatchList = ({
  matches,
  onGoBack,
  onMatchClick,
  selectedMatchesIds = [],
  onMatchSelect,
  areMatchesSelectable = false,
  source,
  onContinue,
}: {
  matches: any[];
  totalCount?: number;
  onGoBack: () => void;
  onMatchClick: (match: any) => void;
  selectedMatchesIds?: string[];
  areMatchesSelectable: boolean;
  onMatchSelect?: (matchId: string) => void;
  source: string;
  onContinue?: () => void;
}) => {
  const t = useTranslations();
  const router = useRouter();
  const datesAggregatorList: string[] = [];
  const [copied, setCopied] = useState(false);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);

      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  return (
    <div className={`match-list match-list--${source}`}>
      {source === 'home' && (
        <h3>
          <ActionIcon variant="default" aria-label="Go back to form" onClick={onGoBack}>
            <IconArrowBack style={{ width: '70%', height: '70%' }} stroke={1.5} />
          </ActionIcon>
          <span>{t('MatchesPage.title')}</span>
        </h3>
      )}
      {source === 'matches' && <h3>{t('SelectedMatchesPage.title')}</h3>}
      <div className="match-list__listing">
        {matches.map((match) => {
          const date = new Date(match.date?.dateTime ?? match.utcDate ?? match?.date?.date ?? '');
          const fullDateString = date.toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });

          const [dayMonthYear] = fullDateString.split(',');
          const shouldDisplayAggregatedDate = !datesAggregatorList.includes(dayMonthYear);
          datesAggregatorList.push(dayMonthYear);
          return (
            <MatchCard
              key={match.id}
              match={match}
              shouldDisplayAggregatedDate={shouldDisplayAggregatedDate}
              onMatchClick={onMatchClick}
              fullDateString={fullDateString}
              dayMonthYear={dayMonthYear}
              areMatchesSelectable={areMatchesSelectable}
              selectedMatchesIds={selectedMatchesIds}
              onMatchSelect={onMatchSelect}
            />
          );
        })}
      </div>
      {source === 'home' && (
        <div className="match-list__buttons">
          <Button
            variant="filled"
            onClick={() => onContinue && onContinue()}
            disabled={selectedMatchesIds.length === 0}
          >
            {t('MatchList.continueButton')}
          </Button>
        </div>
      )}
      {source === 'matches' && (
        <div className="match-list__buttons">
          <Button variant="default" onClick={copyUrl}>
            <IconCopy className="mr-2" />
            {copied ? t('MatchList.shareButtonCopied') : t('MatchList.shareButton')}
          </Button>

          <Button variant="filled" onClick={() => router.back()}>
            {t('MatchList.goBackButton')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default MatchList;

const MatchCard = ({
  shouldDisplayAggregatedDate,
  match,
  onMatchClick,
  fullDateString,
  dayMonthYear,
  areMatchesSelectable = false,
  selectedMatchesIds = [],
  onMatchSelect,
}: {
  shouldDisplayAggregatedDate: boolean;
  areMatchesSelectable: boolean;
  selectedMatchesIds: string[];
  onMatchSelect?: (id: string) => void;
  match: any;
  onMatchClick: any;
  fullDateString: any;
  dayMonthYear: any;
}) => {
  const t = useTranslations('MatchCard');

  const normalizedMatchId = match?.id ? String(match.id) : '';
  const isSelected = normalizedMatchId ? selectedMatchesIds.includes(normalizedMatchId) : false;

  const stopCardClick: React.MouseEventHandler = (event) => {
    event.stopPropagation();
  };

  const handleCheckboxChange = () => {
    if (!areMatchesSelectable || !normalizedMatchId) {
      return;
    }
    onMatchSelect?.(normalizedMatchId);
  };

  return (
    <Fragment key={match.id}>
      {shouldDisplayAggregatedDate && <p className="match-list__date-aggregator">{dayMonthYear}</p>}
      <div className="match-card" onClick={() => onMatchClick(match)}>
        <div className="match-card__checkbox">
          <Checkbox
            checked={areMatchesSelectable ? isSelected : true}
            onChange={handleCheckboxChange}
            onClick={stopCardClick}
            onMouseDown={stopCardClick}
            disabled={!areMatchesSelectable}
            tabIndex={-1}
            size="md"
            mr="xl"
            styles={{ input: { cursor: 'pointer' } }}
            aria-hidden
          />
        </div>
        <div className="match-card__headline">
          <div className="match-card__team">
            <Crest crestUrl={match.homeTeam.crest} teamName={match.homeTeam.name} />
            <p> {match.homeTeam.name}</p>
          </div>
          <div className="match-card__team">
            <Crest crestUrl={match.awayTeam.crest} teamName={match.awayTeam.name} />
            <p> {match.awayTeam.name}</p>
          </div>
        </div>
        <div className="match-card__stadium">
          <p className="match-card__competition">
            <CompetitionEmblem competitionName={match.competition.name} />
          </p>
          <p>{match.stadium?.venue || match.stadium?.address}</p>
          <p>
            <span className="match-card__date">{fullDateString}</span>
          </p>
          {match._distanceKm ? (
            <p>
              {' '}
              {t('distance')}: {match._distanceKm.toFixed(2)} km
            </p>
          ) : null}
        </div>
      </div>
    </Fragment>
  );
};
