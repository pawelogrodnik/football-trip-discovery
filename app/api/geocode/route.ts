// app/api/geocode/route.ts
export const dynamic = 'force-dynamic'; // no caching

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();
  if (!q) {
    return new Response(JSON.stringify([]), { status: 200 });
  }

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '7');
  url.searchParams.set('q', q);

  const res = await fetch(url.toString(), {
    headers: {
      // Identify your app per Nominatim usage policy
      'User-Agent': 'football-trip-discovery/1.0 (contact: youremail@example.com)',
      Accept: 'application/json',
    },
  });
  console.log({ res });

  if (!res.ok) {
    return new Response(JSON.stringify([]), { status: 200 });
  }

  const data = await res.json();
  const items = data.map((d: any) => {
    const id = d.place_id;
    const label = d.display_name as string;
    const city = d.address?.city || d.address?.town || d.address?.village || null;
    const country = d.address?.country || null;
    return {
      id,
      label,
      value: `${label} - ${id}`,
      lat: parseFloat(d.lat),
      lon: parseFloat(d.lon),
      city,
      country,
    };
  });

  return Response.json(items);
}
