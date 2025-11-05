'use client';

/* global window */
import { useEffect, useMemo, useState } from 'react';
import { LatLngExpression } from 'leaflet';
import { combineAllMatches } from './../lib/combineMatches';
import FormWrapper from './form/FormWrapper';
import MapWrapper from './map/MapWrapper';
import MatchList from './matchList/matchList';
import { MOBILE_VIEW } from './view-toggle/consts';
import ViewToggle from './view-toggle/ViewToggle';

const parseFormData = (formData: any) => {
  const query = Object.keys(formData).reduce((searchQuery: any, key: string) => {
    if (key === 'DATES') {
      return {
        ...searchQuery,
        startDate: formData[key][0],
        endDate: formData[key][1],
      };
    }
    if (key === 'RADIUS') {
      return { ...searchQuery, radius: formData[key] };
    }
    if (key === 'LOCATION') {
      return {
        ...searchQuery,
        lat: formData[key].lat,
        lon: formData[key].lon,
      };
    }
    return searchQuery;
  }, {});
  return new URLSearchParams(query);
};

export default function HomePage() {
  const INITIAL_FIXTURES = { fixtures: [], totalCount: undefined };
  const [mobileView, setMobileView] = useState(MOBILE_VIEW.LIST_VIEW);
  const [isMobile, setIsMobile] = useState(false);
  const [mapFocus, setMapFocus] = useState<{
    lat: number;
    lon: number;
    id?: string | number;
  } | null>(null);
  const [inputs, setInputs] = useState<any>({});
  const [fixtures, setFixtures] = useState(INITIAL_FIXTURES);
  const [initialCenter, setInitialCenter] = useState([50.0727808, 19.9262208] as LatLngExpression);

  useEffect(() => {
    getInitialCenter();
  }, []);

  useEffect(() => setIsMobile(window.innerWidth <= 720), []);

  const onFormUpdate = (formData: any) => setInputs(formData);

  const getInitialCenter = () => {
    navigator.geolocation.getCurrentPosition((loc) => {
      setInitialCenter([loc.coords.latitude, loc.coords.longitude]);
    });
  };

  const onFormSubmit = async (formData: any) => {
    const res = await fetch(`/api/matches?${parseFormData(formData)}`);
    const response = await res.json();
    setFixtures(response);
  };

  const onMatchClick = (match: any) => {
    const lat = match?.stadium?.geo?.latitude;
    const lon = match?.stadium?.geo?.longitude;
    if (typeof lat === 'number' && typeof lon === 'number') {
      setMapFocus({ lat, lon, id: match._id ?? match.id });
    }
  };
  const matchesCombined = useMemo(() => combineAllMatches(fixtures), [fixtures]);
  const shouldRenderMobileMap = isMobile && mobileView === MOBILE_VIEW.MAP_VIEW;
  const shouldRenderMap = !isMobile || shouldRenderMobileMap;
  return (
    <main className="p-6">
      <div className={`page-inner ${isMobile ? 'page-inner--mobile' : ''}`}>
        {isMobile && fixtures.totalCount && fixtures?.totalCount > 0 && (
          <ViewToggle onChange={setMobileView} />
        )}

        {shouldRenderMap && (
          <div className="left-side">
            <MapWrapper
              initialCenter={initialCenter}
              initialZoom={12}
              selectedLocation={inputs?.LOCATION ? inputs?.LOCATION : null}
              selectedRadius={inputs?.RADIUS ? inputs?.RADIUS : null}
              fixtures={matchesCombined}
              focus={mapFocus}
            />
          </div>
        )}
        {!shouldRenderMobileMap! && (
          <div className="right-side">
            {fixtures.totalCount && fixtures?.totalCount > 0 ? (
              <>
                <MatchList
                  totalCount={fixtures.totalCount}
                  matches={matchesCombined}
                  onGoBack={() => setFixtures(INITIAL_FIXTURES)}
                  onMatchClick={onMatchClick}
                />
              </>
            ) : (
              <FormWrapper onFormUpdate={onFormUpdate} onSubmit={onFormSubmit} />
            )}
          </div>
        )}
      </div>
    </main>
  );
}
