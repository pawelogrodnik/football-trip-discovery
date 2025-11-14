export async function geocode(query: string) {
  if (!query || query.trim().length < 3) {
    return [];
  }

  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    limit: '7',
    q: query,
  });

  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);

  if (!res.ok) {
    return [];
  }

  const data = await res.json();

  return data.map((d: any) => ({
    id: d.place_id,
    label: d.display_name,
    value: `${d.display_name} - ${d.place_id}`,
    lat: parseFloat(d.lat),
    lon: parseFloat(d.lon),
    city: d.address?.city || d.address?.town || d.address?.village || null,
    country: d.address?.country || null,
  }));
}
