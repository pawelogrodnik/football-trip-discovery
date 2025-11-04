import emblems from './../data/competitionsEmblem.json';

const getCompetitionEmblem = (competitionName: string) => (emblems as any)[competitionName];

export { getCompetitionEmblem };
