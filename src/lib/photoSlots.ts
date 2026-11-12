// What the "Add photos" page shows for one product: which colours still need a
// photo, and how many picked photos fit in the slots left. Pure, for tests.

type Photo = { colour: string | null };

/** Each colour with how many photos show it; photos without a colour show for every option. */
export function colourCoverage(colours: string[], photos: Photo[]): { colour: string; count: number }[] {
  return colours.map((colour) => ({ colour, count: photos.filter((p) => p.colour === colour).length }));
}

/** Of the photos just picked, the ones that fit and how many were left out. */
export function fitPicked<T>(picked: T[], used: number, max: number): { kept: T[]; dropped: number } {
  const room = Math.max(0, max - used);
  return { kept: picked.slice(0, room), dropped: Math.max(0, picked.length - room) };
}
