/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import './matchlist.css';

import { Fragment } from 'react';
import { IconArrowBack } from '@tabler/icons-react';
import { ActionIcon } from '@mantine/core';
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
  totalCount,
  onGoBack,
  onMatchClick,
}: {
  matches: any[];
  totalCount: number;
  onGoBack: () => void;
  onMatchClick: (match: any) => void;
}) => {
  const datesAggregatorList: string[] = [];
  return (
    <div className="match-list">
      <h3>
        <ActionIcon variant="default" aria-label="Go back to form" onClick={onGoBack}>
          <IconArrowBack style={{ width: '70%', height: '70%' }} stroke={1.5} />
        </ActionIcon>
        <span>
          Found {totalCount} {totalCount > 1 ? 'matches' : 'match'}
        </span>
      </h3>
      {matches.map((match) => {
        const date = new Date(match.date?.dateTime ?? match.utcDate ?? '');
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
          <Fragment key={match.id}>
            {shouldDisplayAggregatedDate && (
              <p className="match-list__date-aggregator">{dayMonthYear}</p>
            )}
            <div className="match-card" onClick={() => onMatchClick(match)}>
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
                <p>Distance: {match._distanceKm.toFixed(2)} km</p>
              </div>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
};

export default MatchList;
