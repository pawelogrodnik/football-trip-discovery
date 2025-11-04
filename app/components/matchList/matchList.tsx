import './matchlist.css';

import { IconArrowBack } from '@tabler/icons-react';
import { ActionIcon } from '@mantine/core';
import { getCompetitionEmblem } from './../../lib/getCompetitionEmblem';

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
  return (
    <div className="match-list">
      <h1>
        <ActionIcon variant="default" aria-label="Go back to form" onClick={onGoBack}>
          <IconArrowBack style={{ width: '70%', height: '70%' }} stroke={1.5} />
        </ActionIcon>
        <span>Found {totalCount} matches</span>
      </h1>
      {matches.map((match, idx) => {
        const date = new Date(match.date?.dateTime ?? match.utcDate ?? '').toLocaleString();
        const competitionEmblem = getCompetitionEmblem(match.competition.name);
        return (
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
          <div key={idx} className="match-card" onClick={() => onMatchClick(match)}>
            <div className="match-card__headline">
              <div className="match-card__team">
                <div className="img-wrapper">
                  <img src={match.homeTeam.crest} alt="" />
                </div>
                <p> {match.homeTeam.name}</p>
              </div>
              <div className="match-card__team">
                <div className="img-wrapper">
                  <img src={match.awayTeam.crest} alt="" />
                </div>
                <p> {match.awayTeam.name}</p>
              </div>
            </div>
            <div className="match-card__stadium">
              <p className="match-card__competition">
                {competitionEmblem ? (
                  <img src={getCompetitionEmblem(match.competition.name)} alt="" />
                ) : (
                  match.competition.name
                )}
              </p>
              <p>{match.stadium?.venue || match.stadium?.address}</p>
              <p>
                <span className="match-card__date">{date}</span>
              </p>
              <p>Distance: {match._distanceKm.toFixed(2)} km</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MatchList;
