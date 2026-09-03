'use client';

import { memo } from 'react';
import SharedMatchCard from '../../components/matchCard/SharedMatchCard';
import { LooseMatch } from './findResultsUtils';

type Props = {
  match: LooseMatch;
  selected: boolean;
  hovered: boolean;
  outsideRadius: boolean;
  onToggle: (id: string) => void;
  onFocus: (match: LooseMatch) => void;
  onHover: (id: string | null) => void;
};

function FindMatchCardInner(props: Props) {
  return (
    <SharedMatchCard
      variant="selectable"
      testIdPrefix="find-match-card"
      selectTestIdPrefix="find-match-select"
      {...props}
    />
  );
}

const FindMatchCard = memo(FindMatchCardInner);
export default FindMatchCard;
